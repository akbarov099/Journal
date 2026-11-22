import { createHash, randomBytes } from "node:crypto";
import { EMPTY_RESULTS, summarizeRecords } from "../../shared/points.js";
import { error, isCurrentAdminVersion } from "./auth.js";
import { ExcelConnector, Group, Rec, Student, Teacher } from "./models.js";

const idPattern = /^[0-9a-f]{24}$/i;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bishkek", year: "numeric", month: "2-digit" });
const basicChallenge = 'Basic realm="Journal Excel", charset="UTF-8"';
const invalidKeyMessage = "Подключение Excel недействительно. Проверьте ключ в журнале";
const columns = ["group", "month", "student_id", "last_name", "first_name", "homework", "classwork", "total", "present", "absent"];

const digest = (token) => createHash("sha256").update(token).digest("hex");
const connectorInfo = (connector) => connector
  ? { enabled: true, createdAt: connector.createdAt, updatedAt: connector.updatedAt }
  : { enabled: false, createdAt: null, updatedAt: null };

export async function connectorStatus(groupId, issuerId, authVersion) {
  return connectorInfo(await ExcelConnector.findOne({ groupId, issuerId, authVersion }));
}

export async function rotateConnector(groupId, issuerId, authVersion) {
  const token = randomBytes(32).toString("base64url");
  const scope = { groupId, issuerId };
  const update = { $set: { tokenHash: digest(token), authVersion } };
  let connector;
  try {
    connector = await ExcelConnector.findOneAndUpdate(scope, update, { upsert: true, new: true });
  } catch (err) {
    if (err.code !== 11000 || !err.keyPattern?.issuerId) throw err;
    connector = await ExcelConnector.findOneAndUpdate(scope, update, { new: true });
    if (!connector) throw error(409, "Подключение изменилось. Попробуйте снова");
  }
  return { ...connectorInfo(connector), token };
}

export async function revokeConnector(groupId, issuerId) {
  await ExcelConnector.deleteOne({ groupId, issuerId });
}

function basicToken(authorization) {
  const encoded = authorization?.match(/^Basic ([A-Za-z0-9+/]{68})$/i)?.[1];
  if (!encoded) return null;
  return Buffer.from(encoded, "base64").toString("utf8").match(/^journal:([\w-]{43})$/)?.[1] ?? null;
}

async function accessibleGroup(connector) {
  const { groupId, issuerId, authVersion } = connector;
  const filter = { _id: groupId, deletedAt: null };
  if (issuerId === "admin") {
    if (!isCurrentAdminVersion(authVersion)) return null;
  } else {
    if (!(await Teacher.exists({ _id: issuerId, authVersion }))) return null;
    filter.teacherId = issuerId;
  }
  return Group.findOne(filter, "name").lean();
}

function requireExcelKey(res) {
  res.set("WWW-Authenticate", basicChallenge);
  throw error(401, invalidKeyMessage);
}

export async function requireExcelAccess(req, res, next) {
  res.set("Cache-Control", "private, no-store");
  res.vary("Authorization");
  const token = basicToken(req.get("Authorization"));
  if (!token || !idPattern.test(req.params.id)) requireExcelKey(res);
  const tokenHash = digest(token);
  const connector = await ExcelConnector.findOne({ groupId: req.params.id, tokenHash }, "+authVersion").lean();
  const group = connector && await accessibleGroup(connector);
  if (!group) requireExcelKey(res);
  req.excel = { connector, group, tokenHash };
  next();
}

export async function loadExcelRows(req, selectedMonth = req.query.month) {
  if (selectedMonth !== undefined && (typeof selectedMonth !== "string" || !monthPattern.test(selectedMonth))) {
    throw error(400, "Укажите месяц в формате ГГГГ-ММ");
  }

  const { connector, group, tokenHash } = req.excel;
  const students = await Student.find({ groupId: group._id, deletedAt: null }, "first last").lean();
  students.sort((a, b) => a.last.localeCompare(b.last, "ru") || a.first.localeCompare(b.first, "ru"));
  const recordFilter = { studentId: { $in: students.map((student) => student._id) } };
  if (selectedMonth) recordFilter.date = { $gte: `${selectedMonth}-00`, $lte: `${selectedMonth}-99` };
  const records = students.length ? await Rec.find(recordFilter, "studentId date hw cw a").lean() : [];
  const { monthly } = summarizeRecords(Object.fromEntries(records.map((record) => [`${record.studentId}|${record.date}`, record])));
  const months = selectedMonth ? [selectedMonth] : [...new Set(
    [monthFormat.format(new Date()), ...records.map((record) => record.date.slice(0, 7))],
  )].sort();

  const [activeConnector, activeGroup, currentStudents] = await Promise.all([
    ExcelConnector.exists({ _id: connector._id, tokenHash }),
    accessibleGroup(connector),
    Student.find({ groupId: group._id, deletedAt: null, _id: recordFilter.studentId }, "_id").lean(),
  ]);
  if (!activeConnector || !activeGroup) requireExcelKey(req.res);
  const activeStudentIds = new Set(currentStudents.map((student) => String(student._id)));
  return months.flatMap((month) => students.filter((student) => activeStudentIds.has(String(student._id))).map((student) => {
    const result = monthly.get(`${student._id}|${month}`) ?? EMPTY_RESULTS;
    return {
      group: activeGroup.name,
      month,
      student_id: String(student._id),
      last_name: student.last,
      first_name: student.first,
      homework: result.hw,
      classwork: result.cw,
      total: result.pts,
      present: result.present,
      absent: result.marked - result.present,
    };
  }));
}

function csvCell(value) {
  if (typeof value === "number") return String(value);
  const safe = /^[\t\n\r]|^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function writeExcelCsv(req, res) {
  const rows = await loadExcelRows(req);
  const lines = rows.map((row) => columns.map((key) => csvCell(row[key])).join(","));
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="journal-monthly.csv"');
  res.send(`\uFEFF${[columns.join(","), ...lines].join("\r\n")}\r\n`);
}

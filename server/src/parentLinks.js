import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { EMPTY_RESULTS, summarizeRecords } from "../../shared/points.js";
import { adminAccount } from "./admin.config.js";
import { error } from "./auth.js";
import { Group, Rec, Student } from "./models.js";

const signingKey = process.env.PARENT_LINK_SECRET || adminAccount.password;
const idPattern = /^[0-9a-f]{24}$/i;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bishkek", year: "numeric", month: "2-digit" });
const labelNormalizer = (value) => value.normalize("NFC").trim().replace(/\s+/gu, " ");
const unavailable = () => error(404, "РЎСЃС‹Р»РєР° РЅРµРґРѕСЃС‚СѓРїРЅР°. РџРѕРїСЂРѕСЃРёС‚Рµ РїСЂРµРїРѕРґР°РІР°С‚РµР»СЏ РїСЂРёСЃР»Р°С‚СЊ РЅРѕРІСѓСЋ СЃСЃС‹Р»РєСѓ.");

function shareToken(group) {
  return createHmac("sha256", signingKey)
    .update(`journal:parent-link:v1:${group._id}:${group.parentLinkNonce}`)
    .digest("base64url");
}

export function privateParentPage(res) {
  res.set({
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
  });
}

export function parentLinkStatus(group) {
  if (!group.parentLinkNonce) return { enabled: false };
  return { enabled: true, token: shareToken(group) };
}

export async function rotateParentLink(group) {
  const parentLinkNonce = randomBytes(32).toString("base64url");
  const updated = await Group.findOneAndUpdate(
    { _id: group._id, teacherId: group.teacherId, deletedAt: null },
    { $set: { parentLinkNonce } },
    { new: true, timestamps: false, projection: "+parentLinkNonce" },
  );
  if (!updated) throw error(404, "Р“СЂСѓРїРїР° РЅРµ РЅР°Р№РґРµРЅР°");
  return parentLinkStatus(updated);
}

export async function removeParentLink(group) {
  await Group.updateOne(
    { _id: group._id, teacherId: group.teacherId, deletedAt: null },
    { $unset: { parentLinkNonce: 1 } },
    { timestamps: false },
  );
}

function publicLabels(students) {
  const labels = students.map(
    ({ first, last }) => `${labelNormalizer(first)} ${labelNormalizer(last)}`
  );
  const totals = new Map();
  const used = new Map();
  const labelKeys = labels.map((label) => label.toLocaleLowerCase("ru"));
  for (const key of labelKeys) totals.set(key, (totals.get(key) ?? 0) + 1);
  return labels.map((label, index) => {
    const key = labelKeys[index];
    if (totals.get(key) === 1) return label;
    const position = (used.get(key) ?? 0) + 1;
    used.set(key, position);
    return `${label} (${position})`;
  });
}

export async function publicGroup(req, res) {
  privateParentPage(res);
  res.vary("Authorization");

  const token = req.get("Authorization")?.match(/^Share ([A-Za-z0-9_-]{43})$/i)?.[1];
  const id = req.params.id;
  if (!token || !idPattern.test(id)) throw unavailable();
  const group = await Group.findOne({ _id: id, deletedAt: null }, "name color start +parentLinkNonce").lean();
  if (!group?.parentLinkNonce || !timingSafeEqual(Buffer.from(token), Buffer.from(shareToken(group)))) throw unavailable();

  const month = req.query.month === undefined ? monthFormat.format(new Date()) : req.query.month;
  if (typeof month !== "string" || !monthPattern.test(month)) throw error(400, "РЈРєР°Р¶РёС‚Рµ РјРµСЃСЏС† РІ С„РѕСЂРјР°С‚Рµ Р“Р“Р“Р“-РњРњ");
  const studentFilter = { groupId: group._id, deletedAt: null };
  const students = await Student.find(studentFilter, "first last joined +currentGroupSince")
    .sort({ last: 1, first: 1, _id: 1 }).lean();
  const byId = new Map(students.map((student) => [String(student._id), student]));
  const date = { $gte: `${month}-01`, $lte: `${month}-31` };
  const records = students.length
    ? await Rec.find(
      { studentId: { $in: students.map((student) => student._id) }, date },
      "studentId date a hw cw createdAt +createdInGroupId",
    ).lean()
    : [];
  const entries = [];
  const lessonsByStudent = new Map();
  for (const record of records) {
    const student = byId.get(String(record.studentId));
    const since = student.currentGroupSince;
    if (record.date < student.joined || record.date < group.start) continue;
    if (record.createdInGroupId && !group._id.equals(record.createdInGroupId)) continue;
    if (since && (!record.createdAt || record.createdAt <= since)) continue;
    entries.push([`${record.studentId}|${record.date}`, record]);
    if (record.hw != null || record.cw != null) {
      const id = String(record.studentId);
      const lessons = lessonsByStudent.get(id) ?? [];
      lessons.push({ date: record.date, hw: record.hw ?? null, cw: record.cw ?? null });
      lessonsByStudent.set(id, lessons);
    }
  }
  const { monthly } = summarizeRecords(Object.fromEntries(entries));

  const [activeGroup, activeStudents] = await Promise.all([
    Group.findOne({ _id: id, deletedAt: null, parentLinkNonce: group.parentLinkNonce }, "name color").lean(),
    Student.find({ ...studentFilter, _id: { $in: students.map((student) => student._id) } }, "_id").lean(),
  ]);
  if (!activeGroup) throw unavailable();
  const activeIds = new Set(activeStudents.map((student) => String(student._id)));
  const current = students.filter((student) => activeIds.has(String(student._id)));
  const labels = publicLabels(current);
  res.json({
    group: { name: activeGroup.name, color: activeGroup.color ?? "lightblue" },
    month,
    students: current.map((student, index) => {
      const { hw, cw, pts, present, marked } = monthly.get(`${student._id}|${month}`) ?? EMPTY_RESULTS;
      const lessons = lessonsByStudent.get(String(student._id)) ?? [];
      lessons.sort((a, b) => a.date.localeCompare(b.date));
      return { label: labels[index], hw, cw, total: pts, present, absent: marked - present, lessons };
    }),
  });
}
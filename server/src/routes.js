import { Router } from "express";
import { normalizePhone } from "../../shared/phone.js";
import { error as httpError, login, logout, requireAdmin, requireSession } from "./auth.js";
import { connectorStatus, loadExcelRows, requireExcelAccess, revokeConnector, rotateConnector, writeExcelCsv } from "./excel.js";
import excelOData from "./excelOData.js";
import { ExcelConnector, Group, Student, Rec, Teacher } from "./models.js";
import { parentLinkStatus, publicGroup, removeParentLink, rotateParentLink } from "./parentLinks.js";
import { addTeacher, deleteTeacher, getTeachers, listTeachers, updateTeacher } from "./teachers.js";

const r = Router();

// ---------- helpers ----------
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
let rosterChanges = Promise.resolve();

// Archive and enrollment operations touch multiple collections on standalone MongoDB.
const changeRoster = (fn) => wrap((req, res) => {
  const change = rosterChanges.then(() => fn(req, res));
  rosterChanges = change.catch(() => {});
  return change;
});

const isId = (v) => typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const defined = (o = {}, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
// Архивация/восстановление не должны менять «время изменения» (updatedAt)
const NO_TS = { timestamps: false };
const byDeleted = (a, b) => b.deletedAt - a.deletedAt;

function needId(id, what = "id") {
  if (!isId(id)) throw httpError(400, `Некорректный ${what}`);
}

const groupScope = (user) => user.role === "teacher" ? { teacherId: user.id } : {};

async function findGroup(id, user, archived = false, projection) {
  needId(id, "id группы");
  const group = await Group.findOne(
    { _id: id, deletedAt: archived ? { $ne: null } : null, ...groupScope(user) },
    projection,
  );
  if (!group) throw httpError(404, archived ? "Группа не найдена в архиве" : "Группа не найдена");
  return group;
}

const normalizedGroupName = (name) => name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();

async function groupNameKey(name, previous) {
  if (typeof name !== "string" || !name.trim()) throw httpError(400, "Укажите название группы");
  const nameKey = normalizedGroupName(name);
  if (previous && nameKey === normalizedGroupName(previous.name)) return previous.nameKey;

  const existing = previous ? { _id: { $ne: previous._id } } : {};
  if (await Group.exists({ ...existing, nameKey })) throw httpError(409, "Группа с таким названием уже существует");
  const legacy = await Group.find({ ...existing, nameKey: { $exists: false } }, "name").lean();
  if (legacy.some((group) => normalizedGroupName(group.name) === nameKey)) {
    throw httpError(409, "Группа с таким названием уже существует");
  }
  return nameKey;
}

async function groupTeacher(value, user) {
  if (user.role === "teacher") return user.id;
  if (value == null || value === "") return null;
  needId(value, "id преподавателя");
  if (!(await Teacher.exists({ _id: value }))) throw httpError(400, "Преподаватель не найден");
  return value.toLowerCase();
}

async function clearDeletedOwner(group) {
  if (group.teacherId && !(await Teacher.exists({ _id: group.teacherId }))) {
    await Group.updateOne(
      { _id: group._id, teacherId: group.teacherId },
      { $set: { teacherId: null }, $unset: { parentLinkNonce: 1 } },
      NO_TS,
    );
    group.teacherId = null;
  }
  return group;
}

async function requireEmptyGroup(group, user) {
  if (user.role === "teacher" && await Student.exists({ groupId: group._id })) {
    throw httpError(403, "С группой, в которой есть ученики, это сделает администратор");
  }
}

function studentPhones(values, previous) {
  for (const field of ["phone", "parent"]) {
    if (values[field] === undefined) continue;
    const phone = normalizePhone(values[field]);
    if (phone === null) {
      // Старый номер можно оставить при изменении других данных ученика.
      if (values[field] === previous?.[field]) continue;
      throw httpError(400, "Укажите телефон из 9 цифр");
    }
    values[field] = phone;
  }
  return values;
}

function recordFields(patch) {
  const set = defined(patch ?? {}, ["a", "hw", "cw"]);
  if (!Object.keys(set).length) throw httpError(400, "Нечего сохранять");
  if (set.a !== undefined && ![null, "p", "a"].includes(set.a)) throw httpError(400, "Некорректная отметка посещаемости");
  for (const field of ["hw", "cw"]) {
    const value = set[field];
    if (value != null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 4)) {
      throw httpError(400, "Оценка должна быть от 0 до 4");
    }
  }
  return set;
}

// Повтор при гонке уникального индекса (два быстрых upsert подряд)
async function retryDup(fn) {
  try { return await fn(); } catch (e) { if (e.code === 11000) return fn(); throw e; }
}

// ---------- state ----------
r.get("/health", (_req, res) => res.json({ ok: true }));
r.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
r.post("/auth/login", wrap(login));
r.get("/excel/groups/:id.csv", wrap(requireExcelAccess), wrap(writeExcelCsv));
r.use("/excel/groups/:id/odata", wrap(requireExcelAccess), excelOData(loadExcelRows));
r.get("/public/groups/:id", wrap(publicGroup));
r.use(wrap(requireSession));
r.get("/auth/me", (req, res) => res.json({ user: req.user }));
r.post("/auth/logout", wrap(logout));

r.get("/teachers", requireAdmin, wrap(getTeachers));
r.post("/teachers", requireAdmin, wrap(addTeacher));
r.put("/teachers/:id", requireAdmin, wrap(updateTeacher));
r.delete("/teachers/:id", requireAdmin, changeRoster(deleteTeacher));

r.get("/state", wrap(async (req, res) => {
  const admin = req.user.role === "admin";
  const allGroups = await Group.find(groupScope(req.user)).sort({ createdAt: 1 });
  const studentScope = admin ? {} : { groupId: { $in: allGroups.map((g) => g._id) } };
  const allStudents = await Student.find(studentScope).sort({ createdAt: 1 });
  const groupById = new Map(allGroups.map((g) => [String(g._id), g]));
  const studentsByGroup = new Map();
  for (const student of allStudents) {
    const groupId = String(student.groupId);
    if (!studentsByGroup.has(groupId)) studentsByGroup.set(groupId, []);
    studentsByGroup.get(groupId).push(student);
  }

  const groups = allGroups.filter((g) => !g.deletedAt);
  const activeIds = new Set(groups.map((g) => String(g._id)));
  const students = allStudents.filter((s) => !s.deletedAt && activeIds.has(String(s.groupId)));
  const [records, teachers] = await Promise.all([
    students.length ? Rec.find({ studentId: { $in: students.map((s) => s._id) } }) : [],
    admin ? listTeachers(groups, students) : [],
  ]);
  const teacherIds = new Set(teachers.map((teacher) => teacher.id));
  const groupJSON = (group) => {
    const result = group.toJSON();
    if (admin && result.teacherId && !teacherIds.has(result.teacherId)) result.teacherId = null;
    result.studentCount = studentsByGroup.get(result.id)?.length ?? 0;
    return result;
  };

  // Архив: группы целиком (со списком учеников, ушедших вместе с ними)…
  const archGroups = allGroups
    .filter((g) => g.deletedAt)
    .sort(byDeleted)
    .map((g) => ({
      ...groupJSON(g),
      students: (studentsByGroup.get(String(g._id)) ?? []).filter((s) => s.deletedBy === "group" && s.deletedAt),
    }));

  // …и отдельно удалённые ученики (с названием группы)
  const archStudents = (admin ? allStudents : [])
    .filter((s) => s.deletedAt && !(s.deletedBy === "group" && groupById.get(String(s.groupId))?.deletedAt))
    .sort(byDeleted)
    .map((s) => {
      const g = groupById.get(String(s.groupId));
      return { ...s.toJSON(), groupName: g?.name ?? "—", groupArchived: Boolean(g?.deletedAt) };
    });

  res.json({
    groups: groups.map(groupJSON), students, records, teachers,
    archive: { groups: archGroups, students: archStudents },
  });
}));

// ---------- groups ----------
r.get("/groups/:id/parent-link", wrap(async (req, res) => {
  const group = await findGroup(req.params.id, req.user, false, "+parentLinkNonce");
  res.json(parentLinkStatus(group));
}));

r.post("/groups/:id/parent-link", changeRoster(async (req, res) => {
  const group = await findGroup(req.params.id, req.user);
  res.json(await rotateParentLink(group));
}));

r.delete("/groups/:id/parent-link", changeRoster(async (req, res) => {
  const group = await findGroup(req.params.id, req.user);
  await removeParentLink(group);
  res.status(204).end();
}));

r.get("/groups/:id/excel", wrap(async (req, res) => {
  const group = await findGroup(req.params.id, req.user);
  res.json(await connectorStatus(group._id, req.user.id, req.authVersion));
}));

r.post("/groups/:id/excel", changeRoster(async (req, res) => {
  const group = await findGroup(req.params.id, req.user);
  res.json(await rotateConnector(group._id, req.user.id, req.authVersion));
}));

r.delete("/groups/:id/excel", changeRoster(async (req, res) => {
  const group = await findGroup(req.params.id, req.user);
  await revokeConnector(group._id, req.user.id);
  res.status(204).end();
}));

r.post("/groups", wrap(async (req, res) => {
  const { name, days, start, color, timeStart, timeEnd } = req.body;
  const [nameKey, teacherId] = await Promise.all([
    groupNameKey(name),
    groupTeacher(req.body.teacherId, req.user),
  ]);
  const group = await Group.create({ name, nameKey, days, start, color, timeStart, timeEnd, teacherId });
  res.status(201).json(await clearDeletedOwner(group));
}));

r.put("/groups/:id", changeRoster(async (req, res) => {
  const g = await findGroup(req.params.id, req.user);
  const upd = defined(req.body, ["name", "days", "start", "color", "timeStart", "timeEnd"]);
  if (upd.name !== undefined) upd.nameKey = await groupNameKey(upd.name, g);
  if (req.user.role === "admin" && req.body.teacherId !== undefined) {
    upd.teacherId = await groupTeacher(req.body.teacherId, req.user);
  }
  // update-валидаторы не видят соседние поля, поэтому порядок времени проверяем здесь
  const ts = upd.timeStart ?? g.timeStart, te = upd.timeEnd ?? g.timeEnd;
  if (ts && te && te <= ts) throw httpError(400, "Время окончания должно быть позже начала");
  const change = { $set: upd };
  if (upd.teacherId !== undefined && String(g.teacherId) !== String(upd.teacherId)) change.$unset = { parentLinkNonce: 1 };
  const doc = await Group.findOneAndUpdate(
    { _id: g._id, deletedAt: null, ...groupScope(req.user) },
    change,
    { new: true, runValidators: true },
  );
  if (!doc) throw httpError(404, "Группа не найдена");
  if (g.teacherId && String(g.teacherId) !== String(doc.teacherId)) await revokeConnector(g._id, String(g.teacherId));
  res.json(await clearDeletedOwner(doc));
}));

// «Удаление» группы = перенос в архив вместе со всеми её учениками
r.delete("/groups/:id", changeRoster(async (req, res) => {
  const g = await findGroup(req.params.id, req.user);
  await requireEmptyGroup(g, req.user);
  const now = new Date();
  const archived = await Group.updateOne(
    { _id: g._id, deletedAt: null, ...groupScope(req.user) },
    { $set: { deletedAt: now }, $unset: { parentLinkNonce: 1 } },
    NO_TS,
  );
  if (!archived.modifiedCount) throw httpError(404, "Группа не найдена");
  if (req.user.role === "teacher") {
    if (await Student.exists({ groupId: g._id })) {
      await Group.updateOne({ _id: g._id, deletedAt: now }, { $set: { deletedAt: null } }, NO_TS);
      throw httpError(403, "С группой, в которой есть ученики, это сделает администратор");
    }
    await ExcelConnector.deleteMany({ groupId: g._id });
    return res.json({ archivedStudents: 0 });
  }
  const [{ modifiedCount }] = await Promise.all([
    Student.updateMany({ groupId: g._id, deletedAt: null }, { $set: { deletedAt: now, deletedBy: "group" } }, NO_TS),
    ExcelConnector.deleteMany({ groupId: g._id }),
  ]);
  res.json({ archivedStudents: modifiedCount });
}));

// ---------- students ----------
r.post("/students", changeRoster(async (req, res) => {
  const { groupId, last, first, phone, parent, joined } = req.body;
  await findGroup(groupId, req.user);
  const student = await Student.create(studentPhones({ groupId, last, first, phone, parent, joined }));
  if (!(await Group.exists({ _id: groupId, deletedAt: null, ...groupScope(req.user) }))) {
    await Student.deleteOne({ _id: student._id });
    throw httpError(409, "Группа изменилась. Проверьте группу и попробуйте снова");
  }
  res.status(201).json(student);
}));

r.put("/students/:id", requireAdmin, changeRoster(async (req, res) => {
  needId(req.params.id, "id ученика");
  const student = await Student.findOne({ _id: req.params.id, deletedAt: null });
  if (!student) throw httpError(404, "Ученик не найден");
  const upd = defined(req.body, ["groupId", "last", "first", "phone", "parent", "joined"]);
  if (upd.groupId !== undefined) {
    const group = await findGroup(upd.groupId, req.user);
    if (String(group._id) !== String(student.groupId)) upd.currentGroupSince = new Date();
  }
  const doc = await Student.findOneAndUpdate(
    { _id: student._id, deletedAt: null },
    studentPhones(upd, student),
    { new: true, runValidators: true },
  );
  if (!doc) throw httpError(404, "Ученик не найден");
  res.json(doc);
}));

// «Удаление» ученика = перенос в архив (отметки и баллы сохраняются)
r.delete("/students/:id", requireAdmin, changeRoster(async (req, res) => {
  needId(req.params.id, "id ученика");
  const doc = await Student.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: "student" } },
    { new: true, timestamps: false }
  );
  if (!doc) throw httpError(404, "Ученик не найден");
  res.json(doc);
}));

// ---------- records ----------
r.put("/records", wrap(async (req, res) => {
  const { studentId, date, patch } = req.body;
  needId(studentId, "id ученика");
  if (typeof date !== "string" || !DATE_RE.test(date)) throw httpError(400, "Некорректная дата");
  const set = recordFields(patch);
  const student = await Student.findOne({ _id: studentId, deletedAt: null }, "groupId");
  if (!student || !(await Group.exists({ _id: student.groupId, deletedAt: null, ...groupScope(req.user) }))) {
    throw httpError(404, "Ученик не найден");
  }

  const doc = await retryDup(() =>
    Rec.findOneAndUpdate(
      { studentId, date },
      { $set: set, $setOnInsert: { createdInGroupId: student.groupId } },
      { upsert: true, new: true, runValidators: true },
    )
  );
  res.json(doc);
}));

// «Все пришли» — массовая отметка
r.post("/records/bulk", wrap(async (req, res) => {
  const { studentIds = [], date, patch } = req.body;
  if (!Array.isArray(studentIds) || !studentIds.every(isId)) throw httpError(400, "Некорректный список учеников");
  if (typeof date !== "string" || !DATE_RE.test(date)) throw httpError(400, "Некорректная дата");
  const set = recordFields(patch);
  const requestedIds = [...new Set(studentIds.map((id) => id.toLowerCase()))];
  const students = await Student.find({ _id: { $in: requestedIds }, deletedAt: null }, "groupId");
  const groupIds = students.map((student) => student.groupId);
  const groups = await Group.find({ _id: { $in: groupIds }, deletedAt: null, ...groupScope(req.user) }, "_id");
  const accessibleGroups = new Set(groups.map((g) => String(g._id)));
  const accessibleStudents = students.filter((s) => accessibleGroups.has(String(s.groupId)));
  if (req.user.role === "teacher" && accessibleStudents.length !== requestedIds.length) throw httpError(404, "Ученик не найден");
  if (accessibleStudents.length) {
    await retryDup(() =>
      Rec.bulkWrite(accessibleStudents.map(({ _id: studentId, groupId }) => ({
        updateOne: {
          filter: { studentId, date },
          update: { $set: set, $setOnInsert: { createdInGroupId: groupId } },
          upsert: true,
        },
      })))
    );
  }
  res.json({ updated: accessibleStudents.length });
}));

// ---------- archive ----------
async function archivedStudent(id) {
  needId(id, "id ученика");
  const s = await Student.findOne({ _id: id, deletedAt: { $ne: null } });
  if (!s) throw httpError(404, "Ученик не найден в архиве");
  return s;
}

// Вернуть группу вместе с учениками, которые ушли в архив вместе с ней
r.post("/archive/groups/:id/restore", changeRoster(async (req, res) => {
  const g = await findGroup(req.params.id, req.user, true);
  await requireEmptyGroup(g, req.user);
  const restored = await Group.updateOne(
    { _id: g._id, deletedAt: g.deletedAt, ...groupScope(req.user) },
    { $set: { deletedAt: null } },
    NO_TS,
  );
  if (!restored.modifiedCount) throw httpError(404, "Группа не найдена в архиве");
  if (req.user.role === "teacher") return res.json({ restoredStudents: 0 });
  const { modifiedCount } = await Student.updateMany(
    { groupId: g._id, deletedBy: "group" },
    { $set: { deletedAt: null, deletedBy: null } },
    NO_TS
  );
  res.json({ restoredStudents: modifiedCount });
}));

// Вернуть одного ученика в его группу (группа не должна лежать в архиве)
r.post("/archive/students/:id/restore", requireAdmin, changeRoster(async (req, res) => {
  const s = await archivedStudent(req.params.id);
  const g = await Group.findById(s.groupId);
  if (!g) throw httpError(409, "Группа этого ученика удалена навсегда");
  if (g.deletedAt) throw httpError(409, `Сначала восстановите группу «${g.name}»`);
  await Student.updateOne({ _id: s._id }, { $set: { deletedAt: null, deletedBy: null } }, NO_TS);
  res.json({ ok: true });
}));

// Удалить навсегда: группа + все её ученики + их отметки
r.delete("/archive/groups/:id", changeRoster(async (req, res) => {
  const g = await findGroup(req.params.id, req.user, true);
  await requireEmptyGroup(g, req.user);
  if (req.user.role === "teacher") {
    const removed = await Group.deleteOne({ _id: g._id, deletedAt: g.deletedAt, ...groupScope(req.user) });
    if (!removed.deletedCount) throw httpError(404, "Группа не найдена в архиве");
    await ExcelConnector.deleteMany({ groupId: g._id });
    return res.status(204).end();
  }
  const ids = (await Student.find({ groupId: g._id }, "_id")).map((s) => s._id);
  await Rec.deleteMany({ studentId: { $in: ids } });
  await Student.deleteMany({ groupId: g._id });
  await Group.deleteOne({ _id: g._id });
  await ExcelConnector.deleteMany({ groupId: g._id });
  res.status(204).end();
}));

r.delete("/archive/students/:id", requireAdmin, changeRoster(async (req, res) => {
  const s = await archivedStudent(req.params.id);
  await Rec.deleteMany({ studentId: s._id });
  await Student.deleteOne({ _id: s._id });
  res.status(204).end();
}));

// Полная очистка архива
r.delete("/archive", requireAdmin, changeRoster(async (_req, res) => {
  const gids = (await Group.find({ deletedAt: { $ne: null } }, "_id")).map((g) => g._id);
  const sids = (await Student.find({ $or: [{ deletedAt: { $ne: null } }, { groupId: { $in: gids } }] }, "_id")).map((s) => s._id);
  await Rec.deleteMany({ studentId: { $in: sids } });
  await Student.deleteMany({ _id: { $in: sids } });
  await Group.deleteMany({ _id: { $in: gids } });
  await ExcelConnector.deleteMany({ groupId: { $in: gids } });
  res.json({ groups: gids.length, students: sids.length });
}));

export default r;

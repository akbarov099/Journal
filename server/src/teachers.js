import { randomUUID } from "node:crypto";
import { normalizePhone } from "../../shared/phone.js";
import { error, isAdminPhone, passwordFields } from "./auth.js";
import { ExcelConnector, Group, Session, Student, Teacher } from "./models.js";

export async function listTeachers(groups, students) {
  const teachers = await Teacher.find().sort({ name: 1, _id: 1 });
  const byId = new Map(teachers.map((teacher) => {
    const data = { ...teacher.toJSON(), groupCount: 0, studentCount: 0 };
    return [data.id, data];
  }));
  const teacherByGroup = new Map();
  for (const group of groups) {
    const teacher = byId.get(String(group.teacherId));
    if (!teacher) continue;
    teacher.groupCount += 1;
    teacherByGroup.set(String(group._id), teacher);
  }
  for (const student of students) {
    const teacher = teacherByGroup.get(String(student.groupId));
    if (teacher) teacher.studentCount += 1;
  }
  return [...byId.values()];
}

export async function getTeachers(_req, res) {
  const groups = await Group.find({ deletedAt: null, teacherId: { $ne: null } }, "teacherId");
  const students = await Student.find({ deletedAt: null, groupId: { $in: groups.map((g) => g._id) } }, "groupId");
  res.json(await listTeachers(groups, students));
}

function teacherPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) throw error(400, "Укажите телефон преподавателя из 9 цифр");
  if (isAdminPhone(phone)) throw error(409, "Этот телефон уже используется");
  return phone;
}

export async function addTeacher(req, res) {
  const { name, phone, password } = req.body;
  if (typeof name !== "string") throw error(400, "Укажите имя преподавателя");
  const newTeacher = await Teacher.create({ name, phone: teacherPhone(phone), ...await passwordFields(password) });
  res.status(201).json({ ...newTeacher.toJSON(), groupCount: 0, studentCount: 0 });
}

function teacherId(id) {
  if (!/^[0-9a-f]{24}$/i.test(id)) throw error(400, "Некорректный id преподавателя");
  return id;
}

export async function updateTeacher(req, res) {
  const id = teacherId(req.params.id);
  const teacher = await Teacher.findById(id);
  if (!teacher) throw error(404, "Преподаватель не найден");

  const { name, phone, password } = req.body;
  const changes = {};
  if (name !== undefined) {
    if (typeof name !== "string") throw error(400, "Укажите имя преподавателя");
    changes.name = name;
  }
  if (phone !== undefined) {
    changes.phone = teacherPhone(phone);
    if (changes.phone !== teacher.phone) changes.authVersion = randomUUID();
  }
  if (password !== undefined && password !== "") Object.assign(changes, await passwordFields(password));

  const updated = await Teacher.findByIdAndUpdate(id, changes, { new: true, runValidators: true });
  if (!updated) throw error(404, "Преподаватель не найден");
  res.json(updated);
}

export async function deleteTeacher(req, res) {
  const id = teacherId(req.params.id);
  const removed = await Teacher.deleteOne({ _id: id });
  await Promise.all([
    Group.updateMany({ teacherId: id }, { $set: { teacherId: null }, $unset: { parentLinkNonce: 1 } }),
    Session.deleteMany({ teacherId: id }),
    ExcelConnector.deleteMany({ issuerId: id }),
  ]);
  if (!removed.deletedCount) throw error(404, "Преподаватель не найден");
  res.status(204).end();
}

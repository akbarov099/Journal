import mongoose from "mongoose";
import { COLOR_KEYS } from "../../shared/group-colors.js";

const { Schema, model } = mongoose;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{2}:\d{2})?$/;
const dateField = { type: String, required: true, match: [DATE_RE, "Дата должна быть в формате ГГГГ-ММ-ДД"] };

// В ответах API: _id -> id, ObjectId -> строка.
// createdAt / updatedAt / deletedAt остаются (Date -> ISO-строка при сериализации).
const opts = (extra = []) => ({
  versionKey: false,
  timestamps: true,
  toJSON: {
    transform: (_doc, r) => {
      r.id = String(r._id);
      delete r._id;
      for (const k of ["groupId", "studentId", "teacherId"]) if (r[k]) r[k] = String(r[k]);
      for (const k of extra) delete r[k];
    },
  },
});

// deletedAt != null  ->  группа лежит в архиве
const groupSchema = new Schema({
  name: { type: String, required: [true, "Укажите название группы"], trim: true, maxlength: 80 },
  nameKey: { type: String },
  teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
  parentLinkNonce: { type: String, select: false },
  days: {
    type: [Number],
    validate: {
      validator: (v) => v.length > 0 && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
      message: "Выберите хотя бы один день недели",
    },
  },
  start: dateField, // YYYY-MM-DD
  timeStart: { type: String, default: "", match: [TIME_RE, "Время начала должно быть в формате ЧЧ:ММ"] }, // HH:MM
  timeEnd: {
    type: String, default: "", match: [TIME_RE, "Время окончания должно быть в формате ЧЧ:ММ"],
    validate: {
      validator(v) { return !v || !this.timeStart || v > this.timeStart; },
      message: "Время окончания должно быть позже начала",
    },
  },
  color: { type: String, enum: COLOR_KEYS, default: "lightblue" },
  deletedAt: { type: Date, default: null },
}, opts(["nameKey", "parentLinkNonce"]));
// Старые группы без nameKey остаются доступными, даже если в базе уже есть дубликаты.
groupSchema.index({ nameKey: 1 }, { unique: true, partialFilterExpression: { nameKey: { $type: "string" } } });
export const Group = model("Group", groupSchema);

// deletedAt != null  ->  ученик в архиве
// deletedBy: "student" — удалён сам по себе, "group" — ушёл в архив вместе с группой
export const Student = model("Student", new Schema({
  groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
  last: { type: String, required: [true, "Укажите фамилию"], trim: true, maxlength: 60 },
  first: { type: String, required: [true, "Укажите имя"], trim: true, maxlength: 60 },
  phone: { type: String, default: "", trim: true, maxlength: 40 },
  parent: { type: String, default: "", trim: true, maxlength: 40 },
  joined: dateField, // YYYY-MM-DD
  currentGroupSince: { type: Date, select: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, enum: ["student", "group"], default: null },
}, opts(["currentGroupSince"])));

// Одна запись = один ученик на один урок: посещаемость + баллы за ДЗ и классную работу
const recSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  createdInGroupId: { type: Schema.Types.ObjectId, ref: "Group", select: false },
  date: dateField,
  a: { type: String, enum: ["p", "a"], default: null },
  hw: { type: Number, min: 0, max: 4, default: null },
  cw: { type: Number, min: 0, max: 4, default: null },
}, opts(["createdAt", "updatedAt", "createdInGroupId"]));
recSchema.index({ studentId: 1, date: 1 }, { unique: true });

export const Rec = model("Record", recSchema);

const teacherSchema = new Schema({
  name: { type: String, required: [true, "Укажите имя преподавателя"], trim: true, maxlength: 80 },
  phone: { type: String, required: true, match: /^\+996\d{9}$/ },
  passwordHash: { type: String, required: true, select: false },
  authVersion: { type: String, required: true, select: false },
}, opts(["passwordHash", "authVersion", "createdAt", "updatedAt"]));
teacherSchema.index({ phone: 1 }, { unique: true });
export const Teacher = model("Teacher", teacherSchema);

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  role: { type: String, enum: ["admin", "teacher"], required: true },
  teacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
  authVersion: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { versionKey: false });
// Keep journal sessions independent of indexes from other apps using the same database.
export const Session = model("Session", sessionSchema, "journal_auth_sessions");

const excelConnectorSchema = new Schema({
  groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true },
  issuerId: { type: String, required: true, index: true },
  authVersion: { type: String, required: true, select: false },
  tokenHash: { type: String, required: true, unique: true, select: false },
}, opts(["authVersion", "tokenHash"]));
excelConnectorSchema.index({ groupId: 1, issuerId: 1 }, { unique: true });
export const ExcelConnector = model("ExcelConnector", excelConnectorSchema, "journal_excel_connectors");

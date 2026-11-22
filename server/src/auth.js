import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { normalizePhone } from "../../shared/phone.js";
import { adminAccount } from "./admin.config.js";
import { Session, Teacher } from "./models.js";

const deriveKey = promisify(scrypt);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sessionDuration = 12 * 60 * 60 * 1000;
const loginWindow = 10 * 60 * 1000;
const loginAttempts = new Map();
const dummyHash = `${"00".repeat(16)}:${"00".repeat(32)}`;

const adminPhone = normalizePhone(adminAccount.phone);
export const isAdminPhone = (phone) => phone === adminPhone;
const adminUser = { id: "admin", name: "Администратор", phone: adminPhone, role: "admin" };

function isPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128 && value.trim().length > 0;
}

if (!adminPhone || !isPassword(adminAccount.password)) {
  throw new Error("Укажите действительный телефон и пароль от 8 до 128 символов в server/src/admin.config.js");
}

const adminPasswordHash = hash(adminAccount.password);
const adminAuthVersion = hash(`${adminPhone}:${adminAccount.password}`);
export const isCurrentAdminVersion = (version) => version === adminAuthVersion;

export function error(status, message) {
  return Object.assign(new Error(message), { status });
}

export function teacherUser(teacher) {
  return { ...teacher.toJSON(), role: "teacher" };
}

export async function passwordFields(password) {
  if (!isPassword(password)) throw error(400, "Пароль должен содержать от 8 до 128 символов");
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 32);
  return { passwordHash: `${salt}:${key.toString("hex")}`, authVersion: randomUUID() };
}

async function verifyPassword(password, savedHash) {
  const [salt, keyHex] = savedHash.split(":");
  const savedKey = Buffer.from(keyHex, "hex");
  const enteredKey = await deriveKey(password, salt, savedKey.length);
  return timingSafeEqual(savedKey, enteredKey);
}

// Ограничиваем подбор по IP и телефону. Записи попыток исчезают после окна.
function countLoginAttempt(ip, phone) {
  const now = Date.now();
  const key = `${ip}:${phone}`;
  const last = loginAttempts.get(key);
  const attempts = last?.expiresAt > now ? last : { count: 0, expiresAt: now + loginWindow };
  if (attempts.count >= 10) throw error(429, "Слишком много попыток. Попробуйте через несколько минут");
  attempts.count += 1;
  loginAttempts.set(key, attempts);
  return key;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of loginAttempts) {
    if (attempts.expiresAt <= now) loginAttempts.delete(key);
  }
}, loginWindow).unref();

export async function login(req, res) {
  const phone = normalizePhone(req.body.phone);
  const { password } = req.body;
  if (!phone || !isPassword(password)) throw error(401, "Неверный телефон или пароль");
  const attempt = countLoginAttempt(req.ip, phone);
  const teacher = isAdminPhone(phone) ? null : await Teacher.findOne({ phone }).select("+passwordHash +authVersion");
  const teacherPasswordValid = await verifyPassword(password, teacher?.passwordHash ?? dummyHash);
  const adminPasswordValid = timingSafeEqual(Buffer.from(hash(password), "hex"), Buffer.from(adminPasswordHash, "hex"));
  const isAdmin = isAdminPhone(phone) && adminPasswordValid;
  if (!isAdmin && !(teacher && teacherPasswordValid)) throw error(401, "Неверный телефон или пароль");

  const user = isAdmin ? adminUser : teacherUser(teacher);
  const token = randomBytes(32).toString("base64url");
  await Session.create({
    tokenHash: hash(token),
    role: user.role,
    teacherId: teacher?._id,
    authVersion: isAdmin ? adminAuthVersion : teacher.authVersion,
    expiresAt: new Date(Date.now() + sessionDuration),
  });
  loginAttempts.delete(attempt);
  res.json({ token, user });
}

export async function requireSession(req, _res, next) {
  const token = req.get("Authorization")?.match(/^Bearer ([\w-]{43})$/i)?.[1];
  if (!token) throw error(401, "Войдите в журнал");
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
  if (!session) throw error(401, "Сеанс завершён. Войдите снова");

  if (session.role === "admin" && session.authVersion === adminAuthVersion) {
    req.user = adminUser;
  } else if (session.role === "teacher") {
    const teacher = await Teacher.findById(session.teacherId).select("+authVersion");
    if (teacher?.authVersion === session.authVersion) req.user = teacherUser(teacher);
  }

  if (!req.user) throw error(401, "Сеанс завершён. Войдите снова");
  req.sessionId = session._id;
  req.authVersion = session.authVersion;
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user.role !== "admin") throw error(403, "Это действие доступно администратору");
  next();
}

export async function logout(req, res) {
  await Session.deleteOne({ _id: req.sessionId });
  res.status(204).end();
}

export const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const schoolCalendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bishkek", year: "numeric", month: "2-digit", day: "2-digit",
});

export function today(date = new Date()) {
  const parts = Object.fromEntries(schoolCalendar.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function monthOf(date) {
  const [year, month] = date.split("-").map(Number);
  return { y: year, m: month - 1 };
}

// "2026-11-06" -> "06.11.2026"
export const fmtDate = (s) => (s ? s.split("-").reverse().join(".") : "");

// ISO-время с сервера -> "06.11.2026 14:32" (по местному времени)
export function fmtDT(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Запись правили после создания? (допуск 2 секунды)
export const wasEdited = (o) => Boolean(o?.updatedAt && o?.createdAt && new Date(o.updatedAt) - new Date(o.createdAt) > 2000);

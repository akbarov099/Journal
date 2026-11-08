import { WD } from "./constants";

export const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());

// Даты уроков группы в месяце, по дням недели группы
export function lessonsFor(g, ym) {
  const out = [];
  const n = new Date(ym.y, ym.m + 1, 0).getDate();
  for (let d = 1; d <= n; d++) {
    const dt = new Date(ym.y, ym.m, d);
    if (g.days.includes(dt.getDay()) && iso(dt) >= g.start) out.push({ date: iso(dt), wd: WD[dt.getDay()], day: d });
  }
  return out;
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

// Время урока группы: "14:00–15:30" (или только начало / пустая строка)
export function fmtTime(g) {
  if (!g?.timeStart) return "";
  return g.timeEnd ? `${g.timeStart}–${g.timeEnd}` : g.timeStart;
}

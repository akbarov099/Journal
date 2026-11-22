import { WD } from "@/shared/lib/constants.js";
import { iso } from "@/shared/lib/dates.js";

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

// Время урока группы: "14:00–15:30" (или только начало / пустая строка)
export function fmtTime(g) {
  if (!g?.timeStart) return "";
  return g.timeEnd ? `${g.timeStart}–${g.timeEnd}` : g.timeStart;
}

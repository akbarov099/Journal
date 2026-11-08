import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX } from "../lib/constants";
import { lessonsFor } from "../lib/dates";
import { api } from "../lib/api";

const GKEY = "journal-group";
const keyOf = (sid, date) => `${sid}|${date}`;
const toMap = (list) =>
  Object.fromEntries(list.map((r) => [keyOf(r.studentId, r.date), { a: r.a ?? null, hw: r.hw ?? null, cw: r.cw ?? null }]));
const fio = (st) => `${st.last} ${st.first}`;
// Старый сервер (без поля времени) молча отбрасывает его — предупредим, а не промолчим
const timeDropped = (form, g) => Boolean(form.timeStart && g.timeStart !== form.timeStart);
const STALE = "Время урока не сохранилось: перезапустите server (остановите и снова запустите npm run dev в папке server).";
const EMPTY_ARCHIVE = { groups: [], students: [] };

export default function useJournal() {
  const [s, setS] = useState({ groups: [], students: [], records: {}, archive: EMPTY_ARCHIVE, groupId: null });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false); // первая загрузка не удалась
  const [toasts, setToasts] = useState([]); // [{ id, type: "success" | "error" | "info", text }]
  const n = new Date();
  const [ym, setYm] = useState({ y: n.getFullYear(), m: n.getMonth() });
  const seq = useRef(0);

  // ---------- уведомления ----------
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback((type, text) => {
    const id = ++seq.current;
    // одинаковое сообщение не дублируем (например, при быстрых правках без сети)
    setToasts((t) => [...t.filter((x) => x.text !== text), { id, type, text }].slice(-4));
    setTimeout(() => dismiss(id), type === "error" ? 7000 : 3800);
  }, [dismiss]);
  const ok = (text) => notify("success", text);
  const info = (text) => notify("info", text);
  const bad = (e, what) => notify("error", e?.offline ? `${e.message}. ${what} — не сохранено.` : `${what}: ${e?.message || "ошибка"}`);

  // ---------- загрузка ----------
  const refresh = useCallback(async ({ silent = false } = {}) => {
    try {
      const d = await api.state();
      let saved = null;
      try { saved = localStorage.getItem(GKEY); } catch { /* ignore */ }
      setS((p) => {
        const want = p.groupId || saved;
        const groupId = d.groups.some((g) => g.id === want) ? want : d.groups[0]?.id ?? null;
        return { groups: d.groups, students: d.students, records: toMap(d.records), archive: d.archive || EMPTY_ARCHIVE, groupId };
      });
      setOffline(false);
      return true;
    } catch (e) {
      setOffline(true);
      if (!silent) notify("error", e?.offline ? "Нет связи с сервером. Проверьте, что запущены server и MongoDB." : `Не удалось загрузить данные: ${e.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { refresh(); }, [refresh]);

  // ---------- производные данные ----------
  const group = s.groups.find((g) => g.id === s.groupId) || s.groups[0] || null;
  const lessons = useMemo(() => (group ? lessonsFor(group, ym) : []), [group, ym]);
  const students = useMemo(
    () => (group ? s.students.filter((x) => x.groupId === group.id).sort((a, b) => a.last.localeCompare(b.last, "ru")) : []),
    [s.students, group]
  );

  // ---------- отметки и баллы (оптимистично, с откатом при ошибке) ----------
  const rec = (sid, date) => s.records[keyOf(sid, date)] || {};

  const revert = (entries) =>
    setS((p) => {
      const records = { ...p.records };
      entries.forEach(([k, prev]) => { if (prev === undefined) delete records[k]; else records[k] = prev; });
      return { ...p, records };
    });

  const setRec = (sid, date, patch) => {
    const k = keyOf(sid, date);
    const prev = s.records[k];
    setS((p) => ({ ...p, records: { ...p.records, [k]: { ...p.records[k], ...patch } } }));
    api.setRecord({ studentId: sid, date, patch }).catch((e) => {
      revert([[k, prev]]);
      bad(e, "Отметка");
      if (!e.offline) refresh({ silent: true });
    });
  };

  // Клик по отметке: пусто -> пришёл -> не пришёл -> пусто
  const cycle = (sid, date) => {
    const a = rec(sid, date).a;
    const next = !a ? "p" : a === "p" ? "a" : null;
    setRec(sid, date, next === "a" ? { a: next, hw: null, cw: null } : { a: next });
  };

  const score = (sid, date, field, raw) => {
    const v = raw === "" ? null : Math.max(0, Math.min(MAX, Math.round(Number(raw))));
    setRec(sid, date, { [field]: Number.isNaN(v) ? null : v });
  };

  const markAll = (date) => {
    const ids = students.filter((st) => st.joined <= date).map((st) => st.id);
    if (!ids.length) return;
    const prevs = ids.map((id) => [keyOf(id, date), s.records[keyOf(id, date)]]);
    setS((p) => {
      const records = { ...p.records };
      ids.forEach((id) => { records[keyOf(id, date)] = { ...records[keyOf(id, date)], a: "p" }; });
      return { ...p, records };
    });
    api.bulk({ studentIds: ids, date, patch: { a: "p" } })
      .then(() => ok(`Все ученики (${ids.length}) отмечены как пришедшие`))
      .catch((e) => { revert(prevs); bad(e, "Массовая отметка"); });
  };

  // ---------- статистика ----------
  const stats = (sid) => {
    let marked = 0, present = 0, pts = 0;
    lessons.forEach((l) => {
      const r = rec(sid, l.date);
      if (r.a) marked++;
      if (r.a === "p") present++;
      pts += (r.hw || 0) + (r.cw || 0);
    });
    return { pct: marked ? Math.round((present / marked) * 100) : null, pts, max: present * MAX * 2 };
  };

  // Баллы ученика за всё время (по всем месяцам)
  const total = (sid) => {
    let pts = 0, present = 0;
    const prefix = `${sid}|`;
    for (const k in s.records) {
      if (!k.startsWith(prefix)) continue;
      const r = s.records[k];
      pts += (r.hw || 0) + (r.cw || 0);
      if (r.a === "p") present++;
    }
    return { pts, max: present * MAX * 2 };
  };

  // Сводка по каждой группе за месяц на экране
  const overview = useMemo(
    () =>
      s.groups.map((g) => {
        const sts = s.students.filter((x) => x.groupId === g.id);
        let marked = 0, present = 0;
        lessonsFor(g, ym).forEach((l) =>
          sts.forEach((st) => {
            const a = (s.records[keyOf(st.id, l.date)] || {}).a;
            if (a) marked++;
            if (a === "p") present++;
          })
        );
        return { g, count: sts.length, pct: marked ? Math.round((present / marked) * 100) : null };
      }),
    [s, ym]
  );

  const find = (q) => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return s.students
      .filter((x) => fio(x).toLowerCase().includes(t))
      .slice(0, 6)
      .map((x) => ({ ...x, g: s.groups.find((g) => g.id === x.groupId) }));
  };

  const shiftMonth = (d) => setYm((p) => { const x = new Date(p.y, p.m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const selectGroup = (id) => {
    setS((p) => ({ ...p, groupId: id }));
    try { localStorage.setItem(GKEY, id); } catch { /* ignore */ }
  };

  // ---------- ученики ----------
  const addStudent = async (form) => {
    if (!group || !form.last.trim() || !form.first.trim()) return false;
    try {
      const st = await api.addStudent({ ...form, groupId: group.id, last: form.last.trim(), first: form.first.trim() });
      setS((p) => ({ ...p, students: [...p.students, st] }));
      ok(`Ученик «${fio(st)}» добавлен в группу «${group.name}»`);
      return true;
    } catch (e) {
      bad(e, "Не удалось добавить ученика");
      return false;
    }
  };

  const updateStudent = async (id, form) => {
    if (!form.last.trim() || !form.first.trim()) return false;
    try {
      const st = await api.updateStudent(id, { ...form, last: form.last.trim(), first: form.first.trim() });
      setS((p) => ({ ...p, students: p.students.map((x) => (x.id === id ? st : x)) }));
      const moved = s.groups.find((g) => g.id === st.groupId);
      ok(`Данные ученика «${fio(st)}» изменены${moved && moved.id !== group?.id ? ` (теперь в группе «${moved.name}»)` : ""}`);
      return true;
    } catch (e) {
      bad(e, "Не удалось сохранить ученика");
      return false;
    }
  };

  const removeStudent = async (id) => {
    const st = s.students.find((x) => x.id === id);
    try {
      await api.deleteStudent(id);
      await refresh({ silent: true });
      ok(`Ученик «${st ? fio(st) : ""}» перенесён в архив`);
    } catch (e) {
      bad(e, "Не удалось удалить ученика");
    }
  };

  // ---------- группы ----------
  const addGroup = async (form) => {
    if (!form.name.trim() || !form.days.length) return false;
    try {
      const g = await api.addGroup({ name: form.name.trim(), days: form.days, start: form.start, timeStart: form.timeStart, timeEnd: form.timeEnd, color: form.color });
      setS((p) => ({ ...p, groups: [...p.groups, g], groupId: g.id }));
      try { localStorage.setItem(GKEY, g.id); } catch { /* ignore */ }
      if (timeDropped(form, g)) notify("error", STALE); else ok(`Группа «${g.name}» создана`);
      return true;
    } catch (e) {
      bad(e, "Не удалось создать группу");
      return false;
    }
  };

  const updateGroup = async (id, form) => {
    if (!form.name.trim() || !form.days.length) return false;
    try {
      const g = await api.updateGroup(id, { name: form.name.trim(), days: form.days, start: form.start, timeStart: form.timeStart, timeEnd: form.timeEnd, color: form.color });
      setS((p) => ({ ...p, groups: p.groups.map((x) => (x.id === id ? g : x)) }));
      if (timeDropped(form, g)) notify("error", STALE); else ok(`Группа «${g.name}» изменена`);
      return true;
    } catch (e) {
      bad(e, "Не удалось сохранить группу");
      return false;
    }
  };

  const removeGroup = async () => {
    if (!group) return;
    const name = group.name;
    try {
      const r = await api.deleteGroup(group.id);
      await refresh({ silent: true });
      ok(`Группа «${name}» перенесена в архив${r?.archivedStudents ? ` вместе с учениками (${r.archivedStudents})` : ""}`);
    } catch (e) {
      bad(e, "Не удалось удалить группу");
    }
  };

  // ---------- архив ----------
  const restoreGroup = async (g) => {
    try {
      const r = await api.restoreGroup(g.id);
      await refresh({ silent: true });
      selectGroup(g.id);
      ok(`Группа «${g.name}» восстановлена${r?.restoredStudents ? ` (учеников: ${r.restoredStudents})` : ""}`);
    } catch (e) {
      bad(e, "Не удалось восстановить группу");
    }
  };

  const restoreStudent = async (st) => {
    try {
      await api.restoreStudent(st.id);
      await refresh({ silent: true });
      ok(`Ученик «${fio(st)}» восстановлен в группу «${st.groupName}»`);
    } catch (e) {
      bad(e, "Не удалось восстановить ученика");
    }
  };

  const purgeGroup = async (g) => {
    try {
      await api.purgeGroup(g.id);
      await refresh({ silent: true });
      ok(`Группа «${g.name}» удалена навсегда`);
    } catch (e) {
      bad(e, "Не удалось удалить группу");
    }
  };

  const purgeStudent = async (st) => {
    try {
      await api.purgeStudent(st.id);
      await refresh({ silent: true });
      ok(`Ученик «${fio(st)}» удалён навсегда`);
    } catch (e) {
      bad(e, "Не удалось удалить ученика");
    }
  };

  const clearArchive = async () => {
    try {
      const r = await api.clearArchive();
      await refresh({ silent: true });
      ok(`Архив очищен: групп — ${r.groups}, учеников — ${r.students}`);
    } catch (e) {
      bad(e, "Не удалось очистить архив");
    }
  };

  return {
    loading, offline, retry: () => refresh(), toasts, dismiss, info,
    groups: s.groups, group, lessons, students, ym, overview, archive: s.archive, rec, stats, total, find,
    shiftMonth, selectGroup, cycle, score, markAll,
    addStudent, updateStudent, removeStudent, addGroup, updateGroup, removeGroup,
    restoreGroup, restoreStudent, purgeGroup, purgeStudent, clearArchive,
  };
}

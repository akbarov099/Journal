import { Fragment, useEffect, useRef } from "react";
import { FiCheck, FiCheckCircle, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import { formatPhone, normalizePhone } from "@/shared/lib/phone.js";
import { MONTHS } from "@/shared/lib/constants.js";
import { MAX } from "@/entities/journal-record";
import { fmtDate, pad } from "@/shared/lib/dates.js";
import { StudentProfileButton } from "@/entities/student";

function Contact({ value }) {
  const phone = normalizePhone(value);
  const label = formatPhone(value) || "—";
  return phone ? <a href={`tel:${phone}`}>{label}</a> : label;
}

function LessonScore({ value, disabled, label, onChange }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX}
      disabled={disabled}
      className="journal-grade"
      data-full={value === MAX || undefined}
      style={{ "--grade": value ?? 0 }}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    />
  );
}

export default function JournalTable({ lessons, students, ym, contacts, rec, stats, total, onCycle, onScore, onMarkAll, onRemove, onEdit, onProfile, focusDate, focusVersion }) {
  const scrollRef = useRef(null);
  const rows = students.map((st) => ({ t: stats(st.id), all: total(st.id) }));
  const sumMonth = rows.reduce((a, r) => a + r.t.pts, 0);
  const sumAll = rows.reduce((a, r) => a + r.all.pts, 0);
  const pcts = rows.map((r) => r.t.pct).filter((p) => p !== null);
  const avg = pcts.length ? Math.round(pcts.reduce((a, p) => a + p, 0) / pcts.length) : null;
  const rowSpan = lessons.length ? 2 : 1;
  const detailColumns = lessons.length * 3 + (contacts ? 2 : 0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!focusDate || !container?.clientWidth) return;
    const header = [...container.querySelectorAll("th[data-lesson-date]")].find((cell) => cell.dataset.lessonDate === focusDate);
    if (!header) return;
    const pinned = container.querySelector("thead .journal-grid-student");
    const offset = header.getBoundingClientRect().left - container.getBoundingClientRect().left;
    container.scrollLeft += offset - container.clientLeft - pinned.offsetWidth;
  }, [focusDate, focusVersion, lessons]);

  return (
    <div ref={scrollRef} className="journal-table-shell" role="region" aria-label={`Журнал за ${MONTHS[ym.m]} ${ym.y}`} tabIndex={0}>
      {!students.length && <p className="journal-grid-empty">В этой группе пока нет учеников.</p>}
      <table className="journal-grid">
        <thead>
          <tr>
            <th className="journal-grid-student" scope="col" rowSpan={rowSpan}>Ученик</th>
            <th className="journal-grid-month-points" scope="col" rowSpan={rowSpan}>Баллы за месяц</th>
            {contacts && <th scope="col" rowSpan={rowSpan}>Телефон</th>}
            {contacts && <th scope="col" rowSpan={rowSpan}>Телефон родителей</th>}
            {lessons.map((l) => (
              <th key={l.date} colSpan={3} className="journal-lesson-start" data-lesson-date={l.date} aria-current={l.date === focusDate ? "date" : undefined}>
                <div className="journal-lesson-date"><b>{pad(l.day)}</b><span>{l.wd}</span></div>
                <button type="button" className="journal-mark-all" onClick={() => onMarkAll(l.date)} title="Отметить всех пришедшими"><FiCheckCircle /> все</button>
              </th>
            ))}
            <th scope="col" rowSpan={rowSpan} title="Посещаемость">Посещ.</th>
            <th scope="col" rowSpan={rowSpan}>Баллы всего</th>
          </tr>
          {lessons.length > 0 && (
            <tr>
              {lessons.map((l) => (
                <Fragment key={l.date}>
                  <th className="journal-lesson-start" scope="col">Был</th>
                  <th scope="col" title="Домашнее задание">ДЗ</th>
                  <th scope="col" title="Классная работа">Кл.</th>
                </Fragment>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {students.map((st, i) => {
            const t = rows[i].t;
            const all = rows[i].all;
            return (
              <tr key={st.id}>
                <th className="journal-grid-student" scope="row">
                  <div className="journal-student">
                    <span className="journal-student-avatar" aria-hidden="true">{st.last[0]}{st.first[0]}</span>
                    <span className="journal-student-name">
                      <StudentProfileButton student={st} onProfile={onProfile} />
                      <small>с {fmtDate(st.joined)}</small>
                    </span>
                    {(onEdit || onRemove) && <span className="journal-student-actions">
                      {onEdit && <button type="button" onClick={() => onEdit(st)} aria-label="Изменить ученика" title="Изменить"><FiEdit2 /></button>}
                      {onRemove && <button type="button" onClick={() => onRemove(st.id)} aria-label="Удалить ученика" title="Удалить"><FiTrash2 /></button>}
                    </span>}
                  </div>
                </th>
                <td className="journal-grid-month-points">
                  <b>{t.pts}{t.max ? <small>/{t.max}</small> : null}</b>
                  <small>ДЗ {t.hw} · Кл. {t.cw}</small>
                </td>
                {contacts && <td className="journal-grid-contact"><Contact value={st.phone} /></td>}
                {contacts && <td className="journal-grid-contact"><Contact value={st.parent} /></td>}
                {lessons.map((l) => {
                  const r = rec(st.id, l.date);
                  const before = st.joined > l.date;
                  const off = before || r.a !== "p";
                  return (
                    <Fragment key={l.date}>
                      <td className="journal-lesson-start journal-lesson-cell">
                        <button type="button" className="journal-attendance" data-attendance={r.a || undefined} disabled={before} onClick={() => onCycle(st.id, l.date)} aria-label="Посещаемость">
                          {r.a === "p" ? <FiCheck /> : r.a === "a" ? <FiX /> : null}
                        </button>
                      </td>
                      <td className="journal-lesson-cell">
                        <LessonScore value={r.hw} disabled={off} label="Домашнее задание" onChange={(value) => onScore(st.id, l.date, "hw", value)} />
                      </td>
                      <td className="journal-lesson-cell">
                        <LessonScore value={r.cw} disabled={off} label="Классная работа" onChange={(value) => onScore(st.id, l.date, "cw", value)} />
                      </td>
                    </Fragment>
                  );
                })}
                <td className="journal-grid-stat">
                  <b>{t.pct === null ? "—" : `${t.pct}%`}</b>
                  {t.pct !== null && <span className="journal-attendance-bar" aria-hidden="true" style={{ "--percent": `${t.pct}%` }} />}
                </td>
                <td className="journal-grid-stat journal-grid-total-points"><b>{all.pts}{all.max ? <small>/{all.max}</small> : null}</b></td>
              </tr>
            );
          })}
        </tbody>
        {students.length > 0 && (
          <tfoot>
            <tr>
              <th className="journal-grid-student" scope="row">Итого по группе</th>
              <td className="journal-grid-month-points">{sumMonth}</td>
              {detailColumns > 0 && <td colSpan={detailColumns} />}
              <td>{avg === null ? "—" : `${avg}%`}</td>
              <td>{sumAll}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

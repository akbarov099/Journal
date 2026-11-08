import { Fragment } from "react";
import { FiCheck, FiCheckCircle, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import { MAX } from "../lib/constants";
import { fmtDate, pad } from "../lib/dates";

const tint = (v) => (v == null || v === MAX ? undefined : { background: `hsl(var(--h) calc(95% * var(--s)) calc(var(--l) * 1%) / ${0.1 + v * 0.08})` });

export default function JournalTable({ lessons, students, ym, contacts, rec, stats, total, onCycle, onScore, onMarkAll, onRemove, onEdit }) {
  const rows = students.map((st) => ({ t: stats(st.id), all: total(st.id) }));
  const sumMonth = rows.reduce((a, r) => a + r.t.pts, 0);
  const sumAll = rows.reduce((a, r) => a + r.all.pts, 0);
  const pcts = rows.map((r) => r.t.pct).filter((p) => p !== null);
  const avg = pcts.length ? Math.round(pcts.reduce((a, p) => a + p, 0) / pcts.length) : null;

  return (
    <div className="wrap">
      <table>
        <thead>
          <tr>
            <th className="sticky name" rowSpan={2}>Ученик</th>
            {contacts && <th rowSpan={2}>Телефон</th>}
            {contacts && <th rowSpan={2}>Телефон родителей</th>}
            {lessons.map((l) => (
              <th key={l.date} colSpan={3} className="lesson">
                <span className="dt"><b>{pad(l.day)}</b><em>{l.wd}</em></span>
                <button className="all" onClick={() => onMarkAll(l.date)} title="Отметить всех пришедшими"><FiCheckCircle /> все</button>
              </th>
            ))}
            <th rowSpan={2}>Посещ.</th>
            <th rowSpan={2}>Баллы за месяц</th>
            <th rowSpan={2}>Баллы всего</th>
          </tr>
          <tr>
            {lessons.map((l) => (
              <Fragment key={l.date}>
                <th className="sub">Был</th>
                <th className="sub">ДЗ</th>
                <th className="sub">Кл.</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((st, i) => {
            const t = rows[i].t;
            const all = rows[i].all;
            return (
              <tr key={st.id}>
                <td className="sticky name">
                  <span className="av">{st.last[0]}{st.first[0]}</span>
                  <span className="who">
                    <span className="fio">{st.last} {st.first}</span>
                    <small>с {fmtDate(st.joined)}</small>
                  </span>
                  <span className="acts">
                    <button onClick={() => onEdit(st)} aria-label="Изменить ученика" title="Изменить"><FiEdit2 /></button>
                    <button onClick={() => onRemove(st.id)} aria-label="Удалить ученика" title="Удалить"><FiTrash2 /></button>
                  </span>
                </td>
                {contacts && <td><a href={`tel:${st.phone}`}>{st.phone || "—"}</a></td>}
                {contacts && <td><a href={`tel:${st.parent}`}>{st.parent || "—"}</a></td>}
                {lessons.map((l) => {
                  const r = rec(st.id, l.date);
                  const before = st.joined > l.date;
                  const off = before || r.a !== "p";
                  return (
                    <Fragment key={l.date}>
                      <td className={`att ${before ? "pre" : r.a || ""}`}>
                        <button disabled={before} onClick={() => onCycle(st.id, l.date)} aria-label="Посещаемость">
                          {r.a === "p" ? <FiCheck /> : r.a === "a" ? <FiX /> : null}
                        </button>
                      </td>
                      <td className={off ? "pre" : ""}>
                        <input type="number" min={0} max={MAX} className={r.hw === MAX ? "top" : ""} style={tint(r.hw)} disabled={off} value={r.hw ?? ""} onChange={(e) => onScore(st.id, l.date, "hw", e.target.value)} aria-label="Домашнее задание" />
                      </td>
                      <td className={off ? "pre" : ""}>
                        <input type="number" min={0} max={MAX} className={r.cw === MAX ? "top" : ""} style={tint(r.cw)} disabled={off} value={r.cw ?? ""} onChange={(e) => onScore(st.id, l.date, "cw", e.target.value)} aria-label="Классная работа" />
                      </td>
                    </Fragment>
                  );
                })}
                <td className="sum"><b>{t.pct === null ? "—" : `${t.pct}%`}</b><i className="bar" style={{ "--p": t.pct ?? 0 }} /></td>
                <td className="sum">{t.pts}{t.max ? <small>/{t.max}</small> : null}</td>
                <td className="sum all">{all.pts}{all.max ? <small>/{all.max}</small> : null}</td>
              </tr>
            );
          })}
          {!students.length && <tr><td className="empty" colSpan={20}>В этой группе пока нет учеников. Нажмите «+ Ученик», чтобы добавить первого.</td></tr>}
        </tbody>
        {students.length > 0 && (
          <tfoot>
            <tr>
              <td className="sticky name">Итого по группе</td>
              {(contacts || lessons.length > 0) && <td colSpan={(contacts ? 2 : 0) + lessons.length * 3} />}
              <td className="sum">{avg === null ? "—" : `${avg}%`}</td>
              <td className="sum">{sumMonth}</td>
              <td className="sum">{sumAll}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

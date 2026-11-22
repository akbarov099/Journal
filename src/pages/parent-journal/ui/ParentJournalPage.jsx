import { useEffect, useState } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiLink2, FiRefreshCw, FiUsers } from "react-icons/fi";
import { MONTHS } from "@/shared/lib/constants.js";
import { fmtDate } from "@/shared/lib/dates.js";
import { Brand } from "@/shared/ui/brand";
import { readParentJournal } from "../api/publicJournal.js";
import "./parent-journal.scss";

function adjacentMonth(month, direction) {
  const [year, value] = month.split("-").map(Number);
  const index = year * 12 + value - 1 + direction;
  const nextYear = Math.floor(index / 12);
  if (nextYear < 0 || nextYear > 9999) return null;
  return `${String(nextYear).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
}

function MonthNavigator({ month, setMonth }) {
  const [year, value] = month.split("-");
  const previous = adjacentMonth(month, -1);
  const next = adjacentMonth(month, 1);

  return (
    <div className="parent-journal__month" role="group" aria-label="Выбор месяца">
      <button type="button" aria-label="Предыдущий месяц" disabled={!previous} onClick={() => setMonth(previous)}><FiChevronLeft aria-hidden="true" /></button>
      <strong aria-live="polite"><FiCalendar aria-hidden="true" /> {MONTHS[Number(value) - 1]} {year}</strong>
      <button type="button" aria-label="Следующий месяц" disabled={!next} onClick={() => setMonth(next)}><FiChevronRight aria-hidden="true" /></button>
    </div>
  );
}

function Roster({ students }) {
  return (
    <ul className="parent-journal__roster" role="list" aria-label="Ученики группы">
      {students.map(({ label, hw, cw, total, present, absent, lessons = [] }, index) => {
        const marked = present + absent;
        return (
          <li key={`${label}-${index}`} className="parent-journal__student">
            <div className="parent-journal__student-name">
              <span aria-hidden="true">{label.charAt(0).toUpperCase()}</span>
              <h3>{label}</h3>
            </div>
            <dl className="parent-journal__metrics">
              <div>
                <dt>Посещено</dt>
                <dd>{marked > 0 ? <>{present} <small>из {marked}</small></> : "—"}</dd>
              </div>
              <div><dt>Домашняя работа</dt><dd>{hw}</dd></div>
              <div><dt>Классная работа</dt><dd>{cw}</dd></div>
              <div className="parent-journal__total"><dt>Всего баллов</dt><dd>{total}</dd></div>
            </dl>
            {lessons.length > 0 && (
              <details>
                <summary>Баллы по дням</summary>
                <ul>
                  {lessons.map(({ date, hw, cw }) => (
                    <li key={date}>
                      <time dateTime={date}>{fmtDate(date)}</time>
                      {" · ДЗ "}{hw ?? "—"}{" · Классная работа "}{cw ?? "—"}
                      {" · Итого "}{(hw ?? 0) + (cw ?? 0)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ParentJournalPage({ groupId, token }) {
  const [month, setMonth] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const validLink = Boolean(groupId && token);
  const current = result && result.groupId === groupId && result.token === token ? result : null;
  const loading = validLink && (!current || current.month !== month || current.attempt !== attempt);
  const inactive = !validLink || (!loading && current?.inactive);
  const failed = !loading && current?.failed;
  const data = inactive ? null : current?.data;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Журнал для родителей · Билим Нуру";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (!validLink) return;
    const controller = new AbortController();
    const request = { groupId, token, month, attempt };
    readParentJournal({ ...request, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setResult({ ...request, ...response });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResult((previous) => ({
          ...request,
          failed: true,
          data: previous?.groupId === groupId && previous.token === token ? previous.data : null,
        }));
      });
    return () => controller.abort();
  }, [groupId, token, month, attempt, validLink]);

  return (
    <div className="parent-journal">
      <header className="parent-journal__header">
        <div className="parent-journal__header-inner">
          <Brand variant="compact" />
          <span className="parent-journal__header-label">Журнал для родителей</span>
        </div>
      </header>
      <main className="parent-journal__main">
        <div className="parent-journal__cover">
          <h1>{data?.group.name ?? "Журнал группы"}</h1>
          {data && <MonthNavigator month={month || data.month} setMonth={setMonth} />}
        </div>
        {loading ? (
          <div className="parent-journal__state parent-journal__loading" role="status">
            <span className="parent-journal__spinner" aria-hidden="true" /> Загрузка журнала…
          </div>
        ) : inactive ? (
          <div className="parent-journal__state" role="alert">
            <FiLink2 aria-hidden="true" />
            <div><strong>Ссылка недоступна</strong><p>Уточните актуальную ссылку у преподавателя.</p></div>
          </div>
        ) : failed ? (
          <div className="parent-journal__state" role="alert">
            <div><strong>Не удалось загрузить журнал</strong><p>Проверьте подключение к интернету.</p></div>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}><FiRefreshCw aria-hidden="true" /> Повторить</button>
          </div>
        ) : (
          <section className="parent-journal__scores" aria-label="Итоги месяца">
            <div className="parent-journal__scores-heading">
              <h2>Итоги месяца</h2>
              {data.students.length > 0 && <span><FiUsers aria-hidden="true" /> Учеников {data.students.length}</span>}
            </div>
            {data.students.length ? <Roster students={data.students} /> : <div className="parent-journal__state">В группе пока нет учеников.</div>}
          </section>
        )}
      </main>
    </div>
  );
}

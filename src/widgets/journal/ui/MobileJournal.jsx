import { useEffect, useState } from "react";
import { FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import { formatPhone, normalizePhone } from "@/shared/lib/phone.js";
import { MAX } from "@/entities/journal-record";
import { fmtDate, today } from "@/shared/lib/dates.js";
import { StudentProfileButton } from "@/entities/student";
import "./mobile-journal.scss";

function initialLesson(lessons) {
  const now = today();
  const upcoming = lessons.findIndex((lesson) => lesson.date > now);
  const index = upcoming === -1 ? lessons.length - 1 : Math.max(0, upcoming - 1);
  return lessons[index]?.date || "";
}

function Contact({ label, phone }) {
  const normalized = normalizePhone(phone);
  return <span>{label} {normalized ? <a href={`tel:${normalized}`}>{formatPhone(normalized)}</a> : <b>{phone || "—"}</b>}</span>;
}

export default function MobileJournal({ lessons, students, contacts, rec, stats, total, onCycle, onScore, onMarkAll, onRemove, onEdit, onProfile, focusDate, focusVersion }) {
  const [selected, setSelected] = useState(() => initialLesson(lessons));
  const [summary, setSummary] = useState(false);
  const lessonDate = lessons.some((lesson) => lesson.date === selected) ? selected : initialLesson(lessons);
  const lessonIndex = lessons.findIndex((lesson) => lesson.date === lessonDate);
  const hasLesson = lessonIndex >= 0;

  useEffect(() => {
    if (!focusDate || !lessons.some((lesson) => lesson.date === focusDate)) return;
    setSelected(focusDate);
    setSummary(false);
  }, [focusDate, focusVersion, lessons]);

  return (
    <section className="mobile-journal" aria-label="Журнал группы">
      <div className="journal-switch" aria-label="Вид журнала">
        <button type="button" aria-pressed={!summary} onClick={() => setSummary(false)}>Урок</button>
        <button type="button" aria-pressed={summary} onClick={() => setSummary(true)}>Итоги месяца</button>
      </div>
      {!summary && (hasLesson ? (
        <div className="daily-controls" data-lesson-date={lessonDate}>
          <div className="daily-date">
            <button type="button" aria-label="Предыдущий урок" disabled={lessonIndex === 0}
              onClick={() => setSelected(lessons[lessonIndex - 1].date)}><FiChevronLeft /></button>
            <select aria-label="Дата урока" value={lessonDate} onChange={(event) => setSelected(event.target.value)}>
              {lessons.map((lesson) => <option value={lesson.date} key={lesson.date}>{lesson.wd}, {fmtDate(lesson.date)}</option>)}
            </select>
            <button type="button" aria-label="Следующий урок" disabled={lessonIndex === lessons.length - 1}
              onClick={() => setSelected(lessons[lessonIndex + 1].date)}><FiChevronRight /></button>
          </div>
          <button type="button" className="mark-day" disabled={!students.some((student) => student.joined <= lessonDate)} onClick={() => onMarkAll(lessonDate)}>
            <FiCheckCircle /> Отметить всех пришедшими
          </button>
        </div>
      ) : <p className="mobile-note">В выбранном месяце нет уроков.</p>)}
      {summary && students.length > 0 && <p className="mobile-month-total">Баллы группы за месяц <strong>{students.reduce((points, student) => points + stats(student.id).pts, 0)}</strong></p>}
      {!students.length && <p className="mobile-note">В группе пока нет учеников. Нажмите «Ученик», чтобы добавить первого.</p>}
      <ul className="mobile-students">
        {students.map((student) => (
          <li key={student.id}>
            <header className="mobile-student-heading">
              <div className="mobile-student-identity">
                <span className="mobile-initials" aria-hidden="true">{student.last[0]}{student.first[0]}</span>
                <div>
                  <StudentProfileButton student={student} onProfile={onProfile} />
                  <small>с {fmtDate(student.joined)}</small>
                </div>
              </div>
              {(onEdit || onRemove) && <div className="mobile-student-actions">
                {onEdit && <button type="button" onClick={() => onEdit(student)} aria-label="Изменить ученика"><FiEdit2 /></button>}
                {onRemove && <button type="button" onClick={() => onRemove(student.id)} aria-label="Удалить ученика"><FiTrash2 /></button>}
              </div>}
            </header>
            {contacts && <div className="mobile-contacts">
              <Contact label="Ученик" phone={student.phone} />
              <Contact label="Родители" phone={student.parent} />
            </div>}
            {summary ? (
              <StudentSummary monthly={stats(student.id)} overall={total(student.id)} />
            ) : hasLesson && (student.joined > lessonDate ? <p className="mobile-note">До зачисления</p> : (
              <LessonFields student={student} date={lessonDate} record={rec(student.id, lessonDate)} onCycle={onCycle} onScore={onScore} />
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudentSummary({ monthly, overall }) {
  return (
    <dl className="mobile-stats">
      <div><dt>За месяц</dt><dd>{monthly.pts}{monthly.max ? `/${monthly.max}` : ""}</dd></div>
      <div><dt>Посещаемость</dt><dd>{monthly.pct === null ? "—" : `${monthly.pct}%`}</dd></div>
      <div><dt>Домашние задания</dt><dd>{monthly.hw}</dd></div>
      <div><dt>Классная работа</dt><dd>{monthly.cw}</dd></div>
      <div><dt>За всё время</dt><dd>{overall.pts}{overall.max ? `/${overall.max}` : ""}</dd></div>
    </dl>
  );
}

function LessonFields({ student, date, record, onCycle, onScore }) {
  const present = record.a === "p";
  const absent = record.a === "a";
  const attendance = present ? "Присутствует" : absent ? "Отсутствует" : "Не отмечен";
  const lessonPoints = record.hw == null && record.cw == null ? "—" : (record.hw || 0) + (record.cw || 0);
  const disabled = !present;

  return (
    <div className="daily-student">
      <button type="button" className={`daily-attendance${present ? " present" : absent ? " absent" : ""}`}
        onClick={() => onCycle(student.id, date)} aria-label={`Посещаемость: ${attendance}`}>
        {present ? <FiCheck /> : absent ? <FiX /> : null}{attendance}
      </button>
      <label title="Домашнее задание">ДЗ
        <input type="number" inputMode="numeric" min={0} max={MAX} disabled={disabled} value={record.hw ?? ""}
          onChange={(event) => onScore(student.id, date, "hw", event.target.value)} />
      </label>
      <label title="Классная работа">Кл.
        <input type="number" inputMode="numeric" min={0} max={MAX} disabled={disabled} value={record.cw ?? ""}
          onChange={(event) => onScore(student.id, date, "cw", event.target.value)} />
      </label>
      <div className="daily-total">Сумма<strong>{lessonPoints}</strong></div>
    </div>
  );
}

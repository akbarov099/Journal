import { useId, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { formatPhone, normalizePhone } from "@/shared/lib/phone.js";
import { MONTHS } from "@/shared/lib/constants.js";
import { fmtDate, today } from "@/shared/lib/dates.js";
import { attendanceRate, EMPTY_RESULTS } from "@/entities/journal-record/@x/student.js";
import Modal from "@/shared/ui/Modal.jsx";
import "./student-profile.scss";

const SHORT_MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_PER_PERIOD = 12;

function monthIndex(date) {
  const match = date?.match(/^(\d{4})-(0[1-9]|1[0-2])(?:-|$)/);
  return match ? Number(match[1]) * MONTHS_PER_PERIOD + Number(match[2]) - 1 : null;
}

function monthLabel(index) {
  const month = index % MONTHS_PER_PERIOD;
  return `${MONTHS[month]} ${Math.floor(index / MONTHS_PER_PERIOD)}`;
}

function Contact({ value }) {
  const phone = normalizePhone(value);
  return phone ? <a href={`tel:${phone}`}>{formatPhone(phone)}</a> : value || "—";
}

function Percent({ result }) {
  const rate = attendanceRate(result);
  return rate === null ? "—" : `${rate}%`;
}

export function StudentProfileButton({ student, onProfile }) {
  const name = `${student.last} ${student.first}`;
  if (!onProfile) return <strong>{name}</strong>;
  return (
    <button type="button" className="journal-profile-trigger" aria-haspopup="dialog" aria-label={`Карточка ученика ${name}`} onClick={() => onProfile(student.id)}>
      <span>{name}</span><FiChevronRight aria-hidden="true" />
    </button>
  );
}

export default function StudentProfile({ student, group, history = [], total = EMPTY_RESULTS, onClose }) {
  const [period, setPeriod] = useState(0);
  const headingId = useId();
  const currentMonth = monthIndex(today());
  const joinedMonth = monthIndex(student.joined) ?? currentMonth;
  const records = new Map();
  let firstMonth = Math.min(currentMonth, joinedMonth);
  let latestMonth = currentMonth;

  for (const result of history) {
    const index = monthIndex(result.month);
    if (index === null) continue;
    records.set(index, result);
    firstMonth = Math.min(firstMonth, index);
    latestMonth = Math.max(latestMonth, index);
  }

  const end = Math.max(firstMonth, latestMonth - period * MONTHS_PER_PERIOD);
  const start = Math.max(firstMonth, end - MONTHS_PER_PERIOD + 1);
  const months = Array.from({ length: end - start + 1 }, (_, offset) => ({ index: start + offset, result: records.get(start + offset) }));
  const recordedMonths = months.filter(({ result }) => result);
  const chartMax = Math.max(1, ...recordedMonths.map(({ result }) => result.pts));

  return (
    <Modal title={`${student.last} ${student.first}`} color={group?.color} wide onClose={onClose}>
      <div className="student-profile">
        <dl className="profile-details">
          <div><dt>Группа</dt><dd>{group?.name || "—"}</dd></div>
          <div><dt>Дата зачисления</dt><dd>{fmtDate(student.joined) || "—"}</dd></div>
          <div><dt>Телефон ученика</dt><dd><Contact value={student.phone} /></dd></div>
          <div><dt>Телефон родителей</dt><dd><Contact value={student.parent} /></dd></div>
        </dl>
        <dl className="profile-overview">
          <div><dt>Баллы за всё время</dt><dd>{total.pts}{total.max ? <small>/{total.max}</small> : null}</dd></div>
          <div><dt>Посещаемость за всё время</dt><dd><Percent result={total} /></dd></div>
          <div><dt>Посещено из отмеченных</dt><dd>{total.present}<small>/{total.marked}</small></dd></div>
        </dl>
        <section className="profile-history" aria-labelledby={headingId}>
          <h4 id={headingId}>История по месяцам</h4>
          {records.size ? (
            <>
              <div className="profile-period">
                <button type="button" aria-label="Предыдущие месяцы" disabled={start === firstMonth} onClick={() => setPeriod((value) => value + 1)}><FiChevronLeft /></button>
                <strong aria-live="polite">{monthLabel(start)}{start === end ? "" : ` – ${monthLabel(end)}`}</strong>
                <button type="button" aria-label="Следующие месяцы" disabled={period === 0} onClick={() => setPeriod((value) => value - 1)}><FiChevronRight /></button>
              </div>
              {recordedMonths.length > 0 ? (
                <>
                  <div className="profile-trend" role="img" aria-label="График баллов по месяцам. Значения приведены в таблице ниже.">
                    <ol aria-hidden="true" style={{ "--months": months.length }}>
                      {months.map(({ index, result }) => (
                        <li key={index} title={`${monthLabel(index)} · ${result?.pts ?? "—"}`} data-latest={index === end || undefined}>
                          <span>{result?.pts ?? "—"}</span>
                          <span className="profile-trend-track" style={{ "--height": `${(result?.pts ?? 0) * 100 / chartMax}%` }} />
                          <small>{SHORT_MONTHS[index % MONTHS_PER_PERIOD]}</small>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="profile-results-wrap" role="region" aria-label="Баллы и посещаемость по месяцам" tabIndex={0}>
                    <table className="profile-results">
                      <thead>
                        <tr>
                          <th scope="col">Месяц</th>
                          <th scope="col"><abbr title="Домашние задания">ДЗ</abbr></th>
                          <th scope="col"><abbr title="Классная работа">Кл.</abbr></th>
                          <th scope="col">Баллы</th>
                          <th scope="col"><abbr title="Посещаемость">Посещ.</abbr></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recordedMonths.reverse().map(({ index, result }) => (
                          <tr key={index}>
                            <th scope="row">{monthLabel(index)}</th>
                            <td>{result.hw}</td>
                            <td>{result.cw}</td>
                            <td><strong>{result.pts}</strong>{result.max ? <small>/{result.max}</small> : null}</td>
                            <td><Percent result={result} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <p className="profile-no-history">За этот период отметок нет.</p>}
            </>
          ) : <p className="profile-no-history">Для ученика пока нет отметок и баллов.</p>}
        </section>
      </div>
    </Modal>
  );
}

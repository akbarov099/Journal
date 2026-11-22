import { useEffect, useState } from "react";
import { FiArrowUpRight, FiCalendar } from "react-icons/fi";
import { colorVars } from "@/shared/lib/colors.js";
import { today } from "@/shared/lib/dates.js";
import { fmtTime, getDayLessons } from "@/entities/group";
import "./today-lessons.scss";

const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

export default function TodayLessons({ groups, onOpen }) {
  const [date, setDate] = useState(today);
  const lessons = getDayLessons(groups, date);

  useEffect(() => {
    const updateDate = () => setDate(today());
    const interval = setInterval(updateDate, 60_000);
    window.addEventListener("focus", updateDate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", updateDate);
    };
  }, []);

  return (
    <section className="today-lessons" aria-labelledby="today-lessons-title">
      <header>
        <h2 id="today-lessons-title"><FiCalendar aria-hidden="true" /> Уроки сегодня</h2>
        <time dateTime={date}>{dateLabel.format(new Date(`${date}T00:00:00Z`))}</time>
      </header>
      {lessons.length ? (
        <ul aria-label="Занятия по расписанию">
          {lessons.map((group) => (
            <li key={group.id}>
              <button type="button" style={colorVars(group.color)} onClick={() => onOpen(group.id, date)} title={group.name}>
                <span>
                  <strong>{group.name}</strong>
                  <small>{fmtTime(group) || "Время не указано"}</small>
                </span>
                <FiArrowUpRight aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p>Сегодня занятий нет.</p>}
    </section>
  );
}

import { FiChevronLeft, FiClock, FiChevronRight, FiEdit2, FiPhone, FiTrash2, FiUser, FiUserPlus } from "react-icons/fi";
import { MONTHS, WD } from "@/shared/lib/constants.js";
import { fmtTime } from "@/entities/group";
import "./journal.scss";

export default function GroupHeader({ group, ym, contacts, teacherName, reportActions, onShift, onContacts, onRemove, onAddStudent, onEdit }) {
  const time = fmtTime(group);

  return (
    <header className="journal-hero">
      <div className="journal-hero-cover">
        <div className="journal-hero-heading">
          <h2>{group.name}</h2>
          <div className="journal-hero-details">
            <ul className="journal-weekdays" aria-label="Дни занятий">
              {group.days.map((day) => <li key={day}>{WD[day]}</li>)}
            </ul>
            {time && <span><FiClock aria-hidden="true" /> {time}</span>}
            {teacherName && <span><FiUser aria-hidden="true" /> {teacherName}</span>}
          </div>
        </div>
        <div className="journal-month">
          <button type="button" onClick={() => onShift(-1)} aria-label="Предыдущий месяц"><FiChevronLeft /></button>
          <strong aria-live="polite">{MONTHS[ym.m]} {ym.y}</strong>
          <button type="button" onClick={() => onShift(1)} aria-label="Следующий месяц"><FiChevronRight /></button>
        </div>
      </div>
      <div className="journal-hero-actions">
        {onAddStudent && <button type="button" className="journal-add-student" onClick={onAddStudent}><FiUserPlus /> Ученик</button>}
        <button type="button" onClick={() => onContacts(!contacts)} aria-pressed={contacts}>
          <FiPhone /> Контакты
        </button>
        {reportActions}
        {onEdit && <button type="button" className="journal-edit-group" onClick={onEdit}><FiEdit2 /> Изменить</button>}
        {onRemove && <button type="button" className="journal-remove-group" onClick={onRemove}><FiTrash2 /> Удалить группу</button>}
      </div>
    </header>
  );
}

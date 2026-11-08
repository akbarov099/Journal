import { FiChevronLeft, FiClock, FiChevronRight, FiEdit2, FiPhone, FiTrash2, FiUserPlus } from "react-icons/fi";
import { MONTHS, WD } from "../lib/constants";
import { fmtTime } from "../lib/dates";

export default function GroupHeader({ group, ym, contacts, onShift, onContacts, onRemove, onAddStudent, onEdit }) {
  return (
    <div className="banner">
      <div>
        <h2>{group.name}</h2>
        <div className="chips">
          {group.days.map((d) => <span key={d}>{WD[d]}</span>)}
          {fmtTime(group) && <span className="time"><FiClock /> {fmtTime(group)}</span>}
        </div>
      </div>
      <div className="banner__settings">
        <div className="month">
          <button onClick={() => onShift(-1)} aria-label="Предыдущий месяц"><FiChevronLeft /></button>
          <strong>{MONTHS[ym.m]} {ym.y}</strong>
          <button onClick={() => onShift(1)} aria-label="Следующий месяц"><FiChevronRight /></button>
        </div>
        <button className="primary" onClick={onAddStudent}><FiUserPlus /> Ученик</button>
        <button className={`toggle${contacts ? " on" : ""}`} onClick={() => onContacts(!contacts)} aria-pressed={contacts}>
          <FiPhone /> Контакты
        </button>
        <button onClick={onEdit}><FiEdit2 /> Изменить</button>
        <button className="ghost" onClick={onRemove}><FiTrash2 /> Удалить группу</button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { FiCheck } from "react-icons/fi";
import { WD } from "@/shared/lib/constants.js";
import { COLORS, COLOR_KEYS, colorVars } from "@/shared/lib/colors.js";
import { today } from "@/shared/lib/dates.js";
import Modal from "@/shared/ui/Modal.jsx";
import "./group-form.scss";

export default function GroupForm({ group, color: initial, teachers, onAdd, onClose }) {
  const [f, setF] = useState(
    group
      ? { name: group.name, days: group.days, start: group.start, timeStart: group.timeStart || "", timeEnd: group.timeEnd || "", color: COLORS[group.color] ? group.color : "lightblue", teacherId: group.teacherId || "" }
      : { name: "", days: [1, 3, 5], start: today(), timeStart: "", timeEnd: "", color: initial || "lightblue" }
  );
  const [pending, setPending] = useState(false);
  const toggle = (d) => setF((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d] }));
  const timeOk = !f.timeStart || !f.timeEnd || f.timeEnd > f.timeStart;
  const ready = f.name.trim() && f.days.length && timeOk;
  const submit = async (event) => {
    event.preventDefault();
    if (!ready || pending) return;
    setPending(true);
    const { teacherId, ...details } = f;
    const form = teachers ? { ...details, teacherId: teacherId || null } : details;
    if (await onAdd(form)) onClose();
    else setPending(false);
  };

  return (
    <Modal title={group ? "Редактировать группу" : "Новая группа"} color={f.color} onClose={onClose}>
      <form className="grid" onSubmit={submit}>
        <label className="fld"><span>Название группы</span><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label className="fld"><span>Начало занятий</span><input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required /></label>
        {teachers && <label className="fld wide">
          <span>Преподаватель</span>
          <select aria-label="Преподаватель" value={f.teacherId || ""} onChange={(e) => setF({ ...f, teacherId: e.target.value })}>
            <option value="">Без преподавателя</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </select>
        </label>}
        <div className="fld wide">
          <span>Время урока (с — до)</span>
          <div className="times">
            <input type="time" aria-label="Начало урока" value={f.timeStart} onChange={(e) => setF({ ...f, timeStart: e.target.value })} />
            <em>—</em>
            <input type="time" aria-label="Конец урока" value={f.timeEnd} onChange={(e) => setF({ ...f, timeEnd: e.target.value })} />
          </div>
          {!timeOk && <small className="err">Конец урока должен быть позже начала</small>}
        </div>
        <div className="fld wide">
          <span>Дни занятий</span>
          <div className="days">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <label key={d} className={`day${f.days.includes(d) ? " on" : ""}`}>
                <input type="checkbox" checked={f.days.includes(d)} onChange={() => toggle(d)} />
                {f.days.includes(d) && <FiCheck />}{WD[d]}
              </label>
            ))}
          </div>
        </div>
        <div className="fld wide">
          <span>Цвет группы: {COLORS[f.color].name}</span>
          <div className="swatches" role="group" aria-label="Цвет группы">
            {COLOR_KEYS.map((k) => (
              <button key={k} type="button" className={`sw${f.color === k ? " on" : ""}`} style={colorVars(k)}
                onClick={() => setF({ ...f, color: k })} title={COLORS[k].name} aria-label={COLORS[k].name} aria-pressed={f.color === k}>{f.color === k && <FiCheck />}</button>
            ))}
          </div>
        </div>
        <div className="mfoot wide">
          <button type="button" onClick={onClose}>Отмена</button>
          <button className="primary" type="submit" disabled={!ready || pending}>{pending ? "Сохранение…" : group ? "Сохранить" : "Создать группу"}</button>
        </div>
      </form>
    </Modal>
  );
}

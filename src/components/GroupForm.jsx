import { useState } from "react";
import { FiCheck } from "react-icons/fi";
import { WD } from "../lib/constants";
import { COLORS, COLOR_KEYS, colorVars } from "../lib/colors";
import { today } from "../lib/dates";
import Modal from "./Modal";

export default function GroupForm({ group, color: initial, onAdd, onClose }) {
  const [f, setF] = useState(
    group
      ? { name: group.name, days: group.days, start: group.start, timeStart: group.timeStart || "", timeEnd: group.timeEnd || "", color: group.color || initial }
      : { name: "", days: [1, 3, 5], start: today(), timeStart: "", timeEnd: "", color: initial }
  );
  const toggle = (d) => setF((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d] }));
  const timeOk = !f.timeStart || !f.timeEnd || f.timeEnd > f.timeStart;
  const ready = f.name.trim() && f.days.length && timeOk;
  const submit = async () => { if (ready && (await onAdd(f))) onClose(); };
  const onKey = (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") submit(); };

  return (
    <Modal title={group ? "Редактировать группу" : "Новая группа"} color={f.color} onClose={onClose}>
      <div className="grid" onKeyDown={onKey}>
        <label className="fld"><span>Название группы</span><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="fld"><span>Начало занятий</span><input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
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
          <div className="swatches">
            {COLOR_KEYS.map((k) => (
              <button key={k} type="button" className={`sw${f.color === k ? " on" : ""}`} style={colorVars(k)}
                onClick={() => setF({ ...f, color: k })} aria-label={COLORS[k].name} aria-pressed={f.color === k}>{f.color === k && <FiCheck />}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="mfoot">
        <button onClick={onClose}>Отмена</button>
        <button className="primary" onClick={submit} disabled={!ready}>{group ? "Сохранить" : "Создать группу"}</button>
      </div>
    </Modal>
  );
}

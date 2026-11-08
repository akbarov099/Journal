import { useState } from "react";
import { today } from "../lib/dates";
import Modal from "./Modal";

export default function StudentForm({ student, groups = [], groupName, color, onAdd, onClose }) {
  const [f, setF] = useState(
    student
      ? { last: student.last, first: student.first, phone: student.phone || "", parent: student.parent || "", joined: student.joined, groupId: student.groupId }
      : { last: "", first: "", phone: "", parent: "", joined: today() }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ready = f.last.trim() && f.first.trim();
  const submit = async () => { if (ready && (await onAdd(f))) onClose(); };
  const onKey = (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") submit(); };

  return (
    <Modal title={student ? "Редактировать ученика" : `Новый ученик: ${groupName}`} color={color} onClose={onClose}>
      <div className="grid" onKeyDown={onKey}>
        <label className="fld"><span>Фамилия</span><input autoFocus value={f.last} onChange={set("last")} /></label>
        <label className="fld"><span>Имя</span><input value={f.first} onChange={set("first")} /></label>
        <label className="fld"><span>Телефон ученика</span><input type="tel" value={f.phone} onChange={set("phone")} /></label>
        <label className="fld"><span>Телефон родителей</span><input type="tel" value={f.parent} onChange={set("parent")} /></label>
        <label className="fld"><span>Дата прихода</span><input type="date" value={f.joined} onChange={set("joined")} /></label>
        {student && (
          <label className="fld">
            <span>Группа</span>
            <select value={f.groupId} onChange={set("groupId")}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="mfoot">
        <button onClick={onClose}>Отмена</button>
        <button className="primary" onClick={submit} disabled={!ready}>{student ? "Сохранить" : "Добавить ученика"}</button>
      </div>
    </Modal>
  );
}

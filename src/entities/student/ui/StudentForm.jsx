import { useState } from "react";
import { formatPhone, normalizePhone } from "@/shared/lib/phone.js";
import { today } from "@/shared/lib/dates.js";
import Modal from "@/shared/ui/Modal.jsx";
import PhoneInput from "@/shared/ui/PhoneInput.jsx";

export default function StudentForm({ student, groups = [], groupName, color, onAdd, onClose }) {
  const [pending, setPending] = useState(false);
  const [f, setF] = useState(
    student
      ? { last: student.last, first: student.first, phone: formatPhone(student.phone), parent: formatPhone(student.parent), joined: student.joined, groupId: student.groupId }
      : { last: "", first: "", phone: "", parent: "", joined: today() }
  );
  const set = (k) => (value) => setF((current) => ({ ...current, [k]: value }));
  const onInput = (k) => (event) => set(k)(event.target.value);
  const phone = normalizePhone(f.phone) ?? (f.phone === student?.phone ? f.phone : null);
  const parent = normalizePhone(f.parent) ?? (f.parent === student?.parent ? f.parent : null);
  const ready = f.last.trim() && f.first.trim() && phone !== null && parent !== null;
  const submit = async (event) => {
    event.preventDefault();
    if (!ready || pending) return;
    setPending(true);
    if (await onAdd({ ...f, phone, parent })) onClose();
    else setPending(false);
  };

  return (
    <Modal title={student ? "Редактировать ученика" : `Новый ученик: ${groupName}`} color={color} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid">
          <label className="fld"><span>Фамилия</span><input autoFocus value={f.last} onChange={onInput("last")} maxLength={60} required /></label>
          <label className="fld"><span>Имя</span><input value={f.first} onChange={onInput("first")} maxLength={60} required /></label>
          <label className="fld"><span>Телефон ученика</span><PhoneInput value={f.phone} previousValue={student?.phone} onValueChange={set("phone")} /></label>
          <label className="fld"><span>Телефон родителей</span><PhoneInput value={f.parent} previousValue={student?.parent} onValueChange={set("parent")} /></label>
          <label className="fld"><span>Дата прихода</span><input type="date" value={f.joined} onChange={onInput("joined")} required /></label>
          {student && (
            <label className="fld">
              <span>Группа</span>
              <select value={f.groupId} onChange={onInput("groupId")}>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="mfoot">
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="submit" className="primary" disabled={!ready || pending}>{pending ? "Сохранение…" : student ? "Сохранить" : "Добавить ученика"}</button>
        </div>
      </form>
    </Modal>
  );
}

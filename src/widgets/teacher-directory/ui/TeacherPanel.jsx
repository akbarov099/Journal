import { useState } from "react";
import { FiArrowUpRight, FiBookOpen, FiEdit2, FiPhone, FiTrash2, FiUserCheck, FiUserPlus, FiUsers } from "react-icons/fi";
import { formatPhone, normalizePhone } from "@/shared/lib/phone.js";
import Modal from "@/shared/ui/Modal.jsx";
import PhoneInput from "@/shared/ui/PhoneInput.jsx";
import "./teacher-directory.scss";

export function TeacherPanel({ teachers, groups, onAdd, onEdit, onRemove, onGroup }) {
  const unassigned = groups.filter((group) => !group.teacherId);
  const activeStudents = teachers.reduce((count, teacher) => count + teacher.studentCount, 0);

  return (
    <section className="teachers teacher-directory" aria-labelledby="teachers-title">
      <header className="teachers-heading">
        <h1 id="teachers-title">Преподаватели</h1>
        <button type="button" className="primary" onClick={onAdd}><FiUserPlus /> Добавить преподавателя</button>
      </header>
      <dl className="teacher-overview" aria-label="Сводка по преподавателям">
        <OverviewMetric icon={FiUsers} label="В команде" value={teachers.length} />
        <OverviewMetric icon={FiBookOpen} label="Групп в журнале" value={groups.length} />
        <OverviewMetric icon={FiUserCheck} label="Ученики" value={activeStudents} />
      </dl>
      {teachers.length === 0 && <p className="teachers-empty">Добавьте преподавателя, чтобы назначить ему группу и выдать доступ к журналу.</p>}
      <div className="teacher-grid">
        {teachers.map((teacher) => (
          <article className="teacher-card" key={teacher.id}>
            <header>
              <div className="teacher-person">
                <span className="teacher-avatar" aria-hidden="true">{teacher.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
                <div>
                  <h2>{teacher.name}</h2>
                  <a href={`tel:${teacher.phone}`}><FiPhone aria-hidden="true" />{formatPhone(teacher.phone)}</a>
                </div>
              </div>
              <div className="teacher-actions">
                <button type="button" onClick={() => onEdit(teacher)} aria-label={`Изменить преподавателя ${teacher.name}`} title="Изменить"><FiEdit2 /></button>
                <button type="button" onClick={() => onRemove(teacher)} aria-label={`Удалить преподавателя ${teacher.name}`} title="Удалить"><FiTrash2 /></button>
              </div>
            </header>
            <div className="teacher-metrics">
              <span><FiBookOpen /> Группы <strong>{teacher.groupCount}</strong></span>
              <span><FiUsers /> Ученики <strong>{teacher.studentCount}</strong></span>
            </div>
            <TeacherGroups groups={groups.filter((group) => group.teacherId === teacher.id)} onGroup={onGroup} />
          </article>
        ))}
        {unassigned.length > 0 && (
          <article className="teacher-card teacher-card-unassigned">
            <header><h2>Группы без преподавателя</h2><span className="teacher-unassigned-count">{unassigned.length}</span></header>
            <TeacherGroups groups={unassigned} onGroup={onGroup} />
          </article>
        )}
      </div>
    </section>
  );
}

function OverviewMetric({ icon: Icon, label, value }) {
  return (
    <div className="teacher-overview-metric">
      <dt>{label}</dt>
      <dd>{value}<span aria-hidden="true"><Icon /></span></dd>
    </div>
  );
}

function TeacherGroups({ groups, onGroup }) {
  if (!groups.length) return <p className="teacher-no-groups">Нет активных групп</p>;
  return (
    <ul className="teacher-groups">
      {groups.map((group) => (
        <li key={group.id}>
          <button type="button" onClick={() => onGroup(group.id)}>
            <span>{group.name}</span><FiArrowUpRight />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TeacherForm({ teacher, onSave, onClose }) {
  const [name, setName] = useState(teacher?.name || "");
  const [phone, setPhone] = useState(teacher?.phone ? formatPhone(teacher.phone) : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const trimmed = name.trim();
    const normalized = normalizePhone(phone);
    if (!trimmed || (password && !password.trim())) {
      setError(!trimmed ? "Введите имя преподавателя." : "Пароль не может состоять только из пробелов.");
      return;
    }
    if (!normalized) return;
    setError("");
    setPending(true);
    const body = { name: trimmed, phone: normalized };
    if (password) body.password = password;
    if (await onSave(body)) onClose();
    else setPending(false);
  }

  return (
    <Modal title={teacher ? "Редактировать преподавателя" : "Новый преподаватель"} onClose={onClose}>
      <form className="teacher-form" onSubmit={submit}>
        <label className="fld"><span>Имя и фамилия</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required autoFocus /></label>
        <label className="fld"><span>Номер телефона</span><PhoneInput value={phone} onValueChange={setPhone} autoComplete="off" required /></label>
        <label className="fld">
          <span>{teacher ? "Новый пароль" : "Пароль"}</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required={!teacher}
            minLength={8} maxLength={128} placeholder={teacher ? "Укажите для смены пароля" : "Минимум 8 символов"} />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="mfoot">
          <button type="button" onClick={onClose}>Отмена</button>
          <button className="primary" type="submit" disabled={pending}>{pending ? "Сохранение…" : teacher ? "Сохранить" : "Добавить"}</button>
        </div>
      </form>
    </Modal>
  );
}

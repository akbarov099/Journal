import { useState } from "react";
import { FiArchive, FiRotateCcw, FiTrash2, FiXCircle } from "react-icons/fi";
import { colorVars } from "../lib/colors";
import { fmtDT } from "../lib/dates";
import Modal from "./Modal";

const MAX_NAMES = 8;

export default function ArchiveModal({ archive, color, ask, onRestoreGroup, onRestoreStudent, onPurgeGroup, onPurgeStudent, onClear, onClose }) {
  const [tab, setTab] = useState("groups");
  const gCount = archive.groups.length;
  const sCount = archive.students.length;
  const inGroups = archive.groups.reduce((a, g) => a + g.students.length, 0);
  const empty = !gCount && !sCount;

  const clear = () =>
    ask({
      title: "Очистить архив?",
      text: `Будут безвозвратно удалены: группы — ${gCount}, ученики — ${sCount + inGroups} и все их отметки и баллы. Это действие нельзя отменить.`,
      yes: "Очистить полностью",
      danger: true,
      onYes: onClear,
    });

  const purgeGroup = (g) =>
    ask({
      title: "Удалить группу навсегда?",
      text: `Группа «${g.name}»${g.students.length ? ` и её ученики (${g.students.length})` : ""} будут удалены безвозвратно вместе с отметками и баллами.`,
      yes: "Удалить навсегда",
      danger: true,
      onYes: () => onPurgeGroup(g),
    });

  const purgeStudent = (st) =>
    ask({
      title: "Удалить ученика навсегда?",
      text: `«${st.last} ${st.first}» (группа «${st.groupName}») будет удалён безвозвратно вместе с отметками и баллами.`,
      yes: "Удалить навсегда",
      danger: true,
      onYes: () => onPurgeStudent(st),
    });

  return (
    <Modal title="Архив" color={color} wide onClose={onClose}>
      <div className="arch-top">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "groups"} className={tab === "groups" ? "on" : ""} onClick={() => setTab("groups")}>Группы · {gCount}</button>
          <button role="tab" aria-selected={tab === "students"} className={tab === "students" ? "on" : ""} onClick={() => setTab("students")}>Ученики · {sCount}</button>
        </div>
        <button className="danger" onClick={clear} disabled={empty}><FiXCircle /> Очистить архив</button>
      </div>

      <div className="arch-list">
        {tab === "groups" && archive.groups.map((g) => (
          <div key={g.id} className="acard" style={colorVars(g.color)}>
            <span className="adot" />
            <div className="ainfo">
              <b>{g.name}</b>
              <small>Удалена {fmtDT(g.deletedAt)} · учеников: {g.students.length}</small>
              {g.students.length > 0 && (
                <small className="names">
                  {g.students.slice(0, MAX_NAMES).map((s) => `${s.last} ${s.first}`).join(", ")}
                  {g.students.length > MAX_NAMES ? ` и ещё ${g.students.length - MAX_NAMES}` : ""}
                </small>
              )}
            </div>
            <div className="aacts">
              <button onClick={() => onRestoreGroup(g)}><FiRotateCcw /> Восстановить</button>
              <button className="icon-danger" onClick={() => purgeGroup(g)} aria-label="Удалить навсегда" title="Удалить навсегда"><FiTrash2 /></button>
            </div>
          </div>
        ))}

        {tab === "students" && archive.students.map((st) => (
          <div key={st.id} className="acard">
            <span className="av">{st.last[0]}{st.first[0]}</span>
            <div className="ainfo">
              <b>{st.last} {st.first}</b>
              <small>Группа: {st.groupName}{st.groupArchived ? " (в архиве)" : ""} · удалён {fmtDT(st.deletedAt)}</small>
              {st.groupArchived && <small className="warn">Сначала восстановите группу</small>}
            </div>
            <div className="aacts">
              <button onClick={() => onRestoreStudent(st)} disabled={st.groupArchived}><FiRotateCcw /> Восстановить</button>
              <button className="icon-danger" onClick={() => purgeStudent(st)} aria-label="Удалить навсегда" title="Удалить навсегда"><FiTrash2 /></button>
            </div>
          </div>
        ))}

        {((tab === "groups" && !gCount) || (tab === "students" && !sCount)) && (
          <div className="arch-empty"><FiArchive /><p>{tab === "groups" ? "Удалённых групп нет" : "Удалённых учеников нет"}</p></div>
        )}
      </div>
    </Modal>
  );
}

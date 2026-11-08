import { useState } from "react";
import { FiWifiOff } from "react-icons/fi";
import useJournal from "./hooks/useJournal";
import Sidebar from "./components/Sidebar";
import GroupHeader from "./components/GroupHeader";
import JournalTable from "./components/JournalTable";
import StudentForm from "./components/StudentForm";
import GroupForm from "./components/GroupForm";
import ArchiveModal from "./components/ArchiveModal";
import Confirm from "./components/Confirm";
import Toasts from "./components/Toasts";
import { MAX } from "./lib/constants";
import { COLOR_KEYS, colorVars } from "./lib/colors";

export default function App() {
  const j = useJournal();
  const [contacts, setContacts] = useState(false);
  const [modal, setModal] = useState(null); // "student" | "group" | "editGroup" | "archive" | null
  const [editStudent, setEditStudent] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, text, yes, danger, onYes }
  const close = () => setModal(null);
  const color = j.group?.color;
  const archiveCount = j.archive.groups.length + j.archive.students.length;

  const askRemoveGroup = () =>
    setConfirm({
      title: "Удалить группу?",
      text: `Группа «${j.group.name}» вместе с учениками (${j.students.length}) будет перенесена в архив. Её можно будет восстановить.`,
      yes: "В архив",
      danger: true,
      onYes: j.removeGroup,
    });

  const askRemoveStudent = (id) => {
    const st = j.students.find((x) => x.id === id);
    setConfirm({
      title: "Удалить ученика?",
      text: `«${st?.last} ${st?.first}» будет перенесён в архив вместе с отметками и баллами. Его можно будет восстановить.`,
      yes: "В архив",
      danger: true,
      onYes: () => j.removeStudent(id),
    });
  };

  return (
    <div className="jr" style={colorVars(color)}>
      <Sidebar
        overview={j.overview} groupId={j.group?.id} find={j.find} archiveCount={archiveCount}
        onSelect={j.selectGroup} onNewGroup={() => setModal("group")} onArchive={() => setModal("archive")}
      />
      {j.loading ? (
        <main><div className="state">Загрузка…</div></main>
      ) : j.offline && !j.groups.length && !archiveCount ? (
        <main>
          <div className="state">
            <FiWifiOff size={36} />
            <p>Нет связи с сервером.<br />Проверьте, что запущены server и MongoDB.</p>
            <button className="primary" onClick={j.retry}>Повторить</button>
          </div>
        </main>
      ) : !j.group ? (
        <main>
          {j.offline && <div className="offline"><FiWifiOff /> Нет связи с сервером <button onClick={j.retry}>Повторить</button></div>}
          <div className="state">
            <p>{archiveCount ? "Активных групп нет. Удалённые группы лежат в архиве." : "Групп пока нет."}</p>
            <button className="primary" onClick={() => setModal("group")}>Создать группу</button>
          </div>
        </main>
      ) : (
        <main>
          {j.offline && <div className="offline"><FiWifiOff /> Нет связи с сервером — изменения не сохраняются <button onClick={j.retry}>Повторить</button></div>}
          <GroupHeader
            group={j.group} ym={j.ym} contacts={contacts}
            onShift={j.shiftMonth} onContacts={setContacts} onRemove={askRemoveGroup} onAddStudent={() => setModal("student")} onEdit={() => setModal("editGroup")}
          />
          <JournalTable
            lessons={j.lessons} students={j.students} ym={j.ym} contacts={contacts} rec={j.rec} stats={j.stats} total={j.total}
            onCycle={j.cycle} onScore={j.score} onMarkAll={j.markAll} onRemove={askRemoveStudent} onEdit={setEditStudent}
          />
          <p className="legend">Клик по кружку: галочка — пришёл, крестик — не пришёл, пусто — не отмечено. Баллы за ДЗ и классную работу: от 0 до {MAX}.</p>
        </main>
      )}

      {modal === "student" && j.group && <StudentForm groupName={j.group.name} color={color} onAdd={j.addStudent} onClose={close} />}
      {modal === "editGroup" && j.group && <GroupForm group={j.group} onAdd={(f) => j.updateGroup(j.group.id, f)} onClose={close} />}
      {editStudent && (
        <StudentForm student={editStudent} groups={j.groups} color={color}
          onAdd={(f) => j.updateStudent(editStudent.id, f)} onClose={() => setEditStudent(null)} />
      )}
      {modal === "group" && <GroupForm color={COLOR_KEYS[j.groups.length % COLOR_KEYS.length]} onAdd={j.addGroup} onClose={close} />}
      {modal === "archive" && (
        <ArchiveModal
          archive={j.archive} color={color} ask={setConfirm} onClose={close}
          onRestoreGroup={j.restoreGroup} onRestoreStudent={j.restoreStudent}
          onPurgeGroup={j.purgeGroup} onPurgeStudent={j.purgeStudent} onClear={j.clearArchive}
        />
      )}
      {confirm && <Confirm cfg={confirm} color={color} onClose={() => setConfirm(null)} />}
      <Toasts items={j.toasts} onDismiss={j.dismiss} />
    </div>
  );
}

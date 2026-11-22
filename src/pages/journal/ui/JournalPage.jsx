import { useCallback, useEffect, useRef, useState } from "react";
import { FiActivity, FiBookOpen, FiDownload, FiLink2, FiLogOut, FiRefreshCw, FiTrash2, FiUsers, FiWifiOff } from "react-icons/fi";
import useJournal from "../model/useJournal.js";
import { journalActivityKey, readActivities } from "../model/activity.js";
import { Sidebar } from "@/widgets/group-sidebar";
import { GroupHeader, JournalTable, MobileJournal } from "@/widgets/journal";
import { TeacherForm, TeacherPanel } from "@/widgets/teacher-directory";
import { TodayLessons } from "@/widgets/today-lessons";
import { StudentForm, StudentProfile } from "@/entities/student";
import { GroupForm } from "@/entities/group";
import { MAX } from "@/entities/journal-record";
import { ExcelSync } from "@/features/excel-sync";
import { ArchiveModal } from "@/features/archive";
import { ParentLinkDialog } from "@/features/parent-link";
import { downloadMonthlyReport } from "@/features/excel-report";
import { Brand } from "@/shared/ui/brand";
import Confirm from "@/shared/ui/Confirm.jsx";
import Modal from "@/shared/ui/Modal.jsx";
import Toasts from "@/shared/ui/Toasts.jsx";
import { writeSession } from "@/shared/lib/sessionStorage.js";
import { COLOR_KEYS, colorVars } from "@/shared/lib/colors.js";
import "./journal-page.scss";

export default function JournalPage({ api, user, onLogout }) {
  const activityKey = journalActivityKey(user.id);
  const [activities, setActivities] = useState(() => readActivities(activityKey));
  const recordActivity = useCallback((message) => {
    const record = { id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), message };
    setActivities((previous) => [record, ...previous].slice(0, 150));
  }, []);
  useEffect(() => { writeSession(activityKey, activities.length ? JSON.stringify(activities) : ""); }, [activities, activityKey]);

  const j = useJournal(api, user.id, recordActivity);
  const admin = user.role === "admin";
  const [page, setPage] = useState("journal");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contacts, setContacts] = useState(false);
  const [modal, setModal] = useState(null);
  const [editStudent, setEditStudent] = useState(null);
  const [profileStudentId, setProfileStudentId] = useState(null);
  const [editTeacher, setEditTeacher] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [lessonFocus, setLessonFocus] = useState(null);
  const [exporting, setExporting] = useState(false);
  const lessonJump = useRef(0);
  const journalDestination = useRef(null);
  const close = () => setModal(null);
  const color = j.group?.color;
  const archiveCount = j.archive.groups.length + j.archive.students.length;
  const groupTeacher = j.teachers.find((teacher) => teacher.id === j.group?.teacherId);
  const teacherPage = admin && page === "teachers";
  const canRemoveGroup = admin || (!j.group?.studentCount && j.students.length === 0);
  const profileStudent = j.allStudents.find(({ id }) => id === profileStudentId);
  const profileGroup = j.groups.find(({ id }) => id === profileStudent?.groupId);
  const focusDate = lessonFocus?.groupId === j.group?.id ? lessonFocus?.date : undefined;

  useEffect(() => {
    if (focusDate) journalDestination.current?.scrollIntoView({ block: "start" });
  }, [focusDate, lessonFocus?.version]);

  function selectGroup(id) {
    setLessonFocus(null);
    j.selectGroup(id);
    setPage("journal");
  }

  function openLesson(groupId, date) {
    j.selectGroup(groupId);
    j.goToDate(date);
    setLessonFocus({ groupId, date, version: ++lessonJump.current });
  }

  function openStudent(student) {
    selectGroup(student.groupId);
    setProfileStudentId(student.id);
  }

  async function saveReport() {
    if (!j.group || exporting) return;
    setExporting(true);
    try {
      await downloadMonthlyReport({
        group: j.group, month: j.month, students: j.students, lessons: j.lessons,
        records: j.reportRecords(), stats: j.stats,
      });
      j.notify("success", "Отчёт Excel готов");
    } catch {
      j.notify("error", "Не удалось создать отчёт Excel");
    } finally {
      setExporting(false);
    }
  }

  const askRemoveGroup = () => setConfirm({
    title: "Перенести группу в архив?",
    text: j.students.length ? `Группа «${j.group.name}» и её ученики (${j.students.length}) будут перенесены в архив.` : `Группа «${j.group.name}» будет перенесена в архив.`,
    yes: "В архив",
    danger: true,
    onYes: j.removeGroup,
  });

  const askRemoveStudent = (id) => {
    const st = j.students.find((x) => x.id === id);
    if (!st) return;
    setConfirm({
      title: "Перенести ученика в архив?",
      text: `«${st.last} ${st.first}» будет перенесён в архив вместе с отметками и баллами.`,
      yes: "В архив",
      danger: true,
      onYes: () => j.removeStudent(id),
    });
  };

  const askRemoveTeacher = (teacher) => setConfirm({
    title: "Удалить преподавателя?",
    text: `Доступ преподавателя «${teacher.name}» будет закрыт. Его группы станут доступны для назначения другому преподавателю.`,
    yes: "Удалить",
    danger: true,
    onYes: () => j.removeTeacher(teacher),
  });

  const unavailable = j.offline && !j.groups.length && !j.teachers.length && !archiveCount;
  const journalProps = {
    lessons: j.lessons,
    students: j.students,
    ym: j.ym,
    contacts,
    rec: j.rec,
    stats: j.stats,
    total: j.total,
    focusDate,
    focusVersion: lessonFocus?.version,
    onProfile: setProfileStudentId,
    onCycle: j.cycle,
    onScore: j.score,
    onMarkAll: j.markAll,
    onRemove: admin ? askRemoveStudent : undefined,
    onEdit: admin ? setEditStudent : undefined,
  };

  return (
    <div className={`jr journal-app${teacherPage ? " teacher-page" : ""}`} style={colorVars(color)}>
      <header className="app-bar">
        <div className="app-brand"><Brand /></div>
        {admin && <nav className="app-nav" aria-label="Разделы журнала">
          <button type="button" onClick={() => setPage("journal")} aria-current={!teacherPage ? "page" : undefined}><FiBookOpen /> Журнал</button>
          <button type="button" onClick={() => setPage("teachers")} aria-current={teacherPage ? "page" : undefined}><FiUsers /> Преподаватели</button>
        </nav>}
        <div className="journal-tools">
          <button type="button" aria-label="История изменений" title="История изменений" onClick={() => setHistoryOpen(true)}><FiActivity /><span>История</span></button>
          <div className="account" title={user.name}>
            <span className="account-initial" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
            <span className="account-name">{user.name}</span>
          </div>
          <button type="button" aria-label="Выйти" title="Выйти" onClick={onLogout}><FiLogOut /><span>Выйти</span></button>
        </div>
      </header>
      {!teacherPage && <Sidebar
        overview={j.overview} groupId={j.group?.id} groups={j.groups} allStudents={j.allStudents}
        archiveCount={archiveCount} teachers={j.teachers} onStudent={openStudent}
        onSelect={selectGroup} onNewGroup={() => setModal("group")} onArchive={() => setModal("archive")}
      />}
      <main>
        {j.offline && !unavailable && <div className="offline"><FiWifiOff /> Нет связи с сервером <button onClick={j.retry}>Повторить</button></div>}
        {j.loading ? (
          <div className="state" role="status">Загрузка…</div>
        ) : unavailable ? (
          <div className="state">
            <FiWifiOff size={36} />
            <p>Нет связи с сервером.</p>
            <button className="primary" onClick={j.retry}>Повторить</button>
          </div>
        ) : teacherPage ? (
          <TeacherPanel teachers={j.teachers} groups={j.groups}
            onAdd={() => { setEditTeacher(null); setModal("teacher"); }}
            onEdit={(teacher) => { setEditTeacher(teacher); setModal("teacher"); }}
            onRemove={askRemoveTeacher} onGroup={selectGroup} />
        ) : !j.group ? (
          <div className="state">
            <p>{archiveCount ? "Активных групп нет. Удалённые группы лежат в архиве." : "Групп пока нет."}</p>
          </div>
        ) : (
          <>
            <TodayLessons groups={j.groups} onOpen={openLesson} />
            <div className="journal-destination" ref={journalDestination}>
              <GroupHeader group={j.group} ym={j.ym} contacts={contacts}
                teacherName={admin ? groupTeacher?.name || "Без преподавателя" : undefined}
                onShift={(delta) => { setLessonFocus(null); j.shiftMonth(delta); }}
                onContacts={setContacts} onRemove={canRemoveGroup ? askRemoveGroup : undefined}
                onAddStudent={() => setModal("student")} onEdit={() => setModal("editGroup")}
                reportActions={<>
                  <button type="button" className="excel-export" onClick={saveReport} disabled={exporting} aria-label="Скачать отчёт Excel">
                    <FiDownload /> {exporting ? "Подготовка…" : "Excel"}
                  </button>
                  <button type="button" onClick={() => setModal("excel")} aria-label="Синхронизация с Excel">
                    <FiRefreshCw /> Синхронизация
                  </button>
                  <button type="button" onClick={() => setModal("parent-link")}><FiLink2 /> Ссылка для родителей</button>
                </>} />
              <div className="desktop-journal">
                <JournalTable {...journalProps} />
                <p className="legend">Нажмите на отметку, чтобы изменить посещаемость. Баллы за ДЗ и классную работу от 0 до {MAX}.</p>
              </div>
              <MobileJournal key={`${j.group.id}-${j.ym.y}-${j.ym.m}`} {...journalProps} />
            </div>
          </>
        )}
      </main>

      {modal === "student" && j.group && <StudentForm groupName={j.group.name} color={color} onAdd={j.addStudent} onClose={close} />}
      {modal === "excel" && j.group && <ExcelSync key={j.group.id} group={j.group} api={api} onClose={close} />}
      {modal === "parent-link" && j.group && <ParentLinkDialog key={j.group.id} group={j.group} api={api} onClose={close} />}
      {profileStudent && profileGroup && <StudentProfile key={profileStudent.id} student={profileStudent} group={profileGroup}
        history={j.history(profileStudent.id)} total={j.total(profileStudent.id)} onClose={() => setProfileStudentId(null)} />}
      {modal === "editGroup" && j.group && <GroupForm group={j.group} teachers={admin ? j.teachers : undefined} onAdd={(f) => j.updateGroup(j.group.id, f)} onClose={close} />}
      {admin && editStudent && <StudentForm student={editStudent} groups={j.groups} color={color}
        onAdd={(f) => j.updateStudent(editStudent.id, f)} onClose={() => setEditStudent(null)} />}
      {modal === "group" && <GroupForm color={COLOR_KEYS[j.groups.length % COLOR_KEYS.length]} teachers={admin ? j.teachers : undefined} onAdd={j.addGroup} onClose={close} />}
      {admin && modal === "teacher" && <TeacherForm teacher={editTeacher} onClose={close}
        onSave={editTeacher ? (form) => j.updateTeacher(editTeacher.id, form) : j.addTeacher} />}
      {modal === "archive" && <ArchiveModal archive={j.archive} color={color} ask={setConfirm} onClose={close} canManageStudents={admin}
        onRestoreGroup={j.restoreGroup} onRestoreStudent={j.restoreStudent} onPurgeGroup={j.purgeGroup}
        onPurgeStudent={j.purgeStudent} onClear={j.clearArchive} />}
      {confirm && <Confirm cfg={confirm} color={color} onClose={() => setConfirm(null)} />}
      {historyOpen && <Modal title="История изменений" color={color} wide onClose={() => setHistoryOpen(false)}>
        <div className="terminal-head"><span>Событий в текущем сеансе {activities.length}</span><button type="button" onClick={() => { setActivities([]); j.info("История сессии очищена"); }}><FiTrash2 /> Очистить</button></div>
        <div className="terminal-body" role="log" aria-label="История изменений">
          {activities.length === 0 ? <p className="terminal-empty">Пока нет изменений в этой сессии.</p> : activities.map((entry) => <div className="terminal-line" key={entry.id}><time>{new Date(entry.at).toLocaleString("ru-RU")}</time><span>{entry.message}</span></div>)}
        </div>
      </Modal>}
      <Toasts items={j.toasts} onDismiss={j.dismiss} />
    </div>
  );
}

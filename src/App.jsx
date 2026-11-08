import { useCallback, useState } from "react";
import { FiActivity, FiLogOut, FiLock, FiEye, FiEyeOff, FiTrash2 } from "react-icons/fi";
import Modal from "./components/Modal";
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

const AUTH_KEY = "bilim-journal-auth";
const LOG_KEY = "bilim-journal-activity";
const readSession = (key, fallback) => {
  try { const value = sessionStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => readSession(AUTH_KEY, false) === true);
  const [loginToast, setLoginToast] = useState("");
  const login = (username, password) => {
    if (username.trim() === "BilimGroup" && password === "BilimStudents") {
      try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(true)); } catch { /* private browsing */ }
      setAuthenticated(true);
      setLoginToast("");
    } else setLoginToast("Неверный логин или пароль");
  };
  if (!authenticated) return <LoginPage onLogin={login} error={loginToast} />;
  return <JournalApp onLogout={() => { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(LOG_KEY); setAuthenticated(false); }} />;
}

function LoginPage({ onLogin, error }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  return <div className="jr login-screen"><div className="login-card">
    <div className="login-logo"><FiLock /></div>
    <h1>Bilim Group</h1><p>Электронный журнал · Вход в систему</p>
    <form onSubmit={(e) => { e.preventDefault(); onLogin(username, password); }}>
      <label htmlFor="journal-login">Логин</label><input id="journal-login" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Введите логин" required autoFocus />
      <label htmlFor="journal-password">Пароль</label><div className="password-field"><input id="journal-password" autoComplete="current-password" type={visible ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Введите пароль" required /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Скрыть пароль" : "Показать пароль"}>{visible ? <FiEyeOff /> : <FiEye />}</button></div>
      {error && <div className="login-error" role="alert">{error}</div>}
      <button className="primary login-submit" type="submit">Войти</button>
    </form><small>Bilim Group · Journal</small>
  </div>{error && <Toasts items={[{ id: 1, type: "error", text: error }]} onDismiss={() => {}} />}</div>;
}

function JournalApp({ onLogout }) {
  const [activities, setActivities] = useState(() => readSession(LOG_KEY, []));
  const recordActivity = useCallback((message) => {
    setActivities(previous => {
      const next = [{ id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), message }, ...previous].slice(0, 150);
      try { sessionStorage.setItem(LOG_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  const j = useJournal(recordActivity);
  const [historyOpen, setHistoryOpen] = useState(false);
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
      <div className="journal-tools"><button type="button" onClick={() => setHistoryOpen(true)}><FiActivity /> История <span className="history-count">{activities.length}</span></button><button type="button" onClick={onLogout}><FiLogOut /> Выйти</button></div>
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
      {historyOpen && <Modal title="История изменений · Терминал" color={color} wide onClose={() => setHistoryOpen(false)}>
        <div className="terminal-head"><span><span className="terminal-dot" /> SESSION LOG · {activities.length} событий</span><button type="button" onClick={() => { setActivities([]); sessionStorage.removeItem(LOG_KEY); j.info("История сессии очищена"); }}><FiTrash2 /> Очистить</button></div>
        <div className="terminal-body" role="log" aria-label="История изменений">
          {activities.length === 0 ? <p className="terminal-empty">$ Пока нет изменений в этой сессии.</p> : activities.map((entry) => <div className="terminal-line" key={entry.id}><time>{new Date(entry.at).toLocaleString("ru-RU")}</time><span className="terminal-arrow">➜</span><span>{entry.message}</span></div>)}
        </div><p className="terminal-note">Записи хранятся только в sessionStorage этого браузера. Они не являются серверным журналом аудита.</p>
      </Modal>}
      <Toasts items={j.toasts} onDismiss={j.dismiss} />
    </div>
  );
}

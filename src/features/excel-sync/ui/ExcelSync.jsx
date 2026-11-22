import { useEffect, useRef, useState } from "react";
import { FiCopy, FiKey, FiLink2 } from "react-icons/fi";
import { excelFeedUrl } from "@/shared/api";
import Modal from "@/shared/ui/Modal.jsx";
import "./excel-sync.scss";

function CopyField({ label, value }) {
  const input = useRef(null);
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Скопировано");
    } catch {
      input.current?.focus();
      input.current?.select();
      setMessage("Текст выделен для копирования");
    }
  }

  return (
    <div className="excel-copy">
      <label className="fld"><span>{label}</span><input readOnly ref={input} value={value} /></label>
      <button type="button" aria-label={`Скопировать ${label.toLowerCase()}`} title="Скопировать" onClick={copy}><FiCopy /></button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}

export default function ExcelSync({ group, api, onClose }) {
  const [connection, setConnection] = useState(null);
  const [newKey, setNewKey] = useState("");
  const [working, setWorking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.excelConnection(group.id).then((data) => {
      if (active) setConnection(data);
    }).catch((problem) => {
      if (active) setError(problem.message);
    }).finally(() => {
      if (active) setWorking(false);
    });
    return () => { active = false; };
  }, [api, group.id]);

  async function changeConnection(revoke) {
    setWorking(true);
    setError("");
    try {
      if (revoke) {
        await api.revokeExcelConnection(group.id);
        setConnection({ enabled: false });
        setNewKey("");
      } else {
        const { token, ...status } = await api.rotateExcelConnection(group.id);
        setConnection(status);
        setNewKey(token);
      }
    } catch (problem) {
      setError(problem.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal title="Синхронизация с Excel" color={group.color} onClose={onClose}>
      <section className="excel-sync">
        <div className="excel-sync-overview">
          <FiLink2 aria-hidden="true" />
          <div><strong>{group.name}</strong><small>{connection?.enabled ? "Подключение активно" : "Доступ к отчёту для Excel"}</small></div>
        </div>
        {connection?.enabled && <CopyField label="Адрес подключения" value={excelFeedUrl(group.id)} />}
        {newKey && <CopyField key={newKey} label="Ключ для Excel" value={newKey} />}
        {connection?.enabled && !newKey && <p>Ключ показывается при создании. Если он потерян, выпустите новый и обновите пароль в Excel.</p>}
        {connection?.enabled && <ol>
          <li>В Excel откройте <b>Данные → Получить данные → Из канала OData</b> и вставьте адрес.</li>
          <li>Выберите обычную авторизацию (Basic). Имя пользователя <code>journal</code>, пароль — ключ для Excel.</li>
          <li>Загрузите таблицу <b>Reports</b> и отфильтруйте нужный месяц. Excel получает свежие данные при обновлении. В поддерживаемых версиях можно включить обновление по интервалу в свойствах подключения.</li>
        </ol>}
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="mfoot excel-sync-actions">
          {connection?.enabled && <button type="button" className="icon-danger" disabled={working} onClick={() => changeConnection(true)}>Отключить</button>}
          {connection && <button type="button" className="primary" disabled={working} onClick={() => changeConnection(false)}>
            <FiKey /> {connection.enabled ? "Заменить ключ" : "Создать ключ"}
          </button>}
          {!connection && <button type="button" onClick={onClose}>{working ? "Закрыть" : "Готово"}</button>}
        </div>
      </section>
    </Modal>
  );
}

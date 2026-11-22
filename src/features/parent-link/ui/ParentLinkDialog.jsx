import { useEffect, useRef, useState } from "react";
import { FiCopy, FiExternalLink, FiLink2 } from "react-icons/fi";
import Modal from "@/shared/ui/Modal.jsx";
import { parentViewUrl } from "@/shared/lib/parent-view-url";
import style from "./ParentLinkDialog.module.scss";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function ParentLinkDialog({ group, api, onClose }) {
  const [connection, setConnection] = useState(null);
  const [working, setWorking] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const field = useRef(null);
  const url = connection?.enabled && connection.token ? parentViewUrl(group.id, connection.token) : "";

  useEffect(() => {
    let active = true;
    api.parentLink(group.id).then((result) => {
      if (active) setConnection(result);
    }).catch((problem) => {
      if (active) setError(problem.message);
    }).finally(() => {
      if (active) setWorking(false);
    });
    return () => { active = false; };
  }, [api, group.id]);

  async function changeLink(revoke) {
    if (working) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      if (revoke) {
        await api.revokeParentLink(group.id);
        setConnection({ enabled: false });
        setMessage("Доступ по ссылке закрыт");
      } else {
        setConnection(await api.rotateParentLink(group.id));
        setMessage(url ? "Новая ссылка готова" : "Ссылка готова");
      }
    } catch (problem) {
      setError(problem.message);
    } finally {
      setWorking(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Ссылка скопирована");
    } catch {
      field.current?.focus();
      field.current?.select();
      setMessage("Ссылка выделена для копирования");
    }
  }

  return (
    <Modal title="Ссылка для родителей" color={group.color} onClose={onClose}>
      <section className={style.dialog} aria-busy={working}>
        <div className={style.group}>
          <FiLink2 aria-hidden="true" />
          <div><strong>{group.name}</strong><small>{url ? "Доступ открыт" : "Просмотр журнала"}</small></div>
        </div>
        <p>По ссылке видны имена с инициалами, баллы и посещаемость всех учеников этой группы. Ссылку может открыть любой, у кого она есть.</p>
        {url && <>
          <label className="fld"><span>Ссылка группы</span><input readOnly ref={field} value={url} spellCheck={false} /></label>
          {localHosts.has(new URL(url).hostname) && <p>Этот адрес открывается на вашем устройстве. Для родителей нужен доступный им адрес журнала.</p>}
          <div className={style.shareActions}>
            <button className="primary" type="button" onClick={copyLink}><FiCopy /> Скопировать ссылку</button>
            <a href={url} target="_blank" rel="noreferrer"><FiExternalLink /> Открыть</a>
          </div>
        </>}
        {error && <p className="login-error" role="alert">{error}</p>}
        {message && <p className={style.message} role="status">{message}</p>}
        <div className={`mfoot ${style.manage}`}>
          {url && <button type="button" className="icon-danger" disabled={working} onClick={() => changeLink(true)}>Закрыть доступ</button>}
          {connection && <button type="button" className={url ? undefined : "primary"} disabled={working} onClick={() => changeLink(false)}>
            {url ? "Заменить ссылку" : "Создать ссылку"}
          </button>}
        </div>
      </section>
    </Modal>
  );
}

import { useState } from "react";
import { FiArchive, FiPlus, FiSearch } from "react-icons/fi";
import { WD } from "../lib/constants";
import { colorVars } from "../lib/colors";
import { fmtTime } from "../lib/dates";

export default function Sidebar({ overview, groupId, find, archiveCount, onSelect, onNewGroup, onArchive }) {
  const [q, setQ] = useState("");
  const pick = (id) => { onSelect(id); setQ(""); };

  return (
    <aside className="side">
      <h1>Журнал</h1>
      <div className="search">
        <FiSearch />
        <input className="find" placeholder="Найти ученика" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск ученика" />
      </div>
      {find(q).map((st) => (
        <button key={st.id} className="hit" style={colorVars(st.g?.color)} onClick={() => pick(st.groupId)}>
          {st.last} {st.first}<small>{st.g?.name}</small>
        </button>
      ))}
      <div className="tiles">
        {overview.map(({ g, count, pct }) => (
          <button key={g.id} className={`tile${g.id === groupId ? " on" : ""}`} style={{ ...colorVars(g.color), "--p": pct ?? 0 }} onClick={() => pick(g.id)}>
            <span className="ring"><b>{pct === null ? "–" : `${pct}%`}</b></span>
            <span className="tt">
              <span className="tn">{g.name}</span>
              <span className="tw">{g.days.map((d) => <i key={d}>{WD[d]}</i>)}</span>
              {fmtTime(g) && <span className="tm">{fmtTime(g)}</span>}
              <span className="tm">учеников: {count}</span>
            </span>
          </button>
        ))}
      </div>
      <button className="primary" onClick={onNewGroup}><FiPlus /> Новая группа</button>
      <button className="archive-btn" onClick={onArchive}>
        <FiArchive /> Архив{archiveCount > 0 && <span className="badge">{archiveCount}</span>}
      </button>
    </aside>
  );
}

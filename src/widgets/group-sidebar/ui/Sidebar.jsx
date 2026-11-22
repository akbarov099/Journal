import { useMemo, useState } from "react";
import { FiArchive, FiBookOpen, FiChevronDown, FiPlus, FiSearch, FiUser } from "react-icons/fi";
import { WD } from "@/shared/lib/constants.js";
import { colorVars } from "@/shared/lib/colors.js";
import { fmtTime } from "@/entities/group";
import { searchJournal } from "@/features/journal-search";
import "./discovery.scss";
import "./sidebar.scss";

const phoneLabels = { phone: "Телефон ученика", parent: "Телефон родителей" };

export default function Sidebar({ overview, groups, allStudents, groupId, archiveCount, teachers, onSelect, onStudent, onNewGroup, onArchive }) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);
  const collapsed = Boolean(groupId) && !expanded;
  const { results, count, ready } = useMemo(() => searchJournal(q, groups, allStudents), [q, groups, allStudents]);
  const feedback = q.trim() ? searchFeedback(ready, count, results.length) : "";

  const reset = () => {
    setQ("");
    setExpanded(false);
  };
  const pick = (id) => {
    onSelect(id);
    reset();
  };
  const pickResult = (result) => {
    if (result.kind === "group") pick(result.group.id);
    else {
      onStudent(result.student);
      reset();
    }
  };
  const teacherNames = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));

  return (
    <aside className="side">
      <h1>
        <span className={`side-heading${groupId ? " with-toggle" : ""}`}>Группы <small>{overview.length}</small></span>
        {groupId && <button type="button" className="side-toggle" aria-expanded={!collapsed} aria-controls="journal-groups"
          onClick={() => setExpanded((value) => !value)}>Группы <small>{overview.length}</small><FiChevronDown /></button>}
      </h1>
      <div className="journal-search">
        <form className="search" role="search" aria-label="Поиск по журналу" onSubmit={(event) => {
          event.preventDefault();
          if (results.length) pickResult(results[0]);
        }}>
          <FiSearch aria-hidden="true" />
          <input type="search" className="find" placeholder="Имя, телефон или группа" value={q}
            autoComplete="off" aria-label="Поиск по журналу" onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape") setQ(""); }} />
        </form>
        <p className="journal-search-feedback" role="status">{feedback}</p>
        {results.length > 0 && <ul className="journal-search-results" aria-label="Результаты поиска">
          {results.map((result) => {
            const groupResult = result.kind === "group";
            const icon = groupResult ? <FiBookOpen aria-hidden="true" /> : <FiUser aria-hidden="true" />;
            return (
              <li key={`${result.kind}-${groupResult ? result.group.id : result.student.id}`}>
                <button type="button" className="journal-result" onClick={() => pickResult(result)} style={colorVars(result.group.color)}>
                  <span className="result-icon">{icon}</span>
                  <span className="result-content">
                    <strong>{result.title}</strong>
                    <small>{groupResult ? "Группа" : `Ученик · ${result.group.name}`}</small>
                    {!groupResult && result.contactMatches.length > 0 && <small className="result-contact">
                      {result.contactMatches.map((field) => phoneLabels[field]).join(" · ")}
                    </small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>}
      </div>
      <div className={`side-content${collapsed ? " collapsed" : ""}`} id="journal-groups">
        <div className="tiles">
          {overview.map(({ g, count, pct }) => (
            <button key={g.id} className={`tile${g.id === groupId ? " on" : ""}`} style={{ ...colorVars(g.color), "--p": pct ?? 0 }}
              onClick={() => pick(g.id)} aria-current={g.id === groupId ? "true" : undefined}>
              <span className="ring"><b>{pct === null ? "–" : `${pct}%`}</b></span>
              <span className="tt">
                <span className="tn">{g.name}</span>
                <span className="tw">{g.days.map((d) => <i key={d}>{WD[d]}</i>)}</span>
                {fmtTime(g) && <span className="tm">{fmtTime(g)}</span>}
                <span className="tm">Учеников {count}</span>
                {teacherNames.has(g.teacherId) && <span className="tile-owner">{teacherNames.get(g.teacherId)}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="side-actions">
          <button className="primary" onClick={onNewGroup}><FiPlus /> Новая группа</button>
          <button className="archive-btn" onClick={onArchive}>
            <FiArchive /> Архив{archiveCount > 0 && <span className="badge">{archiveCount}</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

function searchFeedback(ready, count, visible) {
  if (!ready) return "Продолжите ввод для поиска.";
  if (!count) return "Совпадений нет.";
  if (count > visible) return `Показано ${visible} из ${count}. Уточните запрос.`;
  return `Совпадений ${count}`;
}

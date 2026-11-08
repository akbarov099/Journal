import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { colorVars } from "../lib/colors";

// Модальное окно на нативном <dialog>: Esc и клик по фону закрывают окно
export default function Modal({ title, color, wide = false, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " wide" : ""}`}
      style={colorVars(color)}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="mbody">
        <div className="mhead">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Закрыть"><FiX /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

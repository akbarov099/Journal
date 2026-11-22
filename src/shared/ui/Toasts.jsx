import { useEffect, useRef } from "react";
import { FiAlertTriangle, FiCheckCircle, FiInfo } from "react-icons/fi";

const ICON = { success: FiCheckCircle, error: FiAlertTriangle, info: FiInfo };

// Уведомления живут в top layer (popover), поэтому видны и поверх открытых модальных окон.
// При каждом новом уведомлении popover показывается заново — так он всегда сверху.
export default function Toasts({ items, onDismiss }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== "function") return;
    try { if (el.matches(":popover-open")) el.hidePopover(); } catch { /* ignore */ }
    if (items.length) { try { el.showPopover(); } catch { /* ignore */ } }
  }, [items]);

  return (
    <div ref={ref} popover="manual" className="toasts" aria-live="polite">
      {items.map((t) => {
        const Icon = ICON[t.type] || FiInfo;
        return (
          <div key={t.id} className={`toast ${t.type}`} role={t.type === "error" ? "alert" : "status"} onClick={() => onDismiss(t.id)}>
            <Icon /><span>{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}

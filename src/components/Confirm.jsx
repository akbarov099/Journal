import Modal from "./Modal";

// Окно подтверждения: cfg = { title, text, yes, danger, onYes }
export default function Confirm({ cfg, color, onClose }) {
  const go = () => { onClose(); cfg.onYes(); };
  return (
    <Modal title={cfg.title} color={color} onClose={onClose}>
      <p className="ctext">{cfg.text}</p>
      <div className="mfoot">
        <button onClick={onClose} autoFocus>Отмена</button>
        <button className={cfg.danger ? "danger" : "primary"} onClick={go}>{cfg.yes || "Да"}</button>
      </div>
    </Modal>
  );
}

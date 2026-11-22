import { Brand } from "@/shared/ui/brand";
import "./login.scss";

export default function SessionRestore({ error, onSwitch, onRetry }) {
  return (
    <div className="jr login-screen">
      <div className="login-card" aria-live="polite">
        <Brand variant="compact" />
        <p>{error || "Проверяем вход…"}</p>
        {error && <div className="mfoot">
          <button type="button" onClick={onSwitch}>Сменить аккаунт</button>
          <button type="button" className="primary" onClick={onRetry}>Повторить</button>
        </div>}
      </div>
    </div>
  );
}

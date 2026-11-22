import { useState } from "react";
import { FiArrowRight, FiEye, FiEyeOff } from "react-icons/fi";
import { normalizePhone } from "@/shared/lib/phone.js";
import PhoneInput from "@/shared/ui/PhoneInput.jsx";
import { Brand } from "@/shared/ui/brand";
import "./login.scss";

export default function LoginPage({ onLogin, error, pending }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (pending) return;
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    onLogin(normalized, password);
  }

  return (
    <main className="jr login-screen account-login">
      <div className="account-login-layout">
        <header className="account-cover">
          <Brand variant="cover" />
          <h1>Электронный журнал</h1>
          <div className="account-art" aria-hidden="true">
            <div className="account-sheet"><div className="account-sheet-tab" /></div>
          </div>
        </header>
        <section className="login-card" aria-labelledby="login-title">
          <h2 id="login-title">Вход в журнал</h2>
          <form onSubmit={submit}>
            <div className="account-field">
              <label htmlFor="journal-login">Номер телефона</label>
              <PhoneInput id="journal-login" autoComplete="username" value={phone} onValueChange={setPhone} required autoFocus />
            </div>
            <div className="account-field">
              <label htmlFor="journal-password">Пароль</label>
              <div className="password-field">
                <input id="journal-password" autoComplete="current-password" type={visible ? "text" : "password"}
                  value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Скрыть пароль" : "Показать пароль"}>
                  {visible ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="primary login-submit" type="submit" disabled={pending}>
              {pending ? "Вход…" : "Войти"}<FiArrowRight aria-hidden="true" />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

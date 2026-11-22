import { useCallback, useEffect, useMemo, useState } from "react";
import { createApi, publicApi } from "@/shared/api";
import { readSession, writeSession } from "@/shared/lib/sessionStorage.js";

const AUTH_KEY = "bilim-journal-v2-token";
const EMPTY_SESSION = { token: "", user: null };

export default function useSession() {
  const [session, setSession] = useState(() => ({ ...EMPTY_SESSION, token: readSession(AUTH_KEY) || "" }));
  const [restoreAttempt, retryRestore] = useState(0);
  const [restoreError, setRestoreError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const { token, user } = session;

  const endSession = useCallback((expiredToken) => {
    if (readSession(AUTH_KEY) === expiredToken) writeSession(AUTH_KEY, "");
    setSession((current) => current.token === expiredToken ? EMPTY_SESSION : current);
  }, []);

  const api = useMemo(() => createApi(token, endSession), [token, endSession]);

  useEffect(() => {
    if (!token || user) return;
    let active = true;
    // Ignore a restore response after switching accounts.
    createApi(token).me().then(({ user: currentUser }) => {
      if (active) setSession({ token, user: currentUser });
    }).catch((error) => {
      if (!active) return;
      if (error.status === 401) endSession(token);
      else setRestoreError(error.message);
    });
    return () => { active = false; };
  }, [endSession, restoreAttempt, token, user]);

  async function login(phone, password) {
    setLoginPending(true);
    setLoginError("");
    try {
      const next = await publicApi.login({ phone, password });
      writeSession(AUTH_KEY, next.token);
      setSession(next);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginPending(false);
    }
  }

  function logout() {
    endSession(token);
    void createApi(token).logout().catch(() => {});
  }

  return {
    api, user, login, loginError, loginPending, logout,
    restoring: Boolean(token && !user), restoreError,
    switchAccount() { setRestoreError(""); endSession(token); },
    retry() { setRestoreError(""); retryRestore((attempt) => attempt + 1); },
  };
}

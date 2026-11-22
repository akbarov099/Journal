import { useEffect, useState } from "react";
import { useSession } from "@/features/auth";
import { JournalPage, clearJournalActivity } from "@/pages/journal";
import { LoginPage, SessionRestore } from "@/pages/login";
import { ParentJournalPage } from "@/pages/parent-journal";
import { readParentView } from "@/shared/lib/parent-view-url";

export default function App() {
  const [parentView, setParentView] = useState(() => readParentView(window.location.hash));

  useEffect(() => {
    const update = () => setParentView(readParentView(window.location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return parentView
    ? <ParentJournalPage key={parentView.groupId} {...parentView} />
    : <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const session = useSession();
  if (session.restoring) {
    return <SessionRestore error={session.restoreError} onSwitch={session.switchAccount} onRetry={session.retry} />;
  }
  if (!session.user) return <LoginPage onLogin={session.login} error={session.loginError} pending={session.loginPending} />;

  const logout = () => {
    clearJournalActivity(session.user.id);
    session.logout();
  };
  return <JournalPage key={session.user.id} api={session.api} user={session.user} onLogout={logout} />;
}

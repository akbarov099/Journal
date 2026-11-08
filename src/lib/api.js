const BASE = import.meta.env.VITE_API_URL || "https://api-journal.bilimnuru.com/api";

export const OFFLINE_MSG = "Нет связи с сервером";

async function req(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error(OFFLINE_MSG), { offline: true });
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // 502/503/504 от прокси при остановленном сервере — тоже «нет связи»
    const offline = [502, 503, 504].includes(res.status);
    throw Object.assign(new Error(offline ? OFFLINE_MSG : data.error || res.statusText), { offline, status: res.status });
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  state: () => req("GET", "/state"),
  addGroup: (b) => req("POST", "/groups", b),
  updateGroup: (id, b) => req("PUT", `/groups/${id}`, b),
  deleteGroup: (id) => req("DELETE", `/groups/${id}`),
  addStudent: (b) => req("POST", "/students", b),
  updateStudent: (id, b) => req("PUT", `/students/${id}`, b),
  deleteStudent: (id) => req("DELETE", `/students/${id}`),
  setRecord: (b) => req("PUT", "/records", b),
  bulk: (b) => req("POST", "/records/bulk", b),
  // архив
  restoreGroup: (id) => req("POST", `/archive/groups/${id}/restore`),
  restoreStudent: (id) => req("POST", `/archive/students/${id}/restore`),
  purgeGroup: (id) => req("DELETE", `/archive/groups/${id}`),
  purgeStudent: (id) => req("DELETE", `/archive/students/${id}`),
  clearArchive: () => req("DELETE", "/archive"),
};

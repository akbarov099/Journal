export const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export const OFFLINE_MSG = "Нет связи с сервером";

export function excelFeedUrl(groupId) {
  return new URL(`${API_BASE}/excel/groups/${encodeURIComponent(groupId)}/odata/`, window.location.href).href;
}

export function createApi(token, onUnauthorized) {
  async function req(method, path, body) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw Object.assign(new Error(OFFLINE_MSG), { offline: true });
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const offline = [502, 503, 504].includes(res.status);
      if (res.status === 401 && token) onUnauthorized?.(token);
      throw Object.assign(new Error(offline ? OFFLINE_MSG : data.error || res.statusText), { offline, status: res.status });
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    login: (body) => req("POST", "/auth/login", body),
    me: () => req("GET", "/auth/me"),
    logout: () => req("POST", "/auth/logout"),
    state: () => req("GET", "/state"),
    addTeacher: (body) => req("POST", "/teachers", body),
    updateTeacher: (id, body) => req("PUT", `/teachers/${id}`, body),
    deleteTeacher: (id) => req("DELETE", `/teachers/${id}`),
    addGroup: (body) => req("POST", "/groups", body),
    updateGroup: (id, body) => req("PUT", `/groups/${id}`, body),
    deleteGroup: (id) => req("DELETE", `/groups/${id}`),
    excelConnection: (id) => req("GET", `/groups/${id}/excel`),
    rotateExcelConnection: (id) => req("POST", `/groups/${id}/excel`),
    revokeExcelConnection: (id) => req("DELETE", `/groups/${id}/excel`),
    parentLink: (id) => req("GET", `/groups/${id}/parent-link`),
    rotateParentLink: (id) => req("POST", `/groups/${id}/parent-link`),
    revokeParentLink: (id) => req("DELETE", `/groups/${id}/parent-link`),
    addStudent: (body) => req("POST", "/students", body),
    updateStudent: (id, body) => req("PUT", `/students/${id}`, body),
    deleteStudent: (id) => req("DELETE", `/students/${id}`),
    setRecord: (body) => req("PUT", "/records", body),
    bulk: (body) => req("POST", "/records/bulk", body),
    restoreGroup: (id) => req("POST", `/archive/groups/${id}/restore`),
    restoreStudent: (id) => req("POST", `/archive/students/${id}/restore`),
    purgeGroup: (id) => req("DELETE", `/archive/groups/${id}`),
    purgeStudent: (id) => req("DELETE", `/archive/students/${id}`),
    clearArchive: () => req("DELETE", "/archive"),
  };
}

export const publicApi = createApi();

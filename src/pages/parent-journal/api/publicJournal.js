import { API_BASE } from "@/shared/api";

const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const INACTIVE_STATUSES = [401, 403, 404, 410];

export async function readParentJournal({ groupId, token, month, signal }) {
  const path = `${API_BASE}/public/groups/${encodeURIComponent(groupId)}`;
  const query = month ? `?${new URLSearchParams({ month })}` : "";
  const response = await fetch(`${path}${query}`, {
    headers: { Authorization: `Share ${token}` },
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal,
  });

  if (!response.ok) {
    if (INACTIVE_STATUSES.includes(response.status)) return { inactive: true };
    throw new Error("Could not load parent journal");
  }

  const data = await response.json();
  if (!data?.group?.name || !MONTH_PATTERN.test(data.month) || !Array.isArray(data.students)) {
    throw new Error("Unexpected parent journal response");
  }
  return { data };
}

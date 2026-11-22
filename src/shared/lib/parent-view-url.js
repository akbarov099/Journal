const parentRoute = "#/parents";
const groupIdPattern = /^[a-f0-9]{24}$/i;
const tokenPattern = /^[A-Za-z0-9._-]{32,256}$/;

export function readParentView(hash) {
  if (hash !== parentRoute && !hash.startsWith(`${parentRoute}/`)) return null;
  const [groupId = "", token = "", ...extra] = hash.slice(parentRoute.length + 1).split("/");
  return extra.length === 0 && groupIdPattern.test(groupId) && tokenPattern.test(token)
    ? { groupId, token }
    : { groupId: "", token: "" };
}

export function parentViewUrl(groupId, token) {
  const address = import.meta.env.VITE_PUBLIC_JOURNAL_URL || import.meta.env.BASE_URL;
  const url = new URL(address, window.location.href);
  url.hash = `${parentRoute.slice(1)}/${groupId}/${token}`;
  return url.href;
}

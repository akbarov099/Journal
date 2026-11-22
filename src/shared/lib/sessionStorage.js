export function readSession(key) {
  try { return sessionStorage.getItem(key); }
  catch { return null; }
}

export function writeSession(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch { /* storage unavailable */ }
}

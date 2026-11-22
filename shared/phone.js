const countryCode = "996";

export function normalizePhone(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") return null;

  const input = value.trim();
  if (!input) return "";
  if (!/^\+?[\d\s().-]+$/.test(input)) return null;

  let digits = input.replace(/\D/g, "");
  if (input.startsWith("+")) {
    if (!digits.startsWith(countryCode)) return null;
    digits = digits.slice(countryCode.length);
  } else if (digits.length > 10 && digits.startsWith(countryCode)) {
    digits = digits.slice(countryCode.length);
  }

  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 9) return null;
  return `+${countryCode}${digits}`;
}

export function formatPhone(value) {
  const normalized = normalizePhone(value);
  if (normalized === null) return value;
  if (!normalized) return "";
  return `${normalized.slice(0, 7)} ${normalized.slice(7, 10)} ${normalized.slice(10)}`;
}

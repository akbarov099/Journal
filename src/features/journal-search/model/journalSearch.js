import { normalizePhone } from "@/shared/lib/phone.js";

const countryCode = "996";
const resultLimit = 8;
const phoneShape = /^\+?[\d\s().-]+$/;
const phoneFields = ["phone", "parent"];

function words(value) {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/['’ʻʼ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function nameRank(terms, candidate) {
  if (terms.length === 0 || !terms.every((term) => candidate.some((word) => word.includes(term)))) return -1;
  if (terms.length === candidate.length && terms.every((term) => candidate.includes(term))) return 0;
  if (terms.every((term) => candidate.some((word) => word.startsWith(term)))) return 1;
  return 2;
}

function phoneDigits(value) {
  return String(value).replace(/\D/g, "");
}

function findPhoneQuery(query) {
  if (!phoneShape.test(query)) return null;
  const digits = phoneDigits(query);
  if (query.startsWith("+") && !digits.startsWith(countryCode)) return null;
  const international = digits.startsWith(countryCode) && (query.startsWith("+") || digits.length > countryCode.length);
  const national = international ? digits.slice(countryCode.length) : digits;
  const prefix = national.startsWith("0") ? national.slice(1) : national;
  return { national, prefix };
}

function phoneRank(query, value) {
  if (!query || !value) return -1;
  const canonical = normalizePhone(value);
  const digits = canonical ? canonical.slice(1 + countryCode.length) : phoneDigits(value);
  if (query.prefix.length >= 3 && digits === query.prefix) return 0;
  if (query.prefix.length >= 3 && digits.startsWith(query.prefix)) return 1;
  if (query.national.length >= 3 && digits.includes(query.national)) return 2;
  return -1;
}

export function searchJournal(query, groups, students) {
  const input = query.trim();
  const searchTerms = words(input);
  const queryPhone = findPhoneQuery(input);
  const textReady = searchTerms.join("").length >= 2;
  const phonesReady = Boolean(queryPhone && queryPhone.national.length >= 3);
  const matches = [];

  if (!textReady && !phonesReady) return { results: [], count: 0, ready: false };

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  if (textReady) {
    for (const group of groups) {
      const order = nameRank(searchTerms, words(group.name));
      if (order >= 0) matches.push({ kind: "group", order, title: group.name, group });
    }
  }

  for (const student of students) {
    const group = groupsById.get(student.groupId);
    if (!group) continue;
    const title = `${student.last} ${student.first}`;
    const nameOrder = textReady ? nameRank(searchTerms, words(title)) : -1;
    const contactMatches = phoneFields.map((field) => ({ field, order: phonesReady ? phoneRank(queryPhone, student[field]) : -1 }))
      .filter(({ order }) => order >= 0);
    const order = Math.min(nameOrder >= 0 ? nameOrder : Infinity, ...contactMatches.map((match) => match.order));
    if (Number.isFinite(order)) matches.push({ kind: "student", order, title, group, student, contactMatches: contactMatches.map((match) => match.field) });
  }

  matches.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ru"));
  return { results: matches.slice(0, resultLimit), count: matches.length, ready: true };
}

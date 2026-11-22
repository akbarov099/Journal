import { readSession, writeSession } from "@/shared/lib/sessionStorage.js";

export const journalActivityKey = (userId) => `bilim-journal-activity:${userId}`;

export function clearJournalActivity(userId) {
  writeSession(journalActivityKey(userId), "");
}

export function readActivities(key) {
  try { return JSON.parse(readSession(key)) || []; }
  catch { return []; }
}

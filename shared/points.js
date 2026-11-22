export const MAX_SCORE = 4;

export const EMPTY_RESULTS = Object.freeze({ marked: 0, present: 0, hw: 0, cw: 0, pts: 0, max: 0 });

function addRecord(results, key, record) {
  const result = results.get(key) ?? { ...EMPTY_RESULTS };
  result.hw += record.hw ?? 0;
  result.cw += record.cw ?? 0;
  result.pts = result.hw + result.cw;
  if (record.a) result.marked++;
  if (record.a === "p") {
    result.present++;
    result.max += MAX_SCORE * 2;
  }
  results.set(key, result);
}

export function summarizeRecords(records) {
  const monthly = new Map();
  const allTime = new Map();

  for (const [key, record] of Object.entries(records)) {
    const [studentId, date] = key.split("|");
    const month = date.slice(0, 7);
    addRecord(monthly, `${studentId}|${month}`, record);
    addRecord(allTime, studentId, record);
  }

  return { monthly, allTime };
}

export const attendanceRate = ({ present, marked }) =>
  marked ? Math.round((present / marked) * 100) : null;

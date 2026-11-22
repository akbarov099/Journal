export function getDayLessons(groups, date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return groups.filter((group) => group.start <= date && group.days.includes(weekday))
    .sort((a, b) => (a.timeStart || "24:00").localeCompare(b.timeStart || "24:00") || a.name.localeCompare(b.name, "ru"));
}

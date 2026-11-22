const headingStyle = { color: "#FFFFFF", backgroundColor: "#142438", fontWeight: "bold" };

function reportSheet(sheet, groupName, month, headers, widths, rows) {
  const title = {
    value: `${groupName} · ${month}`,
    color: "#142438",
    backgroundColor: "#F2BD68",
    columnSpan: headers.length,
    fontWeight: "bold",
  };
  return {
    sheet,
    columns: widths.map((width) => ({ width })),
    stickyRowsCount: 2,
    data: [
      [title, ...headers.slice(1).map(() => null)],
      headers.map((value) => ({ value, ...headingStyle })),
      ...rows,
    ],
  };
}

function attendanceLabel(value) {
  if (value === "p") return "Присутствовал";
  if (value === "a") return "Отсутствовал";
  return "Не отмечен";
}

export function monthlyWorkbook({ group, month, students, lessons, records, stats }) {
  const summaryRows = students.map((student) => {
    const result = stats(student.id);
    return [
      student.last, student.first, result.present, result.marked - result.present,
      result.marked ? { value: result.present / result.marked, format: "0%" } : null,
      result.hw, result.cw, result.pts, result.max,
    ];
  });

  const scheduledDates = lessons.map(({ date }) => date);
  const byStudent = new Map(students.map(({ id }) => [id, new Map()]));
  records.forEach((record) => byStudent.get(record.studentId)?.set(record.date, record));
  const lessonRows = students.flatMap((student) => {
    const saved = byStudent.get(student.id);
    const dates = new Set(scheduledDates.filter((date) => date >= student.joined));
    for (const date of saved.keys()) dates.add(date);
    return [...dates].sort().map((date) => {
      const record = saved.get(date);
      const hw = record?.hw ?? null;
      const cw = record?.cw ?? null;
      const points = hw === null && cw === null ? null : (hw ?? 0) + (cw ?? 0);
      return [date, student.last, student.first, attendanceLabel(record?.a), hw, cw, points];
    });
  });

  return [
    reportSheet("Итоги месяца", group.name, month,
      ["Фамилия", "Имя", "Присутствовал", "Отсутствовал", "Посещаемость", "ДЗ", "Классная работа", "Всего баллов", "Максимум"],
      [22, 19, 17, 17, 17, 10, 20, 17, 12], summaryRows),
    reportSheet("По урокам", group.name, month,
      ["Дата", "Фамилия", "Имя", "Посещаемость", "ДЗ", "Классная работа", "Всего баллов"],
      [14, 22, 19, 21, 10, 20, 17], lessonRows),
  ];
}

export async function downloadMonthlyReport(snapshot) {
  const groupName = snapshot.group.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 75);
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  await writeExcelFile(monthlyWorkbook(snapshot)).toFile(`${groupName} ${snapshot.month}.xlsx`);
}

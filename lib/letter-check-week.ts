function toIso(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIso(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export function currentWeekRange(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  return {
    from: toIso(monday),
    to: toIso(friday),
    today: toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
  };
}

export function weekdaysOf(mondayIso: string) {
  const monday = fromIso(mondayIso);
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return toIso(day);
  });
}

export function shiftWeek(mondayIso: string, weeks: number) {
  const monday = fromIso(mondayIso);
  monday.setDate(monday.getDate() + weeks * 7);
  return toIso(monday);
}

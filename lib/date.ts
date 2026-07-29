import { toDateInputValue } from "@/lib/utils";

export function addInterval(
  dateString: string,
  frequency: "monthly" | "yearly" | "custom_days",
  intervalValue: number
) {
  const date = new Date(`${dateString}T00:00:00`);
  if (frequency === "monthly") {
    date.setMonth(date.getMonth() + intervalValue);
  } else if (frequency === "yearly") {
    date.setFullYear(date.getFullYear() + intervalValue);
  } else {
    date.setDate(date.getDate() + intervalValue);
  }

  return toDateInputValue(date);
}

export function classifyScheduleStatus(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${dateString}T00:00:00`);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate.getTime() < today.getTime()) {
    return "overdue";
  }

  if (dueDate.getTime() === today.getTime()) {
    return "due";
  }

  return "upcoming";
}

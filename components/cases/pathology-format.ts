export function formatIsoDate(iso: string | null, locale: string) {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(locale);
}

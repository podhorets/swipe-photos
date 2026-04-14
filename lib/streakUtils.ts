/** YYYY-MM-DD string from a Date using local time. */
export function toDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Count consecutive completed days ending on (and including) today.
 * If today has no completed session, returns 0.
 */
export function computeStreak(completedDates: Set<string>, today: Date): number {
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  if (!completedDates.has(toDateString(cursor))) return 0;

  let count = 0;
  while (completedDates.has(toDateString(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/**
 * Returns a 7-element boolean array (index 0 = Monday … index 6 = Sunday)
 * indicating which days of the current ISO week have a completed session.
 */
export function getWeekCompletions(completedDates: Set<string>, today: Date): boolean[] {
  // Find Monday of the current week
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun, 1=Mon … 6=Sat
  const dayOfWeek = monday.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(monday.getDate() - daysFromMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return completedDates.has(toDateString(d));
  });
}

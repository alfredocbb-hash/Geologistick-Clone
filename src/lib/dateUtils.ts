/**
 * Date utilities for handling timezone-safe date parsing
 * 
 * Problem: When DB stores "2026-01-26T02:00:00Z" (UTC) and we parse it in 
 * Argentina (UTC-3), new Date() converts to local time, resulting in 
 * "2026-01-25 23:00:00" - the previous day!
 * 
 * Solution: Extract the date components without timezone conversion
 */

/**
 * Parses a date/timestamp string preserving the original date (no timezone shift)
 * Use for fields where only the DATE matters, not the exact time
 * 
 * @example
 * parseDateString("2026-01-26T02:00:00Z") // Returns Date for Jan 26 at 00:00 local
 * parseDateString("2026-01-26") // Returns Date for Jan 26 at 00:00 local
 */
export function parseDateString(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  
  // For ISO dates YYYY-MM-DD
  if (dateStr.length === 10 && dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // For ISO timestamps, extract only the date part
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Parses a timestamp preserving both date AND time (for when time matters)
 * Still extracts from the ISO string but includes hours/minutes
 * 
 * @example
 * parseTimestamp("2026-01-26T14:30:00Z") // Returns Date for Jan 26 at 14:30 local
 */
export function parseTimestamp(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  
  // For simple dates without time
  if (dateStr.length === 10 && dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // For timestamps, parse both date and time parts
  const [datePart, timePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  
  if (timePart) {
    const timeClean = timePart.replace('Z', '').split('+')[0].split('-')[0];
    const [hours, minutes, seconds] = timeClean.split(':').map(Number);
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  }
  
  return new Date(year, month - 1, day);
}

/**
 * Formats a Date object to YYYY-MM-DD string without UTC conversion
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date as YYYY-MM-DD in local timezone
 * Use for filtering queries by "today"
 */
export function getTodayString(): string {
  return formatDateString(new Date());
}

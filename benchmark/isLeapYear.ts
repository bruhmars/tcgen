/** Returns true if the year is a leap year in the Gregorian calendar. Throws if the year is not a whole number. */
export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) {
    throw new Error("year must be a whole number");
  }
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

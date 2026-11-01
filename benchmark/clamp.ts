/** Limits a number to the range min..max. Throws an Error if min is greater than max. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new Error("min must not be greater than max");
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

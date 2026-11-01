/** Returns the average of a list of numbers. Throws if the list is empty. */
export function average(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("list must not be empty");
  }
  const sum = numbers.reduce((total, n) => total + n, 0);
  return sum / numbers.length;
}

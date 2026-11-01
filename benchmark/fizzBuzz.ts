/** Returns "FizzBuzz" if n is divisible by 3 and 5, "Fizz" if by 3, "Buzz" if by 5, otherwise n as a string. Throws if n is less than 1. */
export function fizzBuzz(n: number): string {
  if (n < 1) {
    throw new Error("n must be at least 1");
  }
  if (n % 15 === 0) return "FizzBuzz";
  if (n % 3 === 0) return "Fizz";
  if (n % 5 === 0) return "Buzz";
  return String(n);
}

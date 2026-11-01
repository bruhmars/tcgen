import { describe, it, expect } from "vitest";
import { fizzBuzz } from "../../benchmark/fizzBuzz";

describe("fizzBuzz", () => {
  // n is 0 which is less than 1, so the function throws
  it("[negative] throws error for zero", () => {
    expect(() => fizzBuzz(0)).toThrow();
  });

  // n is -5 which is less than 1, so the function throws
  it("[negative] throws error for negative number", () => {
    expect(() => fizzBuzz(-5)).toThrow();
  });

  // 15 % 15 === 0, so the function returns "FizzBuzz"
  it("[happy] returns FizzBuzz for multiple of 15", () => {
    expect(fizzBuzz(15)).toEqual("FizzBuzz");
  });

  // 9 % 15 !== 0, 9 % 3 === 0, so the function returns "Fizz"
  it("[happy] returns Fizz for multiple of 3 not 5", () => {
    expect(fizzBuzz(9)).toEqual("Fizz");
  });

  // 20 % 15 !== 0, 20 % 3 !== 0, 20 % 5 === 0, so the function returns "Buzz"
  it("[happy] returns Buzz for multiple of 5 not 3", () => {
    expect(fizzBuzz(20)).toEqual("Buzz");
  });

  // 7 % 15, 7 % 3, and 7 % 5 are all non‑zero, so the function returns String(7)
  it("[happy] returns number string for non‑multiple", () => {
    expect(fizzBuzz(7)).toEqual("7");
  });

  // 1 is >=1 and not divisible by 3 or 5, so returns "1"
  it("[edge] boundary test at lower limit", () => {
    expect(fizzBuzz(1)).toEqual("1");
  });

  // 150 % 15 === 0, so returns "FizzBuzz"
  it("[edge] large multiple of 15", () => {
    expect(fizzBuzz(150)).toEqual("FizzBuzz");
  });

  // 3003 % 15 !== 0, 3003 % 3 === 0, so returns "Fizz"
  it("[edge] large multiple of 3 only", () => {
    expect(fizzBuzz(3003)).toEqual("Fizz");
  });

  // 10000 % 15 !== 0, 10000 % 3 !== 0, 10000 % 5 === 0, so returns "Buzz"
  it("[edge] large multiple of 5 only", () => {
    expect(fizzBuzz(10000)).toEqual("Buzz");
  });
});

import { describe, it, expect } from "vitest";
import { average } from "../../benchmark/average";

describe("average", () => {
  // sum = 2 + 4 + 6 = 12; average = 12 / 3 = 4
  it("[happy] average of three positive integers", () => {
    expect(average([2,4,6])).toEqual(4);
  });

  // sum = 5; average = 5 / 1 = 5
  it("[happy] average of a single element", () => {
    expect(average([5])).toEqual(5);
  });

  // sum = 0 + 0 + 0 = 0; average = 0 / 3 = 0
  it("[edge] average of zeros", () => {
    expect(average([0,0,0])).toEqual(0);
  });

  // sum = -2 + -4 + -6 = -12; average = -12 / 3 = -4
  it("[edge] average with negative numbers", () => {
    expect(average([-2,-4,-6])).toEqual(-4);
  });

  // sum = 1000000000 + 2000000000 = 3000000000; average = 3000000000 / 2 = 1500000000
  it("[edge] average of large numbers", () => {
    expect(average([1000000000,2000000000])).toEqual(1500000000);
  });

  // numbers.length === 0 triggers throw new Error("list must not be empty")
  it("[negative] throws on empty list", () => {
    expect(() => average([])).toThrow();
  });
});

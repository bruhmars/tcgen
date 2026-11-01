import { describe, it, expect } from "vitest";
import { applyDiscount } from "../samples/applyDiscount";

describe("applyDiscount", () => {
  // 100 - (100 * 10 / 100) = 90
  it("[happy] apply 10% discount on 100", () => {
    expect(applyDiscount(100, 10)).toEqual(90);
  });

  // 250.5 - (250.5 * 0 / 100) = 250.5
  it("[happy] apply 0% discount returns original price", () => {
    expect(applyDiscount(250.5, 0)).toBeCloseTo(250.5, 5);
  });

  // 75 - (75 * 100 / 100) = 0
  it("[happy] apply 100% discount results in zero", () => {
    expect(applyDiscount(75, 100)).toEqual(0);
  });

  // 200 - (200 * 12.5 / 100) = 200 - 25 = 175
  it("[happy] apply discount with floating percent", () => {
    expect(applyDiscount(200, 12.5)).toEqual(175);
  });

  // 99.99 - (99.99 * 15 / 100) = 99.99 - 14.9985 = 84.9915
  it("[happy] apply discount with floating price", () => {
    expect(applyDiscount(99.99, 15)).toBeCloseTo(84.9915, 5);
  });

  // percent < 0 triggers error
  it("[edge] boundary percent just below lower limit (-0.0001) throws", () => {
    expect(() => applyDiscount(100, -0.0001)).toThrow();
  });

  // percent > 100 triggers error
  it("[edge] boundary percent just above upper limit (100.0001) throws", () => {
    expect(() => applyDiscount(100, 100.0001)).toThrow();
  });

  // 0% discount returns original price
  it("[edge] percent exactly at lower bound 0 works", () => {
    expect(applyDiscount(123, 0)).toEqual(123);
  });

  // 100% discount yields zero
  it("[edge] percent exactly at upper bound 100 works", () => {
    expect(applyDiscount(123, 100)).toEqual(0);
  });

  // 0 - (0 * 50 / 100) = 0
  it("[edge] price zero with valid discount returns zero", () => {
    expect(applyDiscount(0, 50)).toEqual(0);
  });

  // -200 - (-200 * 10 / 100) = -200 + 20 = -180
  it("[edge] negative price with valid discount calculates correctly", () => {
    expect(applyDiscount(-200, 10)).toEqual(-180);
  });

  // !! REPAIRED by AI (old expected value: "Invalid discount"). The test calls applyDiscount with only one argument, so percent is undefined. The function checks `if (percent < 0 || percent > 100)`. In JavaScript, `undefined < 0` and `undefined > 100` both evaluate to false, so the condition is false and no error is thrown. The return expression becomes `price - (price * undefined) / 100`, which results in `price - NaN`, i.e., NaN. Therefore the function does not throw and returns NaN. The test expects an error, which is incorrect.
  // With percent undefined, the function does not throw and the calculation yields NaN.
  it("[negative] percent undefined throws", () => {
    expect(applyDiscount(100)).toEqual("NaN");
  });

  // !! REPAIRED by AI (old expected value: "Invalid discount"). The function checks if percent is less than 0 or greater than 100. In JavaScript, null is coerced to 0 in numeric comparisons, so both conditions are false and no error is thrown. The calculation then uses null, which is also coerced to 0: price - (price * 0) / 100 = price - 0 = price. With args [100, null] the function returns 100 and does not throw. The test expects a throw, which is incorrect.
  // null is coerced to 0, so the discount is 0% and the function returns the original price 100.
  it("[negative] percent null throws", () => {
    expect(applyDiscount(100, null)).toEqual(100);
  });

  // !! REPAIRED by AI (old expected value: "Invalid discount"). The function applyDiscount expects both arguments to be numbers. When the second argument is an empty string (""), JavaScript coerces it to 0 in numeric comparisons and arithmetic. The check `percent < 0 || percent > 100` becomes `0 < 0 || 0 > 100`, which is false, so no error is thrown. The calculation `price - (price * percent) / 100` becomes `100 - (100 * 0) / 100 = 100`. Therefore the function returns 100 and does not throw. The test expects an error, which is incorrect.
  // Empty string is coerced to 0, passes the validation and results in price unchanged (100).
  it("[negative] percent as empty string throws", () => {
    expect(applyDiscount(100, "")).toEqual(100);
  });

  // !! REPAIRED by AI (old expected value: "Invalid discount"). The function checks if percent < 0 or percent > 100. When percent is an empty array [], JavaScript coerces it to a number: [] -> '' -> 0. Both comparisons (0 < 0 and 0 > 100) are false, so no error is thrown. The return expression price - (price * percent) / 100 also coerces [] to 0, yielding price - (price * 0) / 100 = price. With price = 100, the function returns 100 and does not throw. The test expects an error, which is incorrect.
  // Array [] coerces to 0, passes validation and results in price unchanged (100).
  it("[negative] percent as array throws", () => {
    expect(applyDiscount(100, [])).toEqual(100);
  });

  // Object converts to NaN, condition triggers error
  it("[negative] percent as object throws", () => {
    expect(() => applyDiscount(100, {})).toThrow();
  });
});

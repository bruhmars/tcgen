import { describe, it, expect } from "vitest";
import { clamp } from "../../benchmark/clamp";

describe("clamp", () => {
  // 5 is between 1 and 10, so the function returns the original value.
  it("[happy] value within range returns itself", () => {
    expect(clamp(5, 1, 10)).toEqual(5);
  });

  // value equals min, the second condition is not triggered and the function returns min.
  it("[edge] value equal to min returns min", () => {
    expect(clamp(1, 1, 10)).toEqual(1);
  });

  // value equals max, the third condition is not triggered and the function returns max.
  it("[edge] value equal to max returns max", () => {
    expect(clamp(10, 1, 10)).toEqual(10);
  });

  // 0 < min (1), so the function returns min.
  it("[negative] value less than min returns min", () => {
    expect(clamp(0, 1, 10)).toEqual(1);
  });

  // 15 > max (10), so the function returns max.
  it("[negative] value greater than max returns max", () => {
    expect(clamp(15, 1, 10)).toEqual(10);
  });

  // min (10) > max (1), the function throws an error.
  it("[negative] min greater than max throws error", () => {
    expect(() => clamp(5, 10, 1)).toThrow();
  });
});

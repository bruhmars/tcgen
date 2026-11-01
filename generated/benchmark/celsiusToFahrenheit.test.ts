import { describe, it, expect } from "vitest";
import { celsiusToFahrenheit } from "../../benchmark/celsiusToFahrenheit";

describe("celsiusToFahrenheit", () => {
  // (0 * 9) / 5 + 32 = 0 + 32 = 32
  it("[happy] Freezing point of water", () => {
    expect(celsiusToFahrenheit(0)).toEqual(32);
  });

  // (100 * 9) / 5 + 32 = 900 / 5 + 32 = 180 + 32 = 212
  it("[happy] Boiling point of water", () => {
    expect(celsiusToFahrenheit(100)).toEqual(212);
  });

  // (-40 * 9) / 5 + 32 = -360 / 5 + 32 = -72 + 32 = -40
  it("[happy] Negative Celsius above absolute zero", () => {
    expect(celsiusToFahrenheit(-40)).toEqual(-40);
  });

  // (-273.14 * 9) / 5 + 32 = -2458.26 / 5 + 32 = -491.652 + 32 = -459.652
  it("[edge] Boundary just above absolute zero", () => {
    expect(celsiusToFahrenheit(-273.14)).toBeCloseTo(-459.652, 5);
  });

  // (-273.15 * 9) / 5 + 32 = -2458.35 / 5 + 32 = -491.67 + 32 = -459.67
  it("[edge] Exactly absolute zero", () => {
    expect(celsiusToFahrenheit(-273.15)).toBeCloseTo(-459.67, 5);
  });

  // celsius < -273.15 triggers error
  it("[negative] Below absolute zero throws", () => {
    expect(() => celsiusToFahrenheit(-274)).toThrow();
  });

  // celsius < -273.15 triggers error
  it("[negative] Slightly below absolute zero throws", () => {
    expect(() => celsiusToFahrenheit(-273.151)).toThrow();
  });
});

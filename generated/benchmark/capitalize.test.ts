import { describe, it, expect } from "vitest";
import { capitalize } from "../../benchmark/capitalize";

describe("capitalize", () => {
  // Input length is 0, function returns "" directly
  it("[happy] empty string returns empty", () => {
    expect(capitalize("")).toEqual("");
  });

  // First character 'a' toUpperCase() => 'A', slice(1) is empty, result 'A'
  it("[happy] single lowercase letter", () => {
    expect(capitalize("a")).toEqual("A");
  });

  // First character 'Z' toUpperCase() => 'Z', slice(1) empty, result 'Z'
  it("[happy] single uppercase letter", () => {
    expect(capitalize("Z")).toEqual("Z");
  });

  // First char 'h' toUpperCase() => 'H'; rest 'ELLo' toLowerCase() => 'ello'; combine => 'Hello'
  it("[happy] mixed case word", () => {
    expect(capitalize("hELLo")).toEqual("Hello");
  });

  // First char 'W' stays 'W'; rest 'orld' toLowerCase() stays 'orld'; result 'World'
  it("[happy] already capitalized word", () => {
    expect(capitalize("World")).toEqual("World");
  });

  // First char '1' toUpperCase() remains '1'; rest '23abc!' toLowerCase() unchanged; result '123abc!'
  it("[edge] word with numbers and symbols", () => {
    expect(capitalize("123abc!")).toEqual("123abc!");
  });

  // First char ' ' (space) toUpperCase() stays space; rest 'hello' toLowerCase() => 'hello'; combine => ' hello'
  it("[edge] word with leading space", () => {
    expect(capitalize(" hello")).toEqual(" hello");
  });

  // Function expects string; passing null triggers runtime TypeError before length check
  it("[negative] non‑string input (null) causes TypeError", () => {
    expect(() => capitalize(null)).toThrow();
  });

  // Function expects string; passing number triggers runtime TypeError when accessing length
  it("[negative] non‑string input (number) causes TypeError", () => {
    expect(() => capitalize(42)).toThrow();
  });
});

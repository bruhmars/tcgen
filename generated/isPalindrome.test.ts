import { describe, it, expect, vi } from "vitest";
import { isPalindrome } from "../samples/isPalindrome";

describe("isPalindrome", () => {
  // Happy path
  it("[happy] simple palindrome word", () => {
    expect(isPalindrome("madam")).toBe(true);
  });

  it("[happy] palindrome with mixed case", () => {
    expect(isPalindrome("RaceCar")).toBe(true);
  });

  it("[happy] palindrome with spaces and punctuation", () => {
    expect(isPalindrome("A man, a plan, a canal: Panama")).toBe(true);
  });

  it("[happy] numeric palindrome", () => {
    expect(isPalindrome("12321")).toBe(true);
  });

  it("[happy] alphanumeric palindrome", () => {
    expect(isPalindrome("1a2b2a1")).toBe(true);
  });

  // Boundary value analysis
  it("[bva] empty string", () => {
    expect(isPalindrome("")).toBe(true);
  });

  it("[bva] single character", () => {
    expect(isPalindrome("x")).toBe(true);
  });

  it("[bva] two characters palindrome", () => {
    expect(isPalindrome("aa")).toBe(true);
  });

  it("[bva] two characters non‑palindrome", () => {
    expect(isPalindrome("ab")).toBe(false);
  });

  // Off‑by‑one length checks
  it("[off‑by‑one] length 3 palindrome", () => {
    expect(isPalindrome("aba")).toBe(true);
  });

  it("[off‑by‑one] length 3 non‑palindrome", () => {
    expect(isPalindrome("abc")).toBe(false);
  });

  // Negative cases
  it("[negative] non‑palindrome with letters", () => {
    expect(isPalindrome("hello")).toBe(false);
  });

  it("[negative] non‑palindrome with numbers and symbols", () => {
    expect(isPalindrome("123!@#321")).toBe(true);
  });

  // Edge conditions – type coercion / errors
  it("[error] null input throws", () => {
    // @ts-ignore: intentional misuse
    expect(() => isPalindrome(null)).toThrow(TypeError);
  });

  it("[error] undefined input throws", () => {
    // @ts-ignore: intentional misuse
    expect(() => isPalindrome(undefined)).toThrow(TypeError);
  });

  it("[error] non‑string object throws", () => {
    // @ts-ignore: intentional misuse
    expect(() => isPalindrome({})).toThrow(TypeError);
  });

  // Large input performance sanity check
  it("[happy] long palindrome string", () => {
    const base = "abcdefghijklmnopqrstuvwxyz";
    const long = base + base.split("").reverse().join("");
    expect(isPalindrome(long)).toBe(true);
  });
});

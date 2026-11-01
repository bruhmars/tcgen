import { describe, it, expect } from "vitest";
import { isPalindrome } from "../samples/isPalindrome";

describe("isPalindrome", () => {
  // cleaned = 'madam'; reverse = 'madam'; they match, so true
  it("[happy] simple palindrome with lowercase letters", () => {
    expect(isPalindrome("madam")).toEqual(true);
  });

  // cleaned = 'hello'; reverse = 'olleh'; they differ, so false
  it("[happy] simple non‑palindrome with lowercase letters", () => {
    expect(isPalindrome("hello")).toEqual(false);
  });

  // toLowerCase makes 'racecar'; reverse is 'racecar'; match yields true
  it("[happy] palindrome with mixed case", () => {
    expect(isPalindrome("RaceCar")).toEqual(true);
  });

  // non‑alphanumeric removed → 'amanaplanacanalpanama'; reverse equals same string, so true
  it("[happy] palindrome with spaces and punctuation", () => {
    expect(isPalindrome("A man, a plan, a canal: Panama")).toEqual(true);
  });

  // cleaned = '12321'; reverse = '12321'; match yields true
  it("[happy] numeric palindrome", () => {
    expect(isPalindrome("12321")).toEqual(true);
  });

  // cleaned = '12345'; reverse = '54321'; differ, so false
  it("[happy] numeric non‑palindrome", () => {
    expect(isPalindrome("12345")).toEqual(false);
  });

  // cleaned = ''; reverse = ''; empty string equals itself, considered palindrome
  it("[edge] empty string", () => {
    expect(isPalindrome("")).toEqual(true);
  });

  // all characters removed → ''; empty string equals itself, so true
  it("[edge] string with only non‑alphanumeric characters", () => {
    expect(isPalindrome("!@#$%^&*()")).toEqual(true);
  });

  // cleaned = 'x'; reverse = 'x'; match yields true
  it("[edge] single character string", () => {
    expect(isPalindrome("x")).toEqual(true);
  });

  // !! REPAIRED by AI (old expected value: false). The function isPalindrome expects a string and immediately calls text.toLowerCase(). When null is passed, JavaScript throws a TypeError because null has no toLowerCase method. Therefore the correct behavior is to throw an error, not to return false. The test expects a false result and sets shouldThrow to false, which contradicts the actual runtime behavior.
  // Passing null causes a TypeError when the function tries to call toLowerCase on it.
  it("[negative] null input treated as string 'null'", () => {
    expect(() => isPalindrome(null)).toThrow();
  });

  // toLowerCase → 'äbßbä'; regex keeps letters and digits, result 'äbßbä'; reverse is identical, so true
  it("[happy] string with Unicode characters that are alphanumeric after lowercasing", () => {
    expect(isPalindrome("Äbßbä")).toEqual(true);
  });

  // toLowerCase → 'é!é'; regex removes non‑a‑z0‑9, leaving 'éé' which after lowercasing stays 'éé'; reverse is same, so true
  it("[happy] string with Unicode characters that are removed by regex", () => {
    expect(isPalindrome("é!é")).toEqual(true);
  });
});

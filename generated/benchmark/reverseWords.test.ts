import { describe, it, expect } from "vitest";
import { reverseWords } from "../../benchmark/reverseWords";

describe("reverseWords", () => {
  // Trim and split yields ['hello']; reverse does not change order; join returns 'hello'.
  it("[happy] single word", () => {
    expect(reverseWords("hello")).toEqual("hello");
  });

  // Trim and split yields ['hello','world','test']; reverse gives ['test','world','hello']; join produces 'test world hello'.
  it("[happy] multiple words with single spaces", () => {
    expect(reverseWords("hello world test")).toEqual("test world hello");
  });

  // Regex \s+ collapses multiple spaces, producing ['hello','big','world']; reverse -> ['world','big','hello']; join -> 'world big hello'.
  it("[happy] multiple spaces between words", () => {
    expect(reverseWords("hello   big   world")).toEqual("world big hello");
  });

  // trim removes outer spaces, split yields ['leading','and','trailing']; reverse -> ['trailing','and','leading']; join -> 'trailing and leading'.
  it("[happy] leading and trailing spaces", () => {
    expect(reverseWords("   leading and trailing   ")).toEqual("trailing and leading");
  });

  // trim on empty string stays empty; split on empty yields ['']; filter removes empty element resulting []; reverse on empty array stays []; join on empty array returns ''.
  it("[edge] empty string", () => {
    expect(reverseWords("")).toEqual("");
  });

  // trim removes all spaces leaving ''; split yields ['']; filter removes empty entry resulting []; join on empty array returns ''.
  it("[edge] string with only spaces", () => {
    expect(reverseWords("     ")).toEqual("");
  });

  // split produces ['😀','smile','😊']; reverse -> ['😊','smile','😀']; join -> '😊 smile 😀'.
  it("[happy] unicode characters and emojis", () => {
    expect(reverseWords("😀 smile 😊")).toEqual("😊 smile 😀");
  });

  // split yields ['123','4567','89']; reverse -> ['89','4567','123']; join -> '89 4567 123'.
  it("[happy] numeric strings", () => {
    expect(reverseWords("123 4567 89")).toEqual("89 4567 123");
  });
});

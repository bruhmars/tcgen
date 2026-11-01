/** Reverses the order of the words in a sentence. Extra spaces are removed. Example: "hello  big world" becomes "world big hello". */
export function reverseWords(sentence: string): string {
  const words = sentence.trim().split(/\s+/).filter((w) => w.length > 0);
  return words.reverse().join(" ");
}

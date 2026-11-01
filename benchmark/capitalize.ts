/** Makes the first letter uppercase and the rest lowercase. An empty string returns an empty string. */
export function capitalize(word: string): string {
  if (word.length === 0) return "";
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

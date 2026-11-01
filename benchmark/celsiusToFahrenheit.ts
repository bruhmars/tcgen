/** Converts degrees Celsius to Fahrenheit. Throws if the temperature is below absolute zero (-273.15). */
export function celsiusToFahrenheit(celsius: number): number {
  if (celsius < -273.15) {
    throw new Error("below absolute zero");
  }
  return (celsius * 9) / 5 + 32;
}

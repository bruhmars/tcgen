export function applyDiscount(price: number, percent: number): number {
  if (percent < 0 || percent > 100) {
    throw new Error("Invalid discount");
  }
  return price - (price * percent) / 100;
}

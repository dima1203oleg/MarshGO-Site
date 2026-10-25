/** Format amounts in minor units with the same visible currency label in every browser. */
export function formatMoneyMinor(amountMinor: number, currency = 'UAH'): string {
  const code = currency.toUpperCase();
  const amount = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(amountMinor / 100);
  return code === 'UAH' ? `${amount}\u00a0₴` : `${amount}\u00a0${code}`;
}

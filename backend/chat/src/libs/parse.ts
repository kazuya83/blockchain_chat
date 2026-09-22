export const safeParseInt = (value: string | undefined | null, fallback: number): number => {
  if (value == null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const safeParseBigInt = (value: string | undefined | null, fallback: bigint): bigint => {
  if (value == null || value === '') return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
};

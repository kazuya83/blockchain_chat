export const validate = <T>(value: T | null | undefined, key?: string): T => {
  if (value == null) {
    throw new Error(`validate failed: ${key}`);
  }
  return value;
};

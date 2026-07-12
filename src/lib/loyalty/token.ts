export const LOYALTY_TOKEN_PATTERN = /^ls1_[A-Za-z0-9_-]{43}$/;

export function isLoyaltyToken(value: string): boolean {
  return LOYALTY_TOKEN_PATTERN.test(value.trim());
}

export function normalizeScannedToken(value: string): string | null {
  const token = value.trim();
  return isLoyaltyToken(token) ? token : null;
}

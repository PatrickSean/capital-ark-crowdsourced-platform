export const INSECURE_DEVELOPMENT_IP_HASH_SALT =
  "dev-only-insecure-salt";

const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;

/** IP hashing and local-session HMACs require a stable, non-placeholder key. */
export function isUsableProductionIpHashSalt(
  value: string | undefined,
): value is string {
  return Boolean(
      value &&
      value !== INSECURE_DEVELOPMENT_IP_HASH_SALT &&
      value.trim().length >= MINIMUM_PRODUCTION_SECRET_LENGTH,
  );
}

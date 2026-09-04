/**
 * Single source of truth for the JWT signing secret.
 *
 * Why this file exists: the secret used to be read as
 *   process.env.JWT_SECRET || "dev_secret_change_me"
 * in three separate places. That fallback is convenient locally but dangerous
 * in production — if JWT_SECRET is ever missing from the deployed environment,
 * tokens get signed with a value that is published in this repository, so
 * anyone can forge a session cookie for any user, including an ADMIN.
 *
 * So: keep the convenience in development, but fail loudly at startup in
 * production rather than silently accepting forgeable tokens.
 */

const DEV_FALLBACK = "dev_secret_change_me";

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === DEV_FALLBACK) {
      throw new Error(
        "JWT_SECRET is not set (or is still the development fallback). " +
          "Refusing to start in production: session tokens would be forgeable. " +
          "Generate one with `openssl rand -hex 32` and set JWT_SECRET in the environment."
      );
    }
    return secret;
  }

  return secret || DEV_FALLBACK;
}

export const JWT_SECRET = resolveJwtSecret();

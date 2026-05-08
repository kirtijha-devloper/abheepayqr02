const isProduction = process.env.NODE_ENV === "production";

export type DatabaseTarget = "local" | "neon" | "default";

function normalizeDatabaseTarget(value?: string | null): DatabaseTarget {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "local") return "local";
  if (normalized === "neon") return "neon";
  return "default";
}

export function resolveDatabaseConfig() {
  const target = normalizeDatabaseTarget(process.env.DATABASE_TARGET);
  const defaultUrl = process.env.DATABASE_URL;
  const localUrl = process.env.DATABASE_URL_LOCAL;
  const neonUrl = process.env.DATABASE_URL_NEON;

  if (target === "local") {
    if (!localUrl) {
      throw new Error("DATABASE_TARGET is set to 'local' but DATABASE_URL_LOCAL is missing.");
    }
    return { target, url: localUrl };
  }

  if (target === "neon") {
    if (!neonUrl) {
      throw new Error("DATABASE_TARGET is set to 'neon' but DATABASE_URL_NEON is missing.");
    }
    return { target, url: neonUrl };
  }

  if (!defaultUrl) {
    throw new Error("DATABASE_URL is missing. Set DATABASE_URL, or use DATABASE_TARGET with DATABASE_URL_LOCAL / DATABASE_URL_NEON.");
  }

  return { target, url: defaultUrl };
}

export const validateEnv = () => {
  if (!isProduction) return;

  const requiredVariables = ["JWT_SECRET", "FRONTEND_URL"];
  const missing = requiredVariables.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `The following environment variables are required in production but missing: ${missing.join(
        ", "
      )}. Please add them to your Vercel project settings.`
    );
  }

  resolveDatabaseConfig();
};

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (isProduction) {
    validateEnv(); // This will throw if missing
  }

  return "dev-secret-local-only";
};

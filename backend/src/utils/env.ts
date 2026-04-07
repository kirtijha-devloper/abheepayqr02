const isProduction = process.env.NODE_ENV === "production";

export const validateEnv = () => {
  if (!isProduction) return;

  const requiredVariables = ["JWT_SECRET", "DATABASE_URL", "FRONTEND_URL"];
  const missing = requiredVariables.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `The following environment variables are required in production but missing: ${missing.join(
        ", "
      )}. Please add them to your Vercel project settings.`
    );
  }
};

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (isProduction) {
    validateEnv(); // This will throw if missing
  }

  return "dev-secret-local-only";
};

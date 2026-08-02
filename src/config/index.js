const env = process.env;

export const config = {
  env: env.NODE_ENV || "development",
  isProduction: env.NODE_ENV === "production",
  isDevelopment: env.NODE_ENV !== "production",

  app: {
    name: env.NEXT_PUBLIC_APP_NAME || "AdsBuzz ERP",
    siteUrl: env.NEXT_PUBLIC_SITE_URL || "",
    apiUrl: env.NEXT_PUBLIC_API_URL || "",
  },

  db: {
    uri: env.MONGODB_URI || "",
    name: env.MONGODB_DB_NAME || "ad_buzz",
  },

  auth: {
    jwtSecret: env.JWT_SECRET || "",
  },

  upload: {
    path: env.UPLOAD_PATH || "uploads",
  },

  logLevel: env.LOG_LEVEL || "info",
};

export default config;

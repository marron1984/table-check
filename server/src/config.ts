export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  database: {
    url: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/tablecheck_crm",
  },

  tableCheck: {
    apiBaseUrl: process.env.TABLECHECK_API_BASE_URL || "https://api.tablecheck.com/v2",
    apiKey: process.env.TABLECHECK_API_KEY || "",
    apiSecret: process.env.TABLECHECK_API_SECRET || "",
    franchiseId: process.env.TABLECHECK_FRANCHISE_ID || "",
    syncWebhookSecret: process.env.TABLECHECK_SYNC_WEBHOOK_SECRET || "",
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    sessionExpiryHours: parseInt(process.env.SESSION_EXPIRY_HOURS || "24", 10),
  },

  sync: {
    backfillMonths: 24,
    batchSize: 100,
    maxRetries: 3,
    retryDelayMs: 2000,
    slaMaxDelayMinutes: 30,
  },
} as const;

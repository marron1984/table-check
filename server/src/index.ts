import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { logger } from "./logger";
import { prisma } from "./db";
import { seedTagDefinitions } from "./services/tagging";

import reservationRoutes from "./routes/reservations";
import customerRoutes from "./routes/customers";
import tagRoutes from "./routes/tags";
import syncRoutes from "./routes/sync";
import dashboardRoutes from "./routes/dashboard";

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/reservations", reservationRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "内部エラーが発生しました" });
});

async function start() {
  try {
    await prisma.$connect();
    logger.info("Database connected");

    // 初期タグ定義のシード
    await seedTagDefinitions();

    app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

start();

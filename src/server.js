const http = require("node:http");
const { createApp } = require("./app");
const { config } = require("./config/env");
const { pool, pingDatabase } = require("./config/database");
const { sessionStore, sessionStoreReady } = require("./config/session");
const triviaService = require("./services/trivia.service");
const { logger } = require("./utils/logger");

const app = createApp();
const server = http.createServer(app);
let shuttingDown = false;

async function start() {
  await pingDatabase();
  await sessionStoreReady;
  await triviaService.expireStaleAttempts();

  server.listen(config.port, "0.0.0.0", () => {
    logger.info("server_started");
  });
}

const expiryTimer = setInterval(() => {
  triviaService.expireStaleAttempts().catch((error) => {
    logger.warn("trivia_expiration_failed", { message: error.message });
  });
}, 60_000);
expiryTimer.unref();

async function closeSessionStore() {
  if (typeof sessionStore.close !== "function") {
    return;
  }
  await sessionStore.close();
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(expiryTimer);
  logger.info("server_shutdown_started", { signal });

  const forceTimer = setTimeout(() => {
    logger.error("server_shutdown_forced", { signal });
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  server.close(async () => {
    try {
      await closeSessionStore();
      await pool.end();
      clearTimeout(forceTimer);
      logger.info("server_shutdown_completed", { signal });
      process.exit(exitCode);
    } catch (error) {
      logger.error("server_shutdown_failed", { message: error.message });
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", { reason: String(reason) });
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  logger.error("uncaught_exception", {
    message: error.message,
    stack: error.stack,
  });
  shutdown("uncaughtException", 1);
});

start().catch((error) => {
  logger.error("server_start_failed", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";
const pretty = process.env.NODE_ENV !== "production";

export const logger = pino({
  level,
  base: { service: process.env.DAYWISE_SERVICE ?? "app" },
  ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
});

export type Logger = typeof logger;

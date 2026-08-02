import config from "@/config";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function shouldLog(level) {
  return level >= currentLevel;
}

function formatArgs(args) {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return arg.stack || arg.message;
    }
    if (typeof arg === "object" && arg !== null) {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return arg;
  });
}

function write(level, label, args) {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${label}] ${formatArgs(args).join(" ")}`);
}

export const logger = {
  debug: (...args) => write(LEVELS.debug, "DEBUG", args),
  info: (...args) => write(LEVELS.info, "INFO", args),
  warn: (...args) => write(LEVELS.warn, "WARN", args),
  error: (...args) => write(LEVELS.error, "ERROR", args),
};

export default logger;

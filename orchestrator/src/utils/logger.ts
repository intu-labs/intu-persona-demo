export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFileLogging: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole:
        typeof window === "undefined" || process.env.NODE_ENV === "development",
      enableFileLogging: false,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private formatMessage(category: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${category}] ${message}`;
  }

  private log(
    level: LogLevel,
    category: string,
    message: string,
    ...args: any[]
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(category, message);

      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage, ...args);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, ...args);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, ...args);
          break;
        case LogLevel.DEBUG:
          console.log(formattedMessage, ...args);
          break;
      }
    }
  }

  error(category: string, message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, category, message, ...args);
  }

  warn(category: string, message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, category, message, ...args);
  }

  info(category: string, message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, category, message, ...args);
  }

  debug(category: string, message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, category, message, ...args);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setConsoleLogging(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }
}

const logLevel =
  process.env.LOG_LEVEL === "debug"
    ? LogLevel.DEBUG
    : process.env.LOG_LEVEL === "info"
    ? LogLevel.INFO
    : process.env.LOG_LEVEL === "warn"
    ? LogLevel.WARN
    : process.env.LOG_LEVEL === "error"
    ? LogLevel.ERROR
    : LogLevel.ERROR;

const isProduction = process.env.NODE_ENV === "production";

export const logger = new Logger({
  level: logLevel,
  enableConsole: !isProduction,
  enableFileLogging: false,
});

export default logger;

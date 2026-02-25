type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

const logs: LogEntry[] = [];
const MAX_LOGS = 200;
let listeners: (() => void)[] = [];

function addEntry(level: LogLevel, message: string) {
  const entry: LogEntry = {
    timestamp: new Date().toLocaleTimeString("pt-BR"),
    level,
    message: typeof message === "string" ? message : JSON.stringify(message),
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.pop();
  listeners.forEach((fn) => fn());
}

export const logger = {
  info: (...args: any[]) => {
    const msg = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    addEntry("info", msg);
    console.log("[INFO]", ...args);
  },
  warn: (...args: any[]) => {
    const msg = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    addEntry("warn", msg);
    console.warn("[WARN]", ...args);
  },
  error: (...args: any[]) => {
    const msg = args.map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack}`;
      return typeof a === "string" ? a : JSON.stringify(a);
    }).join(" ");
    addEntry("error", msg);
    console.error("[ERROR]", ...args);
  },
  getLogs: () => [...logs],
  clear: () => {
    logs.length = 0;
    listeners.forEach((fn) => fn());
  },
  subscribe: (fn: () => void) => {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  },
};

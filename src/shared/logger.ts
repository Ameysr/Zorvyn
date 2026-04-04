import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage for correlation ID propagation across async boundaries
export const asyncLocalStorage = new AsyncLocalStorage<Map<string, string>>();

/**
 * Get correlation ID from current async context.
 * Available anywhere in the call stack without prop drilling.
 */
export function getCorrelationId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.get('correlationId');
}

/**
 * Get the current user ID from async context (set by auth middleware).
 */
export function getContextUserId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.get('userId');
}

/**
 * Pino structured logger with correlation ID injection.
 * 
 * Every log line automatically includes:
 * - correlationId (from AsyncLocalStorage)
 * - timestamp (ISO 8601)
 * - level, msg, and any additional context
 */
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive fields from logs — compliance requirement
  redact: {
    paths: [
      'password',
      'password_hash',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  // Custom serializers
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      correlationId: req.correlationId,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

/**
 * Logger proxy that auto-injects correlationId from AsyncLocalStorage.
 * Usage: logger.info({ route: '/api/v1/records' }, 'Records fetched');
 */
export const logger = new Proxy(baseLogger, {
  get(target, prop: string) {
    const original = (target as Record<string, unknown>)[prop];
    if (typeof original === 'function' && ['fatal', 'error', 'warn', 'info', 'debug', 'trace'].includes(prop)) {
      return (...args: unknown[]) => {
        const correlationId = getCorrelationId();
        const userId = getContextUserId();

        // If first arg is an object, merge correlationId into it
        if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
          args[0] = { correlationId, userId, ...args[0] as object };
        } else if (args.length > 0 && typeof args[0] === 'string') {
          // If first arg is a string message, prepend context object
          args.unshift({ correlationId, userId });
        }

        return (original as Function).apply(target, args);
      };
    }
    return original;
  },
});

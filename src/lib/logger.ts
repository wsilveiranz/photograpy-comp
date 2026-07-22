// Minimal structured logger. Replace console with a real logger later if needed.
// Every log entry should carry an `operation` field plus enough context to reproduce.

type LogContext = Record<string, unknown> & { operation: string };

function emit(level: 'info' | 'warn' | 'error', ctx: LogContext, msg: string) {
  // eslint-disable-next-line no-console
  console[level](JSON.stringify({ level, msg, ...ctx }));
}

export const logger = {
  info: (ctx: LogContext, msg: string) => emit('info', ctx, msg),
  warn: (ctx: LogContext, msg: string) => emit('warn', ctx, msg),
  error: (ctx: LogContext, msg: string) => emit('error', ctx, msg),
};

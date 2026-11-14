type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  if (level === 'info') {
    console.log(line);
  } else {
    console.error(line);
  }
}

export const logger = {
  info(message: string): void {
    write('info', message);
  },
  warn(message: string): void {
    write('warn', message);
  },
  error(message: string): void {
    write('error', message);
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

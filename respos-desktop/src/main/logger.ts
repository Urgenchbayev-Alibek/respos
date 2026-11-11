import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error';
export type Logger = (level: LogLevel, message: string) => void;

const MAX_LOG_BYTES = 1_000_000;

/**
 * Console + `<logDir>/main.log` (one previous file is kept as `main.old.log`). A packaged Windows app has no
 * console, so the file is what support asks for. Log lines carry no tokens, cookies or request bodies.
 */
export function createLogger(logDir: string): Logger {
  const file = path.join(logDir, 'main.log');
  let queue: Promise<void> = mkdir(logDir, { recursive: true })
    .then(async () => {
      const stats = await stat(file).catch(() => null);
      if (stats && stats.size > MAX_LOG_BYTES) await rename(file, path.join(logDir, 'main.old.log'));
    })
    .catch((error: unknown) => {
      console.error('[desktop] log file is unavailable:', error);
    });

  return (level, message) => {
    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
    queue = queue
      .then(() => appendFile(file, `${line}\n`, 'utf8'))
      .catch((error: unknown) => {
        console.error('[desktop] cannot write the log file:', error);
      });
  };
}

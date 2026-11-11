import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  type DesktopSettings,
  parseSettings,
} from '../shared/settings-schema';

export type SettingsLogger = (level: 'info' | 'warn' | 'error', message: string) => void;

const RENAME_ATTEMPTS = 5;
const RENAME_RETRY_MS = 40;
/** Windows reports these while another process (antivirus, indexer) briefly holds the destination open. */
const TRANSIENT_RENAME_ERRORS = new Set(['EPERM', 'EACCES', 'EBUSY']);

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `settings.json` in the user-data folder: schema-validated on load (a broken file is set aside, never fatal),
 * written atomically (temp file → fsync → rename) and one write at a time. Holds no secrets.
 */
export class SettingsStore {
  private current: DesktopSettings = { ...DEFAULT_SETTINGS };
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly log: SettingsLogger = () => undefined,
  ) {}

  /** The settings currently in effect (a copy: callers cannot mutate the store). */
  get(): DesktopSettings {
    return { ...this.current, windowBounds: this.current.windowBounds ? { ...this.current.windowBounds } : null };
  }

  async load(): Promise<DesktopSettings> {
    let text: string;
    try {
      text = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') this.log('warn', `settings file is unreadable (${errorCode(error)}); using defaults`);
      this.current = { ...DEFAULT_SETTINGS };
      return this.get();
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    } catch {
      await this.setAsideCorruptFile();
      this.current = { ...DEFAULT_SETTINGS };
      return this.get();
    }
    const { settings, issues } = parseSettings(raw);
    if (issues.length > 0) this.log('warn', `settings file has invalid fields, defaults used for: ${issues.join(', ')}`);
    this.current = settings;
    return this.get();
  }

  /** Resolves once every write requested so far has finished (whether it succeeded or not). */
  async flush(): Promise<void> {
    await this.queue;
  }

  /**
   * Merges `patch` into the settings and persists the result. The merged object goes through the same schema
   * as a loaded file; a patch with an invalid field is rejected as a whole and nothing is written.
   */
  update(patch: Partial<DesktopSettings>): Promise<DesktopSettings> {
    const run = async (): Promise<DesktopSettings> => {
      const merged = { ...this.current, ...patch };
      const { settings, issues } = parseSettings(merged);
      if (issues.length > 0) throw new Error(`Invalid settings: ${issues.join(', ')}`);
      await this.writeAtomically(settings);
      this.current = settings;
      return this.get();
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async setAsideCorruptFile(): Promise<void> {
    const backup = path.join(path.dirname(this.filePath), 'settings.corrupt.json');
    try {
      await rename(this.filePath, backup);
      this.log('warn', `settings file is not valid JSON; kept as ${path.basename(backup)}, using defaults`);
    } catch (error) {
      this.log('warn', `settings file is not valid JSON and could not be set aside (${errorCode(error)})`);
    }
  }

  private async writeAtomically(settings: DesktopSettings): Promise<void> {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `.settings-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
    try {
      const handle = await open(temporary, 'w');
      try {
        await handle.writeFile(`${JSON.stringify(settings, null, 2)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.replaceFile(temporary);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  private async replaceFile(temporary: string): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await rename(temporary, this.filePath);
        return;
      } catch (error) {
        if (attempt >= RENAME_ATTEMPTS || !TRANSIENT_RENAME_ERRORS.has(errorCode(error))) throw error;
        await delay(RENAME_RETRY_MS * attempt);
      }
    }
  }
}

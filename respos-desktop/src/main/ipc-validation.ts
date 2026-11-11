import { PRINT_PAPERS, type PrintOptions, type PrintPaper } from '../shared/ipc';

const MAX_SERVER_URL_LENGTH = 2048;

/** Thrown by a validator: the call is answered with a generic "Bad request", details go to the log only. */
export class IpcRejection extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

export function expectNoArguments(args: readonly unknown[]): void {
  if (args.length !== 0) throw new IpcRejection('unexpected arguments');
}

/** `print(options?)`: nothing, or an object whose only allowed key is `paper` with a known value. */
export function parsePrintOptions(args: readonly unknown[]): PrintOptions {
  if (args.length > 1) throw new IpcRejection('unexpected arguments');
  const [raw] = args;
  if (raw === undefined || raw === null) return {};
  if (!isPlainObject(raw)) throw new IpcRejection('invalid print options');
  const keys = Object.keys(raw);
  if (keys.some((key) => key !== 'paper')) throw new IpcRejection('invalid print options');
  if (raw.paper === undefined) return {};
  if (typeof raw.paper !== 'string' || !(PRINT_PAPERS as readonly string[]).includes(raw.paper)) {
    throw new IpcRejection('invalid paper');
  }
  return { paper: raw.paper as PrintPaper };
}

export function parseServerUrlArgument(args: readonly unknown[]): string {
  const [raw] = args;
  if (args.length !== 1 || typeof raw !== 'string' || raw.length > MAX_SERVER_URL_LENGTH) {
    throw new IpcRejection('invalid server address');
  }
  return raw;
}

export function parseSingleArgument(args: readonly unknown[]): unknown {
  if (args.length !== 1) throw new IpcRejection('unexpected arguments');
  return args[0];
}

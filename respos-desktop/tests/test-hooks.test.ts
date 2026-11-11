import { describe, expect, it } from 'vitest';
import { pathForLog } from '../src/gateway/headers';
import { remoteDebuggingRefused, resolveTestOverrides } from '../src/main/test-hooks';

const ENV = {
  RESPOS_DESKTOP_USER_DATA: 'D:/tmp/profile',
  RESPOS_DESKTOP_GATEWAY_PORT: '0',
  RESPOS_DESKTOP_PRINT_CAPTURE: 'D:/tmp/print.jsonl',
};
const DEFAULT_PORT = 47_615;

describe('test hooks', () => {
  it('are honoured by a development build', () => {
    expect(resolveTestOverrides(ENV, { isPackaged: false, e2eSwitch: false }, DEFAULT_PORT)).toEqual({
      userDataDir: 'D:/tmp/profile',
      gatewayPort: 0,
      printCaptureFile: 'D:/tmp/print.jsonl',
    });
  });

  it('are ignored by an installed app: no profile swap, no print capture, the default port', () => {
    expect(resolveTestOverrides(ENV, { isPackaged: true, e2eSwitch: false }, DEFAULT_PORT)).toEqual({
      userDataDir: null,
      gatewayPort: DEFAULT_PORT,
      printCaptureFile: null,
    });
  });

  it('work in an installed app only when it is started with the e2e switch', () => {
    const overrides = resolveTestOverrides(ENV, { isPackaged: true, e2eSwitch: true }, DEFAULT_PORT);
    expect(overrides.userDataDir).toBe('D:/tmp/profile');
    expect(overrides.printCaptureFile).toBe('D:/tmp/print.jsonl');
  });

  it('fall back to the defaults when nothing (or a bad port) is set', () => {
    const context = { isPackaged: false, e2eSwitch: false };
    expect(resolveTestOverrides({}, context, DEFAULT_PORT)).toEqual({ userDataDir: null, gatewayPort: DEFAULT_PORT, printCaptureFile: null });
    expect(resolveTestOverrides({ RESPOS_DESKTOP_GATEWAY_PORT: '70000' }, context, DEFAULT_PORT).gatewayPort).toBe(DEFAULT_PORT);
  });

  it('remote debugging is refused by an installed app without the e2e switch', () => {
    expect(remoteDebuggingRefused({ isPackaged: true, e2eSwitch: false }, true)).toBe(true);
    expect(remoteDebuggingRefused({ isPackaged: true, e2eSwitch: true }, true)).toBe(false);
    expect(remoteDebuggingRefused({ isPackaged: false, e2eSwitch: false }, true)).toBe(false);
    expect(remoteDebuggingRefused({ isPackaged: true, e2eSwitch: false }, false)).toBe(false);
  });
});

describe('pathForLog', () => {
  it('drops the query and the fragment, which may carry the hub access token', () => {
    expect(pathForLog('/hubs/restaurant?id=1&access_token=SECRET')).toBe('/hubs/restaurant');
    expect(pathForLog('/api/v1/customers?search=998901234567#x')).toBe('/api/v1/customers');
    expect(pathForLog('/api/v1/orders')).toBe('/api/v1/orders');
    expect(pathForLog(undefined)).toBe('');
  });
});

/** Command-line switch that lets a PACKAGED build honour the test hooks below (end-to-end runs of the exe). */
export const E2E_SWITCH = 'respos-e2e';

export interface TestOverrides {
  /** Folder used instead of %APPDATA%/RestaurantOS, or null for the real profile. */
  userDataDir: string | null;
  gatewayPort: number;
  printCaptureFile: string | null;
}

export interface TestHookContext {
  isPackaged: boolean;
  /** `--respos-e2e` is on the command line. */
  e2eSwitch: boolean;
}

/** A development build always honours the hooks; an installed one only when it was started for a test run. */
export function testHooksAllowed(context: TestHookContext): boolean {
  return !context.isPackaged || context.e2eSwitch;
}

/**
 * Test hooks (end-to-end runs only, never set for users):
 * - RESPOS_DESKTOP_USER_DATA — use this folder instead of %APPDATA%/RestaurantOS (settings, session, lock);
 * - RESPOS_DESKTOP_GATEWAY_PORT — gateway port to try first (`0` = any free port);
 * - RESPOS_DESKTOP_PRINT_CAPTURE — file that receives the print jobs instead of a printer (print-capture.ts).
 * An installed app ignores all three: a stray environment variable must never swallow receipts or swap the profile.
 */
export function resolveTestOverrides(
  env: Readonly<Record<string, string | undefined>>,
  context: TestHookContext,
  defaultGatewayPort: number,
): TestOverrides {
  if (!testHooksAllowed(context)) return { userDataDir: null, gatewayPort: defaultGatewayPort, printCaptureFile: null };
  const rawPort = env.RESPOS_DESKTOP_GATEWAY_PORT;
  const port = Number(rawPort);
  const hasPort = rawPort !== undefined && rawPort !== '' && Number.isInteger(port) && port >= 0 && port <= 65_535;
  return {
    userDataDir: env.RESPOS_DESKTOP_USER_DATA || null,
    gatewayPort: hasPort ? port : defaultGatewayPort,
    printCaptureFile: env.RESPOS_DESKTOP_PRINT_CAPTURE || null,
  };
}

/** Chromium's remote debugging gives any local process the session cookie and the bridge: installed apps refuse it. */
export function remoteDebuggingRefused(context: TestHookContext, remoteDebuggingRequested: boolean): boolean {
  return remoteDebuggingRequested && !testHooksAllowed(context);
}

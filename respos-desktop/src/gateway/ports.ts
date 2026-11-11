/**
 * Ports Chromium refuses to connect to (ERR_UNSAFE_PORT), from net/base/port_util.cc. The renderer could never
 * load the web app from a gateway listening on one of them, so the gateway must not end up there — and on a PC
 * whose dynamic port range starts low, the OS does hand such ports out as "any free port".
 */
const BROWSER_RESTRICTED_PORTS: ReadonlySet<number> = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110,
  111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061,
  6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);

/** True when a Chromium renderer is allowed to open `http://127.0.0.1:<port>/`. */
export function isBrowserSafePort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65_535 && !BROWSER_RESTRICTED_PORTS.has(port);
}

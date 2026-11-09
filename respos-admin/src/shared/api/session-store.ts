import { DEFAULT_LANGUAGE, STORAGE_KEYS, type Language } from '@/shared/constants/locale';
import { safeStorage } from '@/shared/lib/safe-storage';

/**
 * Request context used by the api-client and realtime hub.
 * Access token lives in MEMORY ONLY (never storage). Branch id is not a secret and is persisted.
 */
type Listener = () => void;

let accessToken: string | null = null;
let branchId: string | null = safeStorage.get(STORAGE_KEYS.branchId);
let language: Language = DEFAULT_LANGUAGE;
const sessionExpiredListeners = new Set<Listener>();

export const sessionStore = {
  getLanguage: (): Language => language,
  /** Kept in sync by shared/i18n on every language change (used for Accept-Language). */
  setLanguage(next: Language): void {
    language = next;
  },
  getAccessToken: (): string | null => accessToken,
  setAccessToken(token: string | null): void {
    accessToken = token;
  },
  getBranchId: (): string | null => branchId,
  setBranchId(id: string | null): void {
    branchId = id;
    if (id) safeStorage.set(STORAGE_KEYS.branchId, id);
    else safeStorage.remove(STORAGE_KEYS.branchId);
  },
  /** Fired when refresh failed and the user must log in again. */
  onSessionExpired(listener: Listener): () => void {
    sessionExpiredListeners.add(listener);
    return () => sessionExpiredListeners.delete(listener);
  },
  notifySessionExpired(): void {
    accessToken = null;
    sessionExpiredListeners.forEach((listener) => listener());
  },
};

import { env } from '@/shared/config/env';
import { apiRequest } from './client';

/** `GET /public/menu/{branchSlug}` (respos-contracts/v2/F3-delivery.md). */
export interface PublicMenuVariant {
  id: string;
  name: string;
  price: number;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  nameUz: string | null;
  description: string | null;
  photoUrl: string | null;
  price: number;
  variants: PublicMenuVariant[];
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  nameUz: string | null;
  items: PublicMenuItem[];
}

export interface PublicMenu {
  organizationName: string;
  currency: string;
  isDemo: boolean;
  branch: { slug: string; name: string; address: string | null; phone: string | null };
  categories: PublicMenuCategory[];
}

export type WaiterCallReason = 'call' | 'bill';

const slugPath = (slug: string) => `/public/menu/${encodeURIComponent(slug)}`;

export const fetchPublicMenu = (slug: string, signal?: AbortSignal): Promise<PublicMenu> =>
  apiRequest<PublicMenu>(slugPath(slug), { signal });

export const callWaiter = (slug: string, tableNumber: string, reason: WaiterCallReason, language?: string): Promise<unknown> =>
  apiRequest<unknown>(`${slugPath(slug)}/call-waiter`, { method: 'POST', body: { tableNumber, reason }, language });

/** Menu photos are served by the API host; relative URLs (`/files/...`) are resolved against it. */
export function resolvePhotoUrl(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  return `${new URL(env.apiBaseUrl).origin}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
}

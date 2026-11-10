import { apiRequest } from './client';

export interface DemoRequestPayload {
  name: string;
  phone: string;
  email?: string;
  restaurantName: string;
  city?: string;
  message?: string;
  /** Honeypot: must stay empty for humans. */
  website: string;
}

export interface PublicPlan {
  code: string;
  name: string;
  maxBranches: number;
  maxUsers: number;
  features: string[];
}

export const submitDemoRequest = (payload: DemoRequestPayload, language?: string): Promise<void> =>
  apiRequest<void>('/public/demo-requests', { method: 'POST', body: payload, language });

export const fetchPublicPlans = (signal?: AbortSignal): Promise<PublicPlan[]> =>
  apiRequest<PublicPlan[]>('/public/plans', { signal });

/** F7 online reservations (respos-contracts/v2/F7-integrations.md). Keyed by branch id until branch slugs exist. */
export interface PublicSlot {
  time: string;
  startsAt: string;
  available: boolean;
}

export interface PublicAvailability {
  branchId: string;
  branchName: string;
  date: string;
  timezone: string;
  durationMinutes: number;
  maxGuests: number;
  slots: PublicSlot[];
}

export interface PublicReservationPayload {
  date: string;
  time: string;
  guests: number;
  name: string;
  phone: string;
  comment?: string;
  /** Honeypot: must stay empty for humans. */
  website: string;
}

export interface PublicReservationCreated {
  reservationId: string;
  status: 'pending';
  startsAt: string;
  endsAt: string;
  guests: number;
  branchName: string;
}

const branchPath = (branchId: string) => `/public/branches/${encodeURIComponent(branchId)}`;

export const fetchAvailability = (branchId: string, date: string, guests: number, signal?: AbortSignal): Promise<PublicAvailability> =>
  apiRequest<PublicAvailability>(`${branchPath(branchId)}/availability?date=${encodeURIComponent(date)}&guests=${guests}`, { signal });

export const createPublicReservation = (
  branchId: string,
  payload: PublicReservationPayload,
  language?: string,
): Promise<PublicReservationCreated> =>
  apiRequest<PublicReservationCreated>(`${branchPath(branchId)}/reservations`, { method: 'POST', body: payload, language });

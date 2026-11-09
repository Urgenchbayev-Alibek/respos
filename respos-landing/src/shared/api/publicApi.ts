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

import { apiGet } from '../lib/apiClient';
import type { Result } from '../types';

export interface CurrentUser {
  userId: string;
  userDetails: string;
  displayName: string;
  isAdmin: boolean;
  isApproved: boolean;
}

export function getCurrentUser(): Promise<Result<CurrentUser>> {
  return apiGet<CurrentUser>('/me');
}

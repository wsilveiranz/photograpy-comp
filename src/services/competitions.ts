// Competitions service — components call this, never fetch/storage directly.
// Placeholder shell: no real implementation yet.

import { apiGet } from '../lib/apiClient';
import type { Competition, Result } from '../types';

export async function listCompetitions(): Promise<Result<Competition[]>> {
  return apiGet<Competition[]>('/competitions');
}

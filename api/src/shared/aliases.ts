import type { ClientPrincipal } from './auth';

const ADJECTIVES = [
  'Amber',
  'Bright',
  'Calm',
  'Clever',
  'Golden',
  'Happy',
  'Kind',
  'Lively',
  'Silver',
  'Sunny',
  'Swift',
  'Vivid',
] as const;

const NOUNS = [
  'Albatross',
  'Fantail',
  'Falcon',
  'Kea',
  'Kingfisher',
  'Kookaburra',
  'Penguin',
  'Robin',
  'Tern',
  'Tui',
  'Weka',
  'Wren',
] as const;

export function deriveAlias(principal: ClientPrincipal): string {
  const hash = hashString(principal.userId);
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length];
  const suffix = 10 + (hash % 90);
  return `${adjective} ${noun} ${suffix}`;
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

import type { DomainId } from './types';

export interface Area {
  domain: DomainId;
  label: string;
}

export const AREAS: Area[] = [
  { domain: 'PHN', label: '80 KM' },
  { domain: '240KM', label: '240 KM' },
  { domain: 'CAMBODIA', label: '450 KM' }
];

export const DEFAULT_DOMAIN: DomainId = 'PHN';

/** Human-readable label for a radar domain. */
export function areaLabel(domain: DomainId): string {
  return AREAS.find((area) => area.domain === domain)?.label ?? domain;
}

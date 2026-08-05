import type { TicketCatalogItem } from '../shared/types.js';

export function catalogLabel(items: TicketCatalogItem[], code: string): string {
  return items.find((item) => item.code === code)?.label ?? code;
}

export function catalogStyleModifier(code: string, styledCodes: readonly string[]): string {
  return styledCodes.includes(code) ? code : 'default';
}

export function domToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function initials(identity: string): string {
  const name = identity.split('@')[0].replace(/[._-]+/g, ' ');
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

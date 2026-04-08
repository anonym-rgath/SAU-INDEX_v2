import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(date));
}

const ROLE_LABELS = {
  admin: 'Admin',
  spiess: 'Spieß',
  vorstand: 'Vorstand',
  mitglied: 'Mitglied',
};

export function displayRole(role) {
  return ROLE_LABELS[role] || role;
}
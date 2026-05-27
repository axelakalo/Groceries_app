/** Application name */
export const APP_NAME = 'PantrySync';

/** App description for meta tags and PWA manifest */
export const APP_DESCRIPTION = 'Shared grocery list and pantry tracker';

/** Theme colors — keep in sync with globals.css and manifest */
export const THEME = {
  /** Primary accent color (blue-500) */
  accent: '#3b82f6',
  /** Background color (zinc-950) */
  background: '#09090b',
  /** Surface/card color (zinc-900) */
  surface: '#18181b',
  /** Default text color (zinc-100) */
  text: '#f4f4f5',
  /** Muted text color (zinc-400) */
  textMuted: '#a1a1aa',
} as const;

/** Storage location options for pantry items */
export const STORAGE_LOCATIONS = ['pantry', 'fridge', 'freezer', 'other'] as const;
export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

/** Shared item categories for pantry and grocery workflows */
export const ITEM_CATEGORIES = [
  'Produce',
  'Meat',
  'Dairy',
  'Frozen',
  'Snacks',
  'Drinks',
  'Pantry',
  'Cleaning',
  'Personal Care',
  'Pet',
  'Other',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Pantry item status options */
export const ITEM_STATUSES = ['active', 'used', 'discarded'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Household member roles */
export const MEMBER_ROLES = ['owner', 'member'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

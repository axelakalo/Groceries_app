import type { ActivityEvent } from '../services/activityService';

export function getActivityItemName(event: ActivityEvent) {
  return typeof event.metadata.name === 'string' ? event.metadata.name : 'an item';
}

export function describeActivityEvent(event: ActivityEvent) {
  const itemName = getActivityItemName(event);

  switch (event.event_type) {
    case 'grocery_item_added':
      return `added ${itemName}`;
    case 'grocery_item_checked':
      return `checked off ${itemName}`;
    case 'grocery_item_unchecked':
      return `put ${itemName} back on the list`;
    case 'grocery_item_deleted':
      return `deleted ${itemName}`;
    case 'pantry_item_added':
      return `added ${itemName} to the pantry`;
    case 'pantry_item_used':
      return `used ${itemName}`;
    case 'pantry_item_discarded':
      return `threw away ${itemName}`;
    case 'pantry_item_restored':
      return `restored ${itemName}`;
    case 'pantry_item_added_to_grocery':
      return `added ${itemName} to groceries`;
    default:
      return 'updated the household';
  }
}

export function formatActivityRelativeTime(iso: string) {
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

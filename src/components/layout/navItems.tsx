import type { ReactNode } from 'react';

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
  icon: ReactNode;
}

const iconClassName = 'h-5 w-5';

export const navItems: NavItem[] = [
  {
    label: 'Home',
    to: '/app',
    end: true,
    icon: (
      <svg className={iconClassName} fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 10.75 12 3l9 7.75V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.25Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    label: 'Grocery',
    to: '/app/grocery',
    icon: (
      <svg className={iconClassName} fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 6h15l-2 8H8L6 3H3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M9 20.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM18 20.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    label: 'Pantry',
    to: '/app/pantry',
    icon: (
      <svg className={iconClassName} fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 4h14v17H5V4ZM8 4v17M16 4v17M5 11h14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M11 7h2M11 15h2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    label: 'Scan',
    to: '/app/scan',
    icon: (
      <svg className={iconClassName} fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10M9 9h6M9 15h6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    label: 'Settings',
    to: '/app/settings',
    icon: (
      <svg className={iconClassName} fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 7h9M17 7h3M4 17h3M11 17h9M7 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM13 17a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
];

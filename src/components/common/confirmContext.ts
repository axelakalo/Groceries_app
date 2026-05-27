import { createContext } from 'react';

export type ConfirmVariant = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

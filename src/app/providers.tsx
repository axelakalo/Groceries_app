import type { ReactNode } from 'react';
import { AuthProvider } from '../features/auth/AuthProvider';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return <AuthProvider>{children}</AuthProvider>;
}

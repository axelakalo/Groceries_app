import { createContext } from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';

export interface AuthResult {
  error: AuthError | Error | null;
}

export interface SignUpCredentials {
  email: string;
  password: string;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (credentials: SignUpCredentials) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

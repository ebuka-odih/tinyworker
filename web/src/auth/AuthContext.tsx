import React from 'react';

import { API_BASE, buildAuthHeaders, readErrorMessage } from '../services/apiBase';
import { AuthUser } from '../types';

const ACCESS_TOKEN_KEY = 'tinyworker.access_token';

type AuthContextValue = {
  accessToken: string;
  authUser: AuthUser | null;
  authBusy: boolean;
  isAuthenticated: boolean;
  refreshAuthUser: () => Promise<AuthUser | null>;
  storeAccessToken: (token: string) => void;
  signOut: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function fetchAuthUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to restore session'));
  }

  const payload = (await response.json()) as { user?: AuthUser };
  if (!payload.user?.userId || !payload.user?.email) {
    throw new Error('Invalid auth response');
  }

  return payload.user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = React.useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
  });
  const [authUser, setAuthUser] = React.useState<AuthUser | null>(null);
  const [authBusy, setAuthBusy] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY));
  });

  const storeAccessToken = React.useCallback((token: string) => {
    const nextToken = String(token || '').trim();
    setAccessToken(nextToken);

    if (typeof window !== 'undefined') {
      if (nextToken) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, nextToken);
      } else {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    }

    if (nextToken) {
      setAuthBusy(true);
      return;
    }

    setAuthBusy(false);
    setAuthUser(null);
  }, []);

  const signOut = React.useCallback(() => {
    storeAccessToken('');
  }, [storeAccessToken]);

  const accessTokenRef = React.useRef(accessToken);
  accessTokenRef.current = accessToken;

  const refreshAuthUser = React.useCallback(async (): Promise<AuthUser | null> => {
    const token = String(accessTokenRef.current || '').trim();
    if (!token) {
      setAuthBusy(false);
      setAuthUser(null);
      return null;
    }

    setAuthBusy(true);
    try {
      const user = await fetchAuthUser(token);
      if (accessTokenRef.current !== token) return null;
      setAuthUser(user);
      return user;
    } catch {
      if (accessTokenRef.current === token) {
        storeAccessToken('');
      }
      return null;
    } finally {
      if (accessTokenRef.current === token || !accessTokenRef.current) {
        setAuthBusy(false);
      }
    }
  }, [storeAccessToken]);

  React.useEffect(() => {
    void refreshAuthUser();
  }, [refreshAuthUser]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      accessToken,
      authUser,
      authBusy,
      isAuthenticated: Boolean(accessToken && authUser),
      refreshAuthUser,
      storeAccessToken,
      signOut,
    }),
    [accessToken, authBusy, authUser, refreshAuthUser, signOut, storeAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

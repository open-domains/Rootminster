import React, { createContext, useContext, useEffect, useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await rootminster.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error.status !== 401) {
        setAuthError({ type: 'unknown', message: error.message || 'Unable to load the application' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkAppState();
  }, []);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await rootminster.auth.logout(shouldRedirect ? window.location.href : undefined);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: { public_settings: {} },
      logout,
      navigateToLogin: () => rootminster.auth.redirectToLogin(window.location.href),
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

/**
 * AceProvider — React context for Ace widget configuration.
 * Wraps the widget tree with shared config and license state.
 */
import React, { createContext, useContext } from 'react';
import { useLicense } from './hooks/useLicense.js';

const AceContext = createContext(null);

export function AceProvider({ children, serverUrl = '/api/ace', ...config }) {
  const licenseState = useLicense({ serverUrl });

  const value = {
    serverUrl,
    ...config,
    ...licenseState,
  };

  return (
    <AceContext.Provider value={value}>
      {children}
    </AceContext.Provider>
  );
}

export function useAceContext() {
  const ctx = useContext(AceContext);
  if (!ctx) throw new Error('useAceContext must be used within <AceProvider>');
  return ctx;
}

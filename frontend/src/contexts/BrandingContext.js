import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../lib/api';

const BrandingContext = createContext();

export const useBranding = () => useContext(BrandingContext);

const DEFAULT_NAME = 'SAU-INDEX';

export const BrandingProvider = ({ children }) => {
  const [clubName, setClubName] = useState(DEFAULT_NAME);
  const [hasLogo, setHasLogo] = useState(false);
  const logoUrl = api.branding.logoUrl;

  const loadBranding = useCallback(async () => {
    try {
      const res = await api.branding.get();
      setClubName(res.data.club_name || DEFAULT_NAME);
      setHasLogo(res.data.has_logo);
    } catch {
      setClubName(DEFAULT_NAME);
      setHasLogo(false);
    }
  }, []);

  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  useEffect(() => {
    document.title = clubName;
  }, [clubName]);

  const contextValue = useMemo(() => ({ clubName, hasLogo, logoUrl, loadBranding }), [clubName, hasLogo, logoUrl, loadBranding]);

  return (
    <BrandingContext.Provider value={contextValue}>
      {children}
    </BrandingContext.Provider>
  );
};

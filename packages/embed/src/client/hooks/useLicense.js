/**
 * useLicense — License state hook for the Ace embed widget.
 * Fetches license status from the server and tracks trial state.
 */
import { useState, useEffect, useCallback } from 'react';

export function useLicense({ serverUrl = '/api/ace', authToken = '' }) {
  const [license, setLicense] = useState({
    plan: 'trial',
    trialDaysLeft: 30,
    watermark: true,
    features: [],
    loaded: false,
  });

  const fetchLicense = useCallback(async () => {
    try {
      const baseUrl = serverUrl.replace(/\/$/, '');
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(`${baseUrl}/license`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLicense({ ...data, loaded: true });
      }
    } catch {
      // Fallback — assume trial
      setLicense(prev => ({ ...prev, loaded: true }));
    }
  }, [serverUrl, authToken]);

  useEffect(() => {
    fetchLicense();
  }, [fetchLicense]);

  const isPro = license.plan === 'pro';
  const isExpired = license.plan === 'expired';
  const showWatermark = license.watermark !== false;
  const showUpgrade = isExpired || (license.plan === 'trial' && license.trialDaysLeft <= 7);

  return {
    license,
    isPro,
    isExpired,
    showWatermark,
    showUpgrade,
    refreshLicense: fetchLicense,
  };
}

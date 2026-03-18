// src/lib/gdpr.ts

import { getSupabase } from './supabase';

const CONSENT_LOCALSTORAGE_KEY = 'gdpr_consent';

export interface GDPRConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

export const defaultConsent: GDPRConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const getConsent = (): GDPRConsent => {
  if (typeof window === 'undefined') {
    return defaultConsent;
  }
  const savedConsent = localStorage.getItem(CONSENT_LOCALSTORAGE_KEY);
  if (savedConsent) {
    try {
      const parsed = JSON.parse(savedConsent);
      // Basic validation
      if (typeof parsed.necessary === 'boolean' && typeof parsed.analytics === 'boolean' && typeof parsed.marketing === 'boolean') {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing GDPR consent from localStorage', e);
    }
  }
  return defaultConsent;
};

export const saveConsent = (consent: GDPRConsent): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(CONSENT_LOCALSTORAGE_KEY, JSON.stringify(consent));
  } catch (e) {
    console.error('Error saving GDPR consent to localStorage', e);
  }
};

export const hasGivenConsent = (category: keyof GDPRConsent): boolean => {
  const consent = getConsent();
  return consent[category];
};

// Art. 17 GDPR — Right to Erasure ("Right to be Forgotten")
export const eraseUserData = async (userId: string): Promise<void> => {
  const supabase = getSupabase();
  try {
    const { error } = await supabase.from('leaderboard').delete().eq('user_id', userId);
    if (error) {
      console.error('GDPR erasure failed for user', userId, error);
    }
  } catch (e) {
    console.error('GDPR erasure failed for user', userId, e);
  }
};

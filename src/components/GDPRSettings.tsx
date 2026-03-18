// src/components/GDPRSettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { getConsent, saveConsent, eraseUserData, GDPRConsent, defaultConsent } from '../lib/gdpr';
import { getCurrentUser } from '../lib/auth';

const GDPRSettings = () => {
  const [consent, setConsent] = useState<GDPRConsent>(defaultConsent);
  const [isOpen, setIsOpen] = useState(false);
  const [eraseStatus, setEraseStatus] = useState<'idle' | 'confirm' | 'pending' | 'done' | 'error'>('idle');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const currentConsent = getConsent();
    setConsent(currentConsent);
    const savedConsent = localStorage.getItem('gdpr_consent');
    if (!savedConsent) {
      setIsOpen(true);
    }
    getCurrentUser().then(user => {
      if (user) setUserId(user.id);
    });
  }, []);

  const handleConsentChange = (category: keyof Omit<GDPRConsent, 'necessary'>, value: boolean) => {
    setConsent(prev => ({ ...prev, [category]: value }));
  };

  const handleSave = () => {
    saveConsent(consent);
    setIsOpen(false);
  };

  const handleAcceptAll = () => {
    const allConsent: GDPRConsent = { necessary: true, analytics: true, marketing: true };
    setConsent(allConsent);
    saveConsent(allConsent);
    setIsOpen(false);
  };

  const handleEraseData = async () => {
    if (!userId) {
      setEraseStatus('error');
      return;
    }
    setEraseStatus('pending');
    try {
      await eraseUserData(userId);
      setEraseStatus('done');
    } catch {
      setEraseStatus('error');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-700 text-white p-2 rounded-lg shadow-lg text-sm"
      >
        Cookie Settings
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 shadow-lg z-50">
      <div className="container mx-auto">
        <h2 className="text-lg font-bold mb-2">Cookie Settings</h2>
        <p className="text-sm mb-4">We use cookies to improve your experience. You can choose which cookies to accept.</p>
        <div className="flex flex-col space-y-2">
          <label className="flex items-center">
            <input type="checkbox" checked={consent.necessary} disabled className="form-checkbox" />
            <span className="ml-2">Necessary</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={consent.analytics}
              onChange={e => handleConsentChange('analytics', e.target.checked)}
              className="form-checkbox"
            />
            <span className="ml-2">Analytics</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={consent.marketing}
              onChange={e => handleConsentChange('marketing', e.target.checked)}
              className="form-checkbox"
            />
            <span className="ml-2">Marketing</span>
          </label>
        </div>

        <div className="flex justify-end space-x-4 mt-4">
          <button onClick={handleSave} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Save Preferences
          </button>
          <button onClick={handleAcceptAll} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
            Accept All
          </button>
        </div>

        {/* Art. 17 GDPR — Right to Erasure */}
        <div className="mt-6 border-t border-gray-600 pt-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Right to Erasure (Art. 17 GDPR)</h3>
          <p className="text-xs text-gray-400 mb-3">
            You can request permanent deletion of all your personal data (leaderboard scores, contributions) from our systems.
          </p>
          {eraseStatus === 'idle' && (
            <button
              onClick={() => setEraseStatus('confirm')}
              disabled={!userId}
              className="bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white text-sm py-1.5 px-4 rounded"
            >
              Delete My Data
            </button>
          )}
          {eraseStatus === 'confirm' && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-red-400">This cannot be undone. Are you sure?</span>
              <button
                onClick={handleEraseData}
                className="bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded"
              >
                Yes, Delete Everything
              </button>
              <button
                onClick={() => setEraseStatus('idle')}
                className="bg-gray-600 hover:bg-gray-500 text-white text-sm py-1.5 px-3 rounded"
              >
                Cancel
              </button>
            </div>
          )}
          {eraseStatus === 'pending' && (
            <p className="text-xs text-yellow-400">Erasing your data...</p>
          )}
          {eraseStatus === 'done' && (
            <p className="text-xs text-green-400">Your data has been deleted.</p>
          )}
          {eraseStatus === 'error' && (
            <p className="text-xs text-red-400">An error occurred. Please try again or contact support.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GDPRSettings;

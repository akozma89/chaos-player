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
    if (!userId) { setEraseStatus('error'); return; }
    setEraseStatus('pending');
    try {
      await eraseUserData(userId);
      setEraseStatus('done');
    } catch {
      setEraseStatus('error');
    }
  };

  return (
    <>
      {/* Slim footer — naturally at the bottom of the page, visible only when scrolled there */}
      <footer className="w-full py-3 flex items-center justify-center gap-4">
        <span className="text-[10px] text-zinc-800 select-none">·</span>
        <button
          onClick={() => setIsOpen(true)}
          className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
        >
          Cookie Settings
        </button>
        <span className="text-[10px] text-zinc-800 select-none">·</span>
      </footer>

      {/* Consent panel — fixed overlay, shown on first visit or when triggered */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={() => {
              // Only dismiss via backdrop if consent was already saved
              if (localStorage.getItem('gdpr_consent')) setIsOpen(false);
            }}
          />

          {/* Panel */}
          <div className="relative w-full max-w-2xl mx-4 mb-4 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 pointer-events-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Cookie Settings</h2>
              {localStorage.getItem('gdpr_consent') && (
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              We use cookies to improve your experience. Choose which cookies to accept.
            </p>

            <div className="flex flex-col gap-2 mb-5">
              {[
                { key: 'necessary', label: 'Necessary', description: 'Required for the app to function', disabled: true, checked: true },
                { key: 'analytics', label: 'Analytics', description: 'Help us understand how you use the app', disabled: false, checked: consent.analytics },
                { key: 'marketing', label: 'Marketing', description: 'Personalised recommendations', disabled: false, checked: consent.marketing },
              ].map(({ key, label, description, disabled, checked }) => (
                <label
                  key={key}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    disabled
                      ? 'border-white/5 bg-white/3 opacity-50 cursor-not-allowed'
                      : 'border-white/10 bg-white/5 hover:bg-white/8 cursor-pointer'
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-[10px] text-zinc-500">{description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={disabled ? undefined : (e) => handleConsentChange(key as keyof Omit<GDPRConsent, 'necessary'>, e.target.checked)}
                    className="w-4 h-4 accent-neon-blue cursor-pointer disabled:cursor-not-allowed"
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-3 mb-5">
              <button
                onClick={handleSave}
                className="flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl bg-white/10 border border-white/10 text-zinc-300 hover:bg-white/15 transition"
              >
                Save Preferences
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl bg-neon-blue/20 border border-neon-blue/30 text-neon-blue hover:bg-neon-blue/30 transition"
              >
                Accept All
              </button>
            </div>

            {/* Art. 17 GDPR — Right to Erasure */}
            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Art. 17 GDPR — Right to Erasure</p>
              <p className="text-[10px] text-zinc-600 mb-3">
                Permanently delete all your personal data (scores, contributions) from our systems.
              </p>
              {eraseStatus === 'idle' && (
                <button
                  onClick={() => setEraseStatus('confirm')}
                  disabled={!userId}
                  className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-400 disabled:opacity-30 transition"
                >
                  Delete My Data
                </button>
              )}
              {eraseStatus === 'confirm' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] text-red-400">This cannot be undone.</span>
                  <button
                    onClick={handleEraseData}
                    className="px-3 py-1 text-[10px] font-bold uppercase rounded-lg bg-red-700 hover:bg-red-600 text-white transition"
                  >
                    Yes, Delete Everything
                  </button>
                  <button
                    onClick={() => setEraseStatus('idle')}
                    className="px-3 py-1 text-[10px] font-bold uppercase rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {eraseStatus === 'pending' && <p className="text-[10px] text-yellow-400">Erasing your data...</p>}
              {eraseStatus === 'done' && <p className="text-[10px] text-neon-green">Your data has been deleted.</p>}
              {eraseStatus === 'error' && <p className="text-[10px] text-red-400">An error occurred. Please try again.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GDPRSettings;

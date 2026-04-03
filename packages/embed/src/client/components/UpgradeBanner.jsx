/**
 * UpgradeBanner — Shows trial status / upgrade CTA when applicable.
 */
import React from 'react';

export function UpgradeBanner({ license, onUpgrade }) {
  if (!license) return null;

  const { plan, trialDaysLeft } = license;

  if (plan === 'pro') return null;

  const isExpired = plan === 'expired';
  const isLow = !isExpired && trialDaysLeft <= 7;

  if (!isExpired && !isLow) return null;

  const text = isExpired
    ? 'Free trial ended'
    : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in trial`;

  return (
    <div className="ace-upgrade-banner">
      <span>{text}</span>
      <button
        className="ace-upgrade-btn"
        onClick={onUpgrade || (() => window.open('https://openaceai.com/embed/pricing', '_blank'))}
      >
        Upgrade
      </button>
    </div>
  );
}

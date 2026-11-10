import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useLanguage } from '../i18n/LanguageContext';
import type { RootState } from '../store/store';

const STRINGS = {
  en: {
    title: 'Miles Balance',
    tier: 'Tier Status',
    loading: 'Loading balance…',
    error: 'Unable to load balance.',
    retry: 'Retry',
    miles: 'Miles',
    tiers: {
      bronze: 'Bronze',
      silver: 'Silver',
      gold: 'Gold',
      platinum: 'Platinum',
    } as Record<string, string>,
    noTier: 'Standard',
  },
  ar: {
    title: 'رصيد الأميال',
    tier: 'مستوى العضوية',
    loading: 'جارٍ تحميل الرصيد…',
    error: 'تعذّر تحميل الرصيد.',
    retry: 'إعادة المحاولة',
    miles: 'ميل',
    tiers: {
      bronze: 'برونزي',
      silver: 'فضي',
      gold: 'ذهبي',
      platinum: 'بلاتيني',
    } as Record<string, string>,
    noTier: 'قياسي',
  },
};

const TIER_BADGE_CLASSES: Record<string, string> = {
  bronze: 'bg-amber-700 text-white',
  silver: 'bg-gray-400 text-white',
  gold: 'bg-yellow-400 text-gray-900',
  platinum: 'bg-cyan-300 text-gray-900',
};

interface LoyaltyBalance {
  milesBalance: number;
  tierStatus: string;
}

export function MilesBalanceWidget() {
  const { lang } = useLanguage();
  const t = STRINGS[lang as 'en' | 'ar'] ?? STRINGS.en;

  const accessToken = useSelector((state: RootState) => (state as any).auth?.accessToken as string | null | undefined);

  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/v1/loyalty/balance', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const json = await res.json();
      const data = json?.data ?? json;
      setBalance({
        milesBalance: data.milesBalance ?? data.miles_balance ?? 0,
        tierStatus: (data.tierStatus ?? data.tier_status ?? '').toLowerCase(),
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const tierLabel =
    balance?.tierStatus
      ? (t.tiers[balance.tierStatus] ?? t.noTier)
      : t.noTier;

  const tierBadgeClass =
    balance?.tierStatus && TIER_BADGE_CLASSES[balance.tierStatus]
      ? TIER_BADGE_CLASSES[balance.tierStatus]
      : 'bg-gray-200 text-gray-700';

  return (
    <div className="rounded-2xl shadow-md bg-white p-6 flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-lg font-semibold text-gray-800">{t.title}</h2>

      {loading && (
        <p className="text-gray-500 text-sm animate-pulse">{t.loading}</p>
      )}

      {!loading && error && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-red-600 text-sm">{t.error}</p>
          <button
            onClick={fetchBalance}
            className="text-blue-600 text-sm underline hover:text-blue-800 focus:outline-none"
          >
            {t.retry}
          </button>
        </div>
      )}

      {!loading && !error && balance && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-4xl font-bold text-blue-700 tabular-nums">
              {balance.milesBalance.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}
            </span>
            <span className="text-sm text-gray-500">{t.miles}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 uppercase tracking-wide">{t.tier}</span>
            <span
              className={`inline-block self-start px-3 py-1 rounded-full text-sm font-medium ${tierBadgeClass}`}
            >
              {tierLabel}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const strings = {
  en: {
    checkInOpen: 'Check-In Is Open',
    checkInOpens: 'Check-In Opens',
    checkInClosed: 'Check-In Closed',
    checkInNow: 'Check In Now',
    opensAt: 'Check-In Opens',
    closedMessage: 'The check-in window for this flight has closed.',
    countdownLabel: 'Time until check-in opens:',
    days: 'days',
    hours: 'hours',
    minutes: 'minutes',
    seconds: 'seconds',
    day: 'day',
    hour: 'hour',
    minute: 'minute',
    second: 'second',
    windowOpen: 'Check-in is currently open.',
    loading: 'Calculating check-in window…',
  },
  ar: {
    checkInOpen: 'تسجيل الوصول مفتوح',
    checkInOpens: 'يفتح تسجيل الوصول',
    checkInClosed: 'تسجيل الوصول مغلق',
    checkInNow: 'سجّل الوصول الآن',
    opensAt: 'يفتح تسجيل الوصول',
    closedMessage: 'انتهت نافذة تسجيل الوصول لهذه الرحلة.',
    countdownLabel: 'الوقت المتبقي حتى فتح تسجيل الوصول:',
    days: 'أيام',
    hours: 'ساعات',
    minutes: 'دقائق',
    seconds: 'ثوانٍ',
    day: 'يوم',
    hour: 'ساعة',
    minute: 'دقيقة',
    second: 'ثانية',
    windowOpen: 'تسجيل الوصول متاح حالياً.',
    loading: 'جارٍ حساب نافذة تسجيل الوصول…',
  },
};

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeCountdown(targetMs: number): CountdownParts {
  const diff = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function formatDateTime(date: Date, lang: string): string {
  return date.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export interface CheckInCountdownProps {
  /** UTC ISO departure time of the flight */
  departureTime: string;
  /** Called when the user clicks "Check In Now" — only rendered when window is open */
  onCheckIn?: () => void;
  /** Whether a check-in action is currently loading */
  loading?: boolean;
}

/** Check-in window: opens 24 h before departure, closes 45 min before departure */
const OPEN_HOURS_BEFORE = 24;
const CLOSE_MINUTES_BEFORE = 45;

export const CheckInCountdown: React.FC<CheckInCountdownProps> = ({
  departureTime,
  onCheckIn,
  loading = false,
}) => {
  const { lang } = useLanguage();
  const t = strings[lang as 'en' | 'ar'] ?? strings.en;

  const departureMs = new Date(departureTime).getTime();
  const openMs = departureMs - OPEN_HOURS_BEFORE * 60 * 60 * 1000;
  const closeMs = departureMs - CLOSE_MINUTES_BEFORE * 60 * 1000;

  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (isNaN(departureMs)) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">{t.loading}</div>
    );
  }

  /* ── Window states ── */
  const beforeWindow = now < openMs;
  const afterWindow = now >= closeMs;
  const windowOpen = !beforeWindow && !afterWindow;

  /* ── Before window: countdown ── */
  if (beforeWindow) {
    const parts = computeCountdown(openMs);

    const plural = (value: number, singular: string, pluralStr: string) =>
      lang === 'ar'
        ? value === 1
          ? singular
          : pluralStr
        : value === 1
        ? singular
        : pluralStr;

    return (
      <div
        className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-950"
        role="status"
        aria-live="polite"
        aria-label={`${t.opensAt} ${formatDateTime(new Date(openMs), lang)}`}
      >
        <p className="mb-3 text-sm font-semibold text-blue-700 dark:text-blue-300">
          {t.opensAt}:{' '}
          <span className="font-normal">{formatDateTime(new Date(openMs), lang)}</span>
        </p>

        <p className="mb-2 text-xs text-blue-600 dark:text-blue-400">{t.countdownLabel}</p>

        <div className="flex gap-3" dir="ltr">
          {[
            { value: parts.days, label: plural(parts.days, t.day, t.days) },
            { value: parts.hours, label: plural(parts.hours, t.hour, t.hours) },
            { value: parts.minutes, label: plural(parts.minutes, t.minute, t.minutes) },
            { value: parts.seconds, label: plural(parts.seconds, t.second, t.seconds) },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-lg bg-blue-100 px-3 py-2 dark:bg-blue-900"
            >
              <span className="text-2xl font-bold tabular-nums text-blue-800 dark:text-blue-200">
                {String(value).padStart(2, '0')}
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400">{label}</span>
            </div>
          ))}
        </div>

        <button
          disabled
          className="mt-4 w-full cursor-not-allowed rounded-lg bg-blue-200 py-2 text-sm font-medium text-blue-400 dark:bg-blue-800 dark:text-blue-500"
          aria-disabled="true"
        >
          {t.checkInNow}
        </button>
      </div>
    );
  }

  /* ── After window: closed ── */
  if (afterWindow) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-950"
        role="status"
      >
        <p className="mb-1 text-sm font-semibold text-red-700 dark:text-red-300">
          {t.checkInClosed}
        </p>
        <p className="text-xs text-red-600 dark:text-red-400">{t.closedMessage}</p>

        <button
          disabled
          className="mt-4 w-full cursor-not-allowed rounded-lg bg-red-200 py-2 text-sm font-medium text-red-400 dark:bg-red-800 dark:text-red-500"
          aria-disabled="true"
        >
          {t.checkInNow}
        </button>
      </div>
    );
  }

  /* ── Window open ── */
  return (
    <div
      className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-800 dark:bg-green-950"
      role="status"
    >
      <p className="mb-3 text-sm font-semibold text-green-700 dark:text-green-300">
        {t.checkInOpen}
      </p>
      <p className="mb-4 text-xs text-green-600 dark:text-green-400">{t.windowOpen}</p>

      <button
        onClick={onCheckIn}
        disabled={loading || !onCheckIn}
        className={[
          'w-full rounded-lg py-2 text-sm font-semibold transition-colors',
          loading || !onCheckIn
            ? 'cursor-not-allowed bg-green-200 text-green-400 dark:bg-green-800 dark:text-green-500'
            : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 dark:bg-green-500 dark:hover:bg-green-600',
        ].join(' ')}
        aria-busy={loading}
      >
        {loading ? '…' : t.checkInNow}
      </button>
    </div>
  );
};

export default CheckInCountdown;
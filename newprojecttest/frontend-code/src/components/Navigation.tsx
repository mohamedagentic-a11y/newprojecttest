import React from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/index';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/index';

type Language = 'en' | 'ar';

const translations: Record<Language, {
  dashboard: string;
  flightSearch: string;
  rebooking: string;
  seatSelection: string;
  baggageClaims: string;
  toggleLanguage: string;
  tier: string;
}> = {
  en: {
    dashboard: 'Dashboard',
    flightSearch: 'Flight Search',
    rebooking: 'Rebooking',
    seatSelection: 'Seat Selection',
    baggageClaims: 'Baggage Claims',
    toggleLanguage: 'العربية',
    tier: 'Tier',
  },
  ar: {
    dashboard: 'لوحة التحكم',
    flightSearch: 'البحث عن رحلة',
    rebooking: 'إعادة الحجز',
    seatSelection: 'اختيار المقعد',
    baggageClaims: 'مطالبات الأمتعة',
    toggleLanguage: 'English',
    tier: 'المستوى',
  },
};

const navLinks = [
  { key: 'dashboard' as const, to: '/dashboard' },
  { key: 'flightSearch' as const, to: '/flight-search' },
  { key: 'rebooking' as const, to: '/rebooking' },
  { key: 'seatSelection' as const, to: '/seat-selection' },
  { key: 'baggageClaims' as const, to: '/baggage-claims' },
];

const Navigation: React.FC = () => {
  const { language, setLanguage, dir } = useI18n();
  const t = translations[language as Language] ?? translations['en'];

  const tierStatus = useSelector((state: RootState) =>
    (state as any).auth?.user?.tierStatus ?? (state as any).auth?.tierStatus ?? null
  );

  const handleToggleLanguage = () => {
    const next: Language = language === 'en' ? 'ar' : 'en';
    setLanguage(next);
  };

  return (
    <nav
      dir={dir}
      className="bg-blue-900 text-white w-full"
      role="navigation"
      aria-label={language === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 flex-wrap gap-2">
          {/* Nav Links */}
          <ul
            className="flex items-center gap-1 flex-wrap list-none m-0 p-0"
            style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}
          >
            {navLinks.map(({ key, to }) => (
              <li key={key}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    [
                      'px-3 py-2 rounded text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-blue-700 text-white'
                        : 'text-blue-200 hover:bg-blue-800 hover:text-white',
                    ].join(' ')
                  }
                >
                  {t[key]}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Right / Start controls depending on dir */}
          <div
            className="flex items-center gap-3"
            style={{ flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}
          >
            {/* Tier Badge */}
            {tierStatus && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-400 text-yellow-900 capitalize">
                {t.tier}: {tierStatus}
              </span>
            )}

            {/* Language Toggle */}
            <button
              type="button"
              onClick={handleToggleLanguage}
              className="px-3 py-1.5 rounded border border-blue-400 text-sm font-medium text-blue-200 hover:bg-blue-800 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label={
                language === 'en'
                  ? 'Switch to Arabic'
                  : 'التبديل إلى الإنجليزية'
              }
            >
              {t.toggleLanguage}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
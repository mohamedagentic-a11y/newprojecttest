import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLanguage } from '../i18n/LanguageContext';
import type { RootState, AppDispatch } from '../store/store';

const strings: Record<string, Record<string, string>> = {
  en: {
    dashboard: 'Dashboard',
    flightSearch: 'Flight Search',
    rebooking: 'Rebooking',
    seatSelection: 'Seat Selection',
    baggageClaims: 'Baggage Claims',
    logout: 'Logout',
    toggleLang: 'AR',
    appName: 'SkyWings',
  },
  ar: {
    dashboard: 'لوحة التحكم',
    flightSearch: 'البحث عن رحلات',
    rebooking: 'إعادة الحجز',
    seatSelection: 'اختيار المقعد',
    baggageClaims: 'مطالبات الأمتعة',
    logout: 'تسجيل الخروج',
    toggleLang: 'EN',
    appName: 'سكاي وينغز',
  },
};

export const NavBar: React.FC = () => {
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const t = strings[lang] ?? strings['en'];

  const isAuthenticated = useSelector((state: RootState) => state.auth?.isAuthenticated ?? false);

  const handleToggleLanguage = () => {
    setLang(lang === 'en' ? 'ar' : 'en');
  };

  const handleLogout = () => {
    dispatch({ type: 'auth/logout' });
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
      isActive
        ? 'bg-sky-700 text-white'
        : 'text-sky-100 hover:bg-sky-600 hover:text-white',
    ].join(' ');

  const links = [
    { to: '/dashboard', label: t.dashboard },
    { to: '/flight-search', label: t.flightSearch },
    { to: '/rebooking', label: t.rebooking },
    { to: '/seat-selection', label: t.seatSelection },
    { to: '/baggage-claims', label: t.baggageClaims },
  ];

  return (
    <nav className="bg-sky-800 shadow-md w-full" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex-shrink-0">
            <span className="text-white font-bold text-xl tracking-wide">
              {t.appName}
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Right-side controls */}
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              onClick={handleToggleLanguage}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors duration-150 border border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
              aria-label={lang === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
            >
              {t.toggleLang}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={!isAuthenticated}
              className={[
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-300',
                isAuthenticated
                  ? 'bg-red-600 text-white hover:bg-red-500 border border-red-400'
                  : 'bg-sky-700 text-sky-400 border border-sky-600 cursor-not-allowed opacity-50',
              ].join(' ')}
              aria-disabled={!isAuthenticated}
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Links */}
        <div className="md:hidden flex flex-wrap gap-1 pb-3">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
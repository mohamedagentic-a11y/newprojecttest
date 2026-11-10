import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '../store/store';
import { useLanguage } from '../i18n/LanguageContext';

const ROLES = {
  CORPORATE_TRAVELER: 'Corporate Traveler',
  LEISURE_PASSENGER: 'Leisure Passenger',
  TRAVEL_OPERATIONS_SPECIALIST: 'Travel Operations Specialist',
} as const;

type AllowedRole = typeof ROLES[keyof typeof ROLES];

interface AuthGuardProps {
  allowedRoles?: AllowedRole[];
}

const strings: Record<string, Record<string, string>> = {
  en: {
    unauthorized: 'You are not authorized to view this page.',
    redirecting: 'Redirecting to login...',
    accessDenied: 'Access Denied',
  },
  ar: {
    unauthorized: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    redirecting: 'جارٍ إعادة التوجيه إلى صفحة تسجيل الدخول...',
    accessDenied: 'الوصول مرفوض',
  },
};

const UnauthorizedPage: React.FC = () => {
  const { lang } = useLanguage();
  const t = strings[lang] ?? strings['en'];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <div className="text-red-500 mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t['accessDenied']}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">{t['unauthorized']}</p>
      </div>
    </div>
  );
};

export const AuthGuard: React.FC<AuthGuardProps> = ({ allowedRoles }) => {
  const location = useLocation();

  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const userRole = useSelector((state: RootState) => state.auth.user?.role);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole =
      userRole !== undefined && allowedRoles.includes(userRole as AllowedRole);
    if (!hasRole) {
      return <UnauthorizedPage />;
    }
  }

  return <Outlet />;
};

export { ROLES };
export type { AllowedRole };
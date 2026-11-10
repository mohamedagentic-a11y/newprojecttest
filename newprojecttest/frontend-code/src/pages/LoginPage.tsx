import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginThunk } from '../store/slices/authSlice';
import type { LoginCredentials } from '../store/slices/authSlice';
import type { RootState, AppDispatch } from '../store/index';
import { useI18n } from '../i18n/index';

const translations = {
  en: {
    pageTitle: 'Sign In',
    emailLabel: 'Email Address',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    submitButton: 'Sign In',
    submittingButton: 'Signing in…',
    errorHeading: 'Sign-in failed',
    welcomeHeading: 'Welcome to SkyWings',
    welcomeSubheading: 'Sign in to manage your flights and bookings',
  },
  ar: {
    pageTitle: 'تسجيل الدخول',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    submitButton: 'تسجيل الدخول',
    submittingButton: 'جارٍ تسجيل الدخول…',
    errorHeading: 'فشل تسجيل الدخول',
    welcomeHeading: 'مرحباً بك في سكاي وينغز',
    welcomeSubheading: 'سجّل دخولك لإدارة رحلاتك وحجوزاتك',
  },
} as const;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { language, dir } = useI18n();
  const t = translations[language];

  const { loading, error, accessToken } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (accessToken) {
      navigate('/', { replace: true });
    }
  }, [accessToken, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const credentials: LoginCredentials = { email, password };
    const result = await dispatch(loginThunk(credentials));
    if (loginThunk.fulfilled.match(result)) {
      navigate('/', { replace: true });
    }
  };

  const isDisabled = loading || !email.trim() || !password.trim();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4"
      dir={dir}
    >
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-700 mb-2">{t.welcomeHeading}</h1>
          <p className="text-gray-500 text-sm">{t.welcomeSubheading}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm"
          >
            <span className="font-semibold">{t.errorHeading}: </span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              {t.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              required
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-700"
            >
              {t.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              required
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition"
          >
            {loading ? t.submittingButton : t.submitButton}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
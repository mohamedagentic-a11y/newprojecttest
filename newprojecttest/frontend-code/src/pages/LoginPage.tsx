import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLanguage } from '../i18n/LanguageContext';
import { loginThunk, clearError } from '../store/authSlice';
import type { RootState, AppDispatch } from '../store/store';

const strings = {
  en: {
    pageTitle: 'Sign In',
    emailLabel: 'Email Address',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    submitButton: 'Sign In',
    submitting: 'Signing in…',
    errorPrefix: 'Error:',
    emailRequired: 'Email is required.',
    passwordRequired: 'Password is required.',
    welcomeHeading: 'Welcome to SkyWings',
    welcomeSubheading: 'Sign in to manage your bookings, loyalty miles, and more.',
  },
  ar: {
    pageTitle: 'تسجيل الدخول',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    submitButton: 'تسجيل الدخول',
    submitting: 'جارٍ تسجيل الدخول…',
    errorPrefix: 'خطأ:',
    emailRequired: 'البريد الإلكتروني مطلوب.',
    passwordRequired: 'كلمة المرور مطلوبة.',
    welcomeHeading: 'مرحبًا بك في سكاي وينغز',
    welcomeSubheading: 'سجّل دخولك لإدارة حجوزاتك وأميال الولاء والمزيد.',
  },
} as const;

type Lang = keyof typeof strings;

export function LoginPage(): JSX.Element {
  const { lang } = useLanguage();
  const t = strings[(lang as Lang) in strings ? (lang as Lang) : 'en'];

  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { accessToken, loading, error } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (accessToken) {
      navigate('/', { replace: true });
    }
  }, [accessToken, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = t.emailRequired;
    if (!password) errors.password = t.passwordRequired;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    dispatch(clearError());
    if (!validate()) return;
    dispatch(loginThunk({ email: email.trim(), password }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sky-700">{t.welcomeHeading}</h1>
          <p className="mt-2 text-gray-600 text-sm">{t.welcomeSubheading}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{t.pageTitle}</h2>

          {/* Server error */}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              <span className="font-medium">{t.errorPrefix}</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder={t.emailPlaceholder}
                disabled={loading}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 ${
                  fieldErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                }`}
              />
              {fieldErrors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.passwordLabel}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password)
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder={t.passwordPlaceholder}
                disabled={loading}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 ${
                  fieldErrors.password ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                }`}
              />
              {fieldErrors.password && (
                <p id="password-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t.submitting : t.submitButton}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
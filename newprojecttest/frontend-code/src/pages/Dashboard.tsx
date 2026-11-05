import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchLoyaltyBalance, redeemMilesThunk } from '../store/slices/loyaltySlice';
import { fetchBoardingPass, bookingSlice } from '../store/slices/bookingSlice';
import { type RootState, type AppDispatch } from '../store/index';
import { useI18n } from '../i18n/index';

const { setSelectedBooking, clearBoardingPassState } = bookingSlice.actions;

const translations = {
  en: {
    pageTitle: 'Dashboard – SkyWings',
    skyWingsRewards: 'SkyWings Rewards',
    milesBalance: 'Miles Balance',
    tier: 'Tier',
    redeemMiles: 'Redeem Miles',
    redeemAmount: 'Miles to redeem',
    redeemService: 'Service type',
    redeemServiceUpgrade: 'Upgrade',
    redeemServiceLounge: 'Lounge Access',
    redeemServiceBaggage: 'Extra Baggage',
    redeemConfirm: 'Confirm Redemption',
    redeemCancel: 'Cancel',
    redeemSuccess: 'Miles redeemed successfully!',
    redeemError: 'Redemption failed. Please try again.',
    newBalance: 'New Balance',
    quickActions: 'Quick Actions',
    searchFlights: 'Search Flights',
    baggageClaims: 'Baggage Claims',
    seatSelection: 'Seat Selection',
    upcomingTrips: 'Upcoming Trips',
    viewBoardingPass: 'View Boarding Pass',
    manageTrip: 'Manage Trip',
    flight: 'Flight',
    from: 'From',
    to: 'To',
    departure: 'Departure',
    status: 'Status',
    noUpcomingTrips: 'No upcoming trips found.',
    loadingBalance: 'Loading balance…',
    loadingTrips: 'Loading trips…',
    errorBalance: 'Could not load loyalty balance.',
    errorTrips: 'Could not load bookings.',
    boardingPassFetching: 'Fetching boarding pass…',
    boardingPassError: 'Could not fetch boarding pass.',
    boardingPassSuccess: 'Boarding pass ready.',
    toggleLanguage: 'عربي',
    noBookingSelected: 'Select a trip to view the boarding pass.',
    milesLabel: 'miles',
    redeemModalTitle: 'Redeem Miles',
    amountRequired: 'Please enter an amount greater than 0.',
  },
  ar: {
    pageTitle: 'لوحة التحكم – سكاي وينغز',
    skyWingsRewards: 'مكافآت سكاي وينغز',
    milesBalance: 'رصيد الأميال',
    tier: 'المستوى',
    redeemMiles: 'استبدال الأميال',
    redeemAmount: 'الأميال المراد استبدالها',
    redeemService: 'نوع الخدمة',
    redeemServiceUpgrade: 'ترقية',
    redeemServiceLounge: 'صالة الانتظار',
    redeemServiceBaggage: 'أمتعة إضافية',
    redeemConfirm: 'تأكيد الاستبدال',
    redeemCancel: 'إلغاء',
    redeemSuccess: 'تم استبدال الأميال بنجاح!',
    redeemError: 'فشل الاستبدال. يرجى المحاولة مرة أخرى.',
    newBalance: 'الرصيد الجديد',
    quickActions: 'الإجراءات السريعة',
    searchFlights: 'البحث عن رحلات',
    baggageClaims: 'مطالبات الأمتعة',
    seatSelection: 'اختيار المقعد',
    upcomingTrips: 'الرحلات القادمة',
    viewBoardingPass: 'عرض بطاقة الصعود',
    manageTrip: 'إدارة الرحلة',
    flight: 'الرحلة',
    from: 'من',
    to: 'إلى',
    departure: 'المغادرة',
    status: 'الحالة',
    noUpcomingTrips: 'لا توجد رحلات قادمة.',
    loadingBalance: 'جارٍ تحميل الرصيد…',
    loadingTrips: 'جارٍ تحميل الرحلات…',
    errorBalance: 'تعذّر تحميل رصيد المكافآت.',
    errorTrips: 'تعذّر تحميل الحجوزات.',
    boardingPassFetching: 'جارٍ جلب بطاقة الصعود…',
    boardingPassError: 'تعذّر جلب بطاقة الصعود.',
    boardingPassSuccess: 'بطاقة الصعود جاهزة.',
    toggleLanguage: 'English',
    noBookingSelected: 'اختر رحلة لعرض بطاقة الصعود.',
    milesLabel: 'ميل',
    redeemModalTitle: 'استبدال الأميال',
    amountRequired: 'يرجى إدخال مبلغ أكبر من صفر.',
  },
};

const serviceTypeOptions = [
  { value: 'upgrade', labelKey: 'redeemServiceUpgrade' as const },
  { value: 'lounge', labelKey: 'redeemServiceLounge' as const },
  { value: 'baggage', labelKey: 'redeemServiceBaggage' as const },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { language, setLanguage, dir } = useI18n();
  const t = translations[language];

  // Loyalty state
  const loyaltyState = useSelector((state: RootState) => (state as any).loyalty);
  const balance: number | null = loyaltyState?.balance ?? null;
  const tierStatus: string | null = loyaltyState?.tier ?? loyaltyState?.tierStatus ?? null;
  const loyaltyLoading: boolean = loyaltyState?.loading ?? false;
  const loyaltyError: string | null = loyaltyState?.error ?? null;
  const redeemLoading: boolean = loyaltyState?.redeemLoading ?? false;
  const redeemError: string | null = loyaltyState?.redeemError ?? null;
  const lastRedeemedTransactionId: string | null = loyaltyState?.lastRedeemedTransactionId ?? null;
  const newBalance: number | null = loyaltyState?.newBalance ?? null;

  // Booking state
  const bookingState = useSelector((state: RootState) => (state as any).booking);
  const bookings: any[] = bookingState?.bookings ?? [];
  const selectedBooking: any = bookingState?.selectedBooking ?? null;
  const boardingPassLoading: boolean = bookingState?.boardingPassLoading ?? false;
  const boardingPassError: string | null = bookingState?.boardingPassError ?? null;
  const boardingPassUrl: string | null = bookingState?.boardingPassUrl ?? null;

  // Local UI state
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState<number>(0);
  const [redeemService, setRedeemService] = useState<string>('upgrade');
  const [redeemLocalError, setRedeemLocalError] = useState<string | null>(null);
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [language, t.pageTitle]);

  useEffect(() => {
    dispatch(fetchLoyaltyBalance());
  }, [dispatch]);

  // Handle redeem modal open/close
  const openRedeemModal = () => {
    setRedeemAmount(0);
    setRedeemService('upgrade');
    setRedeemLocalError(null);
    setRedeemSuccessMsg(null);
    setRedeemModalOpen(true);
  };

  const closeRedeemModal = () => {
    setRedeemModalOpen(false);
    setRedeemLocalError(null);
    setRedeemSuccessMsg(null);
  };

  const handleRedeemSubmit = async () => {
    if (redeemAmount <= 0) {
      setRedeemLocalError(t.amountRequired);
      return;
    }
    setRedeemLocalError(null);
    setRedeemSuccessMsg(null);
    const result = await dispatch(redeemMilesThunk({ amount: redeemAmount, serviceType: redeemService }));
    if (redeemMilesThunk.fulfilled.match(result)) {
      setRedeemSuccessMsg(t.redeemSuccess);
      dispatch(fetchLoyaltyBalance());
    }
  };

  // View Boarding Pass
  const handleViewBoardingPass = (booking: any) => {
    dispatch(setSelectedBooking(booking));
    dispatch(clearBoardingPassState());
    dispatch(fetchBoardingPass(booking.id));
  };

  // Manage Trip → navigate to seat selection with booking context
  const handleManageTrip = (booking: any) => {
    dispatch(setSelectedBooking(booking));
    navigate('/seat-selection');
  };

  // Quick action navigation
  const handleSearchFlights = () => navigate('/flight-search');
  const handleBaggageClaims = () => navigate('/baggage-claims');
  const handleSeatSelection = () => navigate('/seat-selection');

  // Language toggle
  const handleLanguageToggle = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  const upcomingBookings = bookings.filter((b: any) => {
    if (!b.departureTime && !b.departure) return true;
    const depTime = b.departureTime || b.departure;
    return new Date(depTime) >= new Date();
  });

  return (
    <div dir={dir} className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top bar */}
      <header className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <h1 className="text-2xl font-bold tracking-tight">SkyWings</h1>
        <button
          onClick={handleLanguageToggle}
          className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          aria-label="Toggle language"
        >
          {t.toggleLanguage}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* SkyWings Rewards Section */}
        <section aria-labelledby="rewards-heading" className="bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <h2 id="rewards-heading" className="text-2xl font-bold mb-4">{t.skyWingsRewards}</h2>

          {loyaltyLoading && (
            <p className="text-blue-200 animate-pulse">{t.loadingBalance}</p>
          )}
          {!loyaltyLoading && loyaltyError && (
            <p className="text-red-300">{t.errorBalance}</p>
          )}
          {!loyaltyLoading && !loyaltyError && (
            <div className="flex flex-wrap gap-8 items-center">
              <div>
                <p className="text-sm text-blue-200 uppercase tracking-wide">{t.milesBalance}</p>
                <p className="text-4xl font-extrabold mt-1">
                  {balance !== null ? balance.toLocaleString() : '—'}
                  <span className="text-lg font-normal ms-2">{t.milesLabel}</span>
                </p>
              </div>
              {tierStatus && (
                <div>
                  <p className="text-sm text-blue-200 uppercase tracking-wide">{t.tier}</p>
                  <p className="text-2xl font-bold mt-1 capitalize">{tierStatus}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={openRedeemModal}
              disabled={loyaltyLoading || balance === null || balance <= 0}
              className="bg-white text-blue-800 font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t.redeemMiles}
            </button>
            {balance !== null && balance <= 0 && !loyaltyLoading && (
              <p className="text-blue-200 text-sm mt-2">{t.milesBalance}: 0</p>
            )}
          </div>
        </section>

        {/* Quick Actions Section */}
        <section aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="text-xl font-bold mb-4 text-gray-800">{t.quickActions}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={handleSearchFlights}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-blue-400 transition-all group"
            >
              <svg className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
              </svg>
              <span className="font-semibold text-gray-700 group-hover:text-blue-700">{t.searchFlights}</span>
            </button>

            <button
              onClick={handleBaggageClaims}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-blue-400 transition-all group"
            >
              <svg className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
              </svg>
              <span className="font-semibold text-gray-700 group-hover:text-blue-700">{t.baggageClaims}</span>
            </button>

            <button
              onClick={handleSeatSelection}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-blue-400 transition-all group"
            >
              <svg className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm7 4v6m-3-3h6" />
              </svg>
              <span className="font-semibold text-gray-700 group-hover:text-blue-700">{t.seatSelection}</span>
            </button>
          </div>
        </section>

        {/* Upcoming Trips Section */}
        <section aria-labelledby="upcoming-trips-heading">
          <h2 id="upcoming-trips-heading" className="text-xl font-bold mb-4 text-gray-800">{t.upcomingTrips}</h2>

          {boardingPassLoading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-700 text-sm mb-4 animate-pulse">
              {t.boardingPassFetching}
            </div>
          )}
          {boardingPassError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-4">
              {t.boardingPassError}
            </div>
          )}
          {boardingPassUrl && !boardingPassLoading && !boardingPassError && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm mb-4 flex items-center justify-between">
              <span>{t.boardingPassSuccess}</span>
              <a
                href={boardingPassUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium hover:text-green-900"
              >
                {t.viewBoardingPass}
              </a>
            </div>
          )}

          {upcomingBookings.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              {t.noUpcomingTrips}
            </div>
          ) : (
            <ul className="space-y-4">
              {upcomingBookings.map((booking: any) => {
                const flightNumber = booking.flightNumber || booking.flight?.flightNumber || booking.id;
                const origin = booking.origin || booking.flight?.origin || '—';
                const destination = booking.destination || booking.flight?.destination || '—';
                const departure = booking.departureTime || booking.departure || booking.flight?.departureTime;
                const bookingStatus = booking.status || '—';
                const isSelected = selectedBooking?.id === booking.id;

                return (
                  <li
                    key={booking.id}
                    className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span>
                            <span className="font-medium text-gray-700">{t.flight}: </span>
                            {flightNumber}
                          </span>
                          <span>
                            <span className="font-medium text-gray-700">{t.from}: </span>
                            {origin}
                          </span>
                          <span>
                            <span className="font-medium text-gray-700">{t.to}: </span>
                            {destination}
                          </span>
                          {departure && (
                            <span>
                              <span className="font-medium text-gray-700">{t.departure}: </span>
                              {new Date(departure).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          )}
                          <span>
                            <span className="font-medium text-gray-700">{t.status}: </span>
                            <span className="capitalize">{bookingStatus}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          onClick={() => handleViewBoardingPass(booking)}
                          disabled={boardingPassLoading}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {t.viewBoardingPass}
                        </button>
                        <button
                          onClick={() => handleManageTrip(booking)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {t.manageTrip}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {/* Redeem Miles Modal */}
      {redeemModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="redeem-modal-title"
        >
          <div
            dir={dir}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
          >
            <h3 id="redeem-modal-title" className="text-xl font-bold text-gray-800 mb-6">
              {t.redeemModalTitle}
            </h3>

            {redeemSuccessMsg ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
                  {redeemSuccessMsg}
                </div>
                {newBalance !== null && (
                  <p className="text-gray-600">
                    <span className="font-medium">{t.newBalance}: </span>
                    {newBalance.toLocaleString()} {t.milesLabel}
                  </p>
                )}
                <button
                  onClick={closeRedeemModal}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {t.redeemCancel}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label htmlFor="redeem-amount" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.redeemAmount}
                  </label>
                  <input
                    id="redeem-amount"
                    type="number"
                    min={1}
                    max={balance ?? undefined}
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="redeem-service" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.redeemService}
                  </label>
                  <select
                    id="redeem-service"
                    value={redeemService}
                    onChange={(e) => setRedeemService(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {serviceTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t[opt.labelKey]}
                      </option>
                    ))}
                  </select>
                </div>

                {redeemLocalError && (
                  <p className="text-red-600 text-sm">{redeemLocalError}</p>
                )}
                {redeemError && (
                  <p className="text-red-600 text-sm">{t.redeemError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleRedeemSubmit}
                    disabled={redeemLoading || redeemAmount <= 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    {redeemLoading ? '…' : t.redeemConfirm}
                  </button>
                  <button
                    onClick={closeRedeemModal}
                    disabled={redeemLoading}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    {t.redeemCancel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
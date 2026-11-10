import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLanguage } from '../i18n/LanguageContext';
import { type RootState, type AppDispatch } from '../store/store';
import { fetchBookings, fetchBoardingPass, checkInThunk, clearCheckInStatus, clearBoardingPassStatus } from '../store/bookingSlice';
import { fetchLoyaltyBalance, redeemMilesThunk, clearRedemptionStatus } from '../store/loyaltySlice';
import { MilesBalanceWidget } from '../components/MilesBalanceWidget';
import FlightCard, { type FlightData } from '../components/FlightCard';
import CheckInCountdown from '../components/CheckInCountdown';

const strings = {
  en: {
    pageTitle: 'SkyWings Rewards',
    quickActions: 'Quick Actions',
    upcomingTrips: 'Upcoming Trips',
    redeemMiles: 'Redeem Miles',
    viewBoardingPass: 'View Boarding Pass',
    manageTrip: 'Manage Trip',
    bookFlight: 'Book a Flight',
    baggageClaims: 'Baggage Claims',
    myProfile: 'My Profile',
    loyaltyProgram: 'Loyalty Program',
    noUpcomingTrips: 'No upcoming trips found.',
    loadingTrips: 'Loading your trips…',
    errorTrips: 'Failed to load trips.',
    notifications: 'Notifications',
    checkInAvailable: 'Check-in is now available for your upcoming flight.',
    boardingPassReady: 'Your boarding pass is ready.',
    redeemSuccess: 'Miles redeemed successfully!',
    redeemError: 'Failed to redeem miles.',
    checkInSuccess: 'Check-in successful!',
    checkInError: 'Check-in failed.',
    boardingPassError: 'Failed to fetch boarding pass.',
    selectBookingFirst: 'Please select a booking first.',
    redeemLabel: 'Miles to redeem:',
    redeemServiceLabel: 'Service type:',
    serviceUpgrade: 'Upgrade',
    serviceDiscount: 'Discount',
    redeemSubmit: 'Redeem',
    cancel: 'Cancel',
    checkIn: 'Check In',
    tier: 'Tier',
    balance: 'Miles Balance',
    welcome: 'Welcome back!',
    tripStatus: 'Status',
  },
  ar: {
    pageTitle: 'مكافآت سكاي وينغز',
    quickActions: 'الإجراءات السريعة',
    upcomingTrips: 'الرحلات القادمة',
    redeemMiles: 'استبدال الأميال',
    viewBoardingPass: 'عرض بطاقة الصعود',
    manageTrip: 'إدارة الرحلة',
    bookFlight: 'حجز رحلة',
    baggageClaims: 'مطالبات الأمتعة',
    myProfile: 'ملفي الشخصي',
    loyaltyProgram: 'برنامج الولاء',
    noUpcomingTrips: 'لا توجد رحلات قادمة.',
    loadingTrips: 'جارٍ تحميل رحلاتك…',
    errorTrips: 'فشل تحميل الرحلات.',
    notifications: 'الإشعارات',
    checkInAvailable: 'تسجيل الوصول متاح الآن لرحلتك القادمة.',
    boardingPassReady: 'بطاقة الصعود الخاصة بك جاهزة.',
    redeemSuccess: 'تم استبدال الأميال بنجاح!',
    redeemError: 'فشل استبدال الأميال.',
    checkInSuccess: 'تم تسجيل الوصول بنجاح!',
    checkInError: 'فشل تسجيل الوصول.',
    boardingPassError: 'فشل جلب بطاقة الصعود.',
    selectBookingFirst: 'الرجاء اختيار حجز أولاً.',
    redeemLabel: 'الأميال المراد استبدالها:',
    redeemServiceLabel: 'نوع الخدمة:',
    serviceUpgrade: 'ترقية',
    serviceDiscount: 'خصم',
    redeemSubmit: 'استبدال',
    cancel: 'إلغاء',
    checkIn: 'تسجيل الوصول',
    tier: 'المستوى',
    balance: 'رصيد الأميال',
    welcome: 'مرحباً بعودتك!',
    tripStatus: 'الحالة',
  },
};

type ServiceType = 'upgrade' | 'discount';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { lang } = useLanguage();
  const t = strings[lang as 'en' | 'ar'] ?? strings.en;

  const bookingState = useSelector((state: RootState) => state.booking);
  const loyaltyState = useSelector((state: RootState) => state.loyalty);

  const [showRedeemModal, setShowRedeemModal] = React.useState(false);
  const [redeemAmount, setRedeemAmount] = React.useState<number>(1000);
  const [redeemService, setRedeemService] = React.useState<ServiceType>('upgrade');
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [boardingPassBookingId, setBoardingPassBookingId] = React.useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchBookings());
    dispatch(fetchLoyaltyBalance());
  }, [dispatch]);

  // Handle redemption result
  useEffect(() => {
    if (loyaltyState.redemptionStatus === 'succeeded') {
      addNotification(t.redeemSuccess, 'success');
      setShowRedeemModal(false);
      dispatch(clearRedemptionStatus());
      dispatch(fetchLoyaltyBalance());
    } else if (loyaltyState.redemptionStatus === 'failed') {
      addNotification(loyaltyState.redemptionError ?? t.redeemError, 'error');
      dispatch(clearRedemptionStatus());
    }
  }, [loyaltyState.redemptionStatus]);

  // Handle check-in result
  useEffect(() => {
    if (bookingState.result && 'eligible' in bookingState.result) {
      const result = bookingState.result as { eligible: boolean; boardingPassUrl: string };
      if (result.eligible) {
        addNotification(t.checkInSuccess, 'success');
      } else {
        addNotification(t.checkInError, 'warning');
      }
      dispatch(clearCheckInStatus());
    }
  }, [bookingState.result]);

  // Handle boarding pass result
  useEffect(() => {
    if (bookingState.result && 'url' in bookingState.result) {
      const result = bookingState.result as { url: string; bookingId: string };
      if (result.url) {
        window.open(result.url, '_blank');
        addNotification(t.boardingPassReady, 'info');
      }
      dispatch(clearBoardingPassStatus());
    }
  }, [bookingState.result]);

  const addNotification = (message: string, type: Notification['type']) => {
    const id = `notif_${Date.now()}`;
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleRedeemMiles = () => {
    setShowRedeemModal(true);
  };

  const handleRedeemSubmit = () => {
    dispatch(redeemMilesThunk({ amount: redeemAmount, serviceType: redeemService }));
  };

  const handleViewBoardingPass = useCallback(() => {
    const activeId = bookingState.activeBooking?.id ?? bookingState.bookings[0]?.id;
    if (!activeId) {
      addNotification(t.selectBookingFirst, 'warning');
      return;
    }
    dispatch(fetchBoardingPass({ bookingId: activeId }));
    setBoardingPassBookingId(activeId);
  }, [bookingState.activeBooking, bookingState.bookings, dispatch, t.selectBookingFirst]);

  const handleManageTrip = () => {
    navigate('/bookings');
  };

  const handleCheckIn = useCallback(
    (bookingId: string) => {
      dispatch(checkInThunk({ bookingId }));
    },
    [dispatch]
  );

  // Map bookings to FlightData for FlightCard
  const upcomingFlights: Array<{ booking: (typeof bookingState.bookings)[0]; flight: FlightData }> =
    bookingState.bookings
      .filter((b) => b.status !== 'cancelled')
      .map((booking) => ({
        booking,
        flight: {
          id: booking.flightId,
          flightNumber: booking.flightId,
          origin: '—',
          destination: '—',
          departureTime: booking.createdAt,
          arrivalTime: booking.updatedAt,
          status: 'on-time' as const,
          cabinClass: booking.seatPreference,
        },
      }));

  const notificationColor: Record<Notification['type'], string> = {
    info: 'bg-blue-100 border-blue-400 text-blue-800',
    success: 'bg-green-100 border-green-400 text-green-800',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-800',
    error: 'bg-red-100 border-red-400 text-red-800',
  };

  const isCheckInLoading = bookingState.status === 'loading';
  const isBoardingPassLoading = bookingState.status === 'loading';
  const hasBookings = bookingState.bookings.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 end-4 z-50 flex flex-col gap-2 w-80">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between border rounded-lg px-4 py-3 shadow ${notificationColor[n.type]}`}
              role="alert"
            >
              <span className="text-sm">{n.message}</span>
              <button
                onClick={() => removeNotification(n.id)}
                className="ms-2 text-lg leading-none font-bold opacity-70 hover:opacity-100"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-sky-700">{t.pageTitle}</h1>
          <p className="text-gray-500 mt-1">{t.welcome}</p>
        </header>

        {/* Miles Balance Widget */}
        <section className="mb-8">
          <MilesBalanceWidget />
        </section>

        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">{t.quickActions}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Redeem Miles */}
            <button
              onClick={handleRedeemMiles}
              disabled={!loyaltyState.milesBalance || loyaltyState.milesBalance <= 0}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-sky-200 rounded-xl p-5 shadow-sm hover:bg-sky-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !loyaltyState.milesBalance || loyaltyState.milesBalance <= 0
                  ? t.redeemError
                  : t.redeemMiles
              }
            >
              <span className="text-3xl">🏆</span>
              <span className="text-sm font-medium text-sky-700">{t.redeemMiles}</span>
            </button>

            {/* View Boarding Pass */}
            <button
              onClick={handleViewBoardingPass}
              disabled={!hasBookings || isBoardingPassLoading}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-sky-200 rounded-xl p-5 shadow-sm hover:bg-sky-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={!hasBookings ? t.selectBookingFirst : t.viewBoardingPass}
            >
              <span className="text-3xl">🎫</span>
              <span className="text-sm font-medium text-sky-700">{t.viewBoardingPass}</span>
              {!hasBookings && (
                <span className="text-xs text-gray-400">{t.selectBookingFirst}</span>
              )}
            </button>

            {/* Manage Trip */}
            <button
              onClick={handleManageTrip}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-sky-200 rounded-xl p-5 shadow-sm hover:bg-sky-50 transition"
            >
              <span className="text-3xl">✈️</span>
              <span className="text-sm font-medium text-sky-700">{t.manageTrip}</span>
            </button>

            {/* Book a Flight */}
            <button
              onClick={() => navigate('/flights/search')}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-sky-200 rounded-xl p-5 shadow-sm hover:bg-sky-50 transition"
            >
              <span className="text-3xl">🔍</span>
              <span className="text-sm font-medium text-sky-700">{t.bookFlight}</span>
            </button>

            {/* Baggage Claims */}
            <button
              onClick={() => navigate('/baggage')}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-sky-200 rounded-xl p-5 shadow-sm hover:bg-sky-50 transition"
            >
              <span className="text-3xl">🧳</span>
              <span className="text-sm font-medium text-sky-700">{t.baggageClaims}</span>
            </button>

            {/* Loyalty Program */}
            <button
              onClick={() => navigate('/loyalty')}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-sky-200 rounded-xl p-5 shadow-sm hover:bg-sky-50 transition"
            >
              <span className="text-3xl">⭐</span>
              <span className="text-sm font-medium text-sky-700">{t.loyaltyProgram}</span>
            </button>

            {/* My Profile */}
            <button
              onClick={() => navigate('/profile')}
              className="flex flex-col items-center justify-center gap-2 bg-white border border-sky-200 rounded-xl p-5 shadow-sm hover:bg-sky-50 transition"
            >
              <span className="text-3xl">👤</span>
              <span className="text-sm font-medium text-sky-700">{t.myProfile}</span>
            </button>
          </div>
        </section>

        {/* Upcoming Trips */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">{t.upcomingTrips}</h2>

          {bookingState.listStatus === 'loading' && (
            <p className="text-gray-500">{t.loadingTrips}</p>
          )}

          {bookingState.listStatus === 'failed' && (
            <p className="text-red-500">{bookingState.listError ?? t.errorTrips}</p>
          )}

          {bookingState.listStatus === 'succeeded' && upcomingFlights.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <span className="text-5xl">✈️</span>
              <p className="mt-4 text-gray-500">{t.noUpcomingTrips}</p>
              <button
                onClick={() => navigate('/flights/search')}
                className="mt-4 inline-block px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition text-sm"
              >
                {t.bookFlight}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {upcomingFlights.map(({ booking, flight }) => (
              <div
                key={booking.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <FlightCard flight={flight} />
                <div className="px-4 pb-4">
                  <CheckInCountdown
                    departureTime={booking.createdAt}
                    onCheckIn={() => handleCheckIn(booking.id)}
                    loading={isCheckInLoading}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Redeem Miles Modal */}
      {showRedeemModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="redeem-title"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 id="redeem-title" className="text-lg font-bold text-sky-700 mb-4">
              {t.redeemMiles}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.redeemLabel}
              </label>
              <input
                type="number"
                min={100}
                max={loyaltyState.milesBalance ?? 0}
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              {loyaltyState.milesBalance !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  {t.balance}: {loyaltyState.milesBalance.toLocaleString()}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.redeemServiceLabel}
              </label>
              <select
                value={redeemService}
                onChange={(e) => setRedeemService(e.target.value as ServiceType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="upgrade">{t.serviceUpgrade}</option>
                <option value="discount">{t.serviceDiscount}</option>
              </select>
            </div>

            {loyaltyState.redemptionStatus === 'failed' && (
              <p className="text-red-500 text-sm mb-4">
                {loyaltyState.redemptionError ?? t.redeemError}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRedeemModal(false);
                  dispatch(clearRedemptionStatus());
                }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleRedeemSubmit}
                disabled={
                  loyaltyState.redemptionStatus === 'pending' ||
                  redeemAmount <= 0 ||
                  redeemAmount > (loyaltyState.milesBalance ?? 0)
                }
                className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loyaltyState.redemptionStatus === 'pending'
                  ? '…'
                  : t.redeemSubmit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
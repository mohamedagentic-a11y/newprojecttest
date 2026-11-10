import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import type { AppDispatch, RootState } from '../store/store';
import { rebookThunk, clearRebookStatus, setActiveBooking } from '../store/bookingSlice';
import { searchFlightsThunk } from '../store/flightSlice';
import type { FlightEntity } from '../store/flightSlice';

const strings = {
  en: {
    pageTitle: 'Pre-Departure Rebooking',
    stepBookingRef: 'Booking Reference',
    stepNewDate: 'Select New Flight',
    stepFareDiff: 'Fare & Payment',
    stepConfirm: 'Confirm',
    bookingRefLabel: 'Booking Reference',
    bookingRefPlaceholder: 'Enter your booking reference',
    flightIdLabel: 'Current Flight ID',
    flightIdPlaceholder: 'Enter your current flight ID',
    nextBtn: 'Next',
    backBtn: 'Back',
    searchBtn: 'Search Flights',
    searchingBtn: 'Searching…',
    originLabel: 'Origin',
    originPlaceholder: 'e.g. RUH',
    destinationLabel: 'Destination',
    destinationPlaceholder: 'e.g. DXB',
    departureDateLabel: 'New Departure Date',
    cabinClassLabel: 'Cabin Class',
    cabinClassEconomy: 'Economy',
    cabinClassBusiness: 'Business',
    cabinClassFirst: 'First',
    noFlightsFound: 'No flights found for the selected criteria.',
    selectFlight: 'Select',
    selectedFlight: 'Selected',
    fareLabel: 'Fare Difference',
    fareCurrency: 'USD',
    paymentMethodLabel: 'Payment Method',
    payCard: 'Pay by Card',
    payMiles: 'Redeem Miles (12,450 mi)',
    milesBalance: 'Miles Balance',
    cancelBtn: 'Cancel',
    confirmBtn: 'Confirm & Pay $75.00',
    confirmingBtn: 'Processing…',
    successTitle: 'Rebooking Confirmed',
    successMsg: 'Your flight has been successfully rebooked.',
    backToHome: 'Back to Home',
    errorTitle: 'Rebooking Failed',
    policyError: 'Rebooking window closed. You can only rebook up to 2 hours before departure.',
    countdownLabel: 'Time remaining in rebooking window',
    windowClosed: 'Rebooking window is closed (less than 2 hours before departure).',
    requiredBookingRef: 'Booking reference is required.',
    requiredFlightId: 'Flight ID is required.',
    requiredNewFlight: 'Please select a new flight.',
    requiredDate: 'Departure date is required.',
    requiredOrigin: 'Origin is required.',
    requiredDestination: 'Destination is required.',
    stepOf: 'Step {step} of {total}',
    flightNumber: 'Flight',
    airline: 'Airline',
    departure: 'Departure',
    arrival: 'Arrival',
    duration: 'Duration',
    stops: 'Stops',
    direct: 'Direct',
    price: 'Price',
  },
  ar: {
    pageTitle: 'إعادة الحجز قبل المغادرة',
    stepBookingRef: 'مرجع الحجز',
    stepNewDate: 'اختر رحلة جديدة',
    stepFareDiff: 'السعر والدفع',
    stepConfirm: 'تأكيد',
    bookingRefLabel: 'مرجع الحجز',
    bookingRefPlaceholder: 'أدخل مرجع الحجز',
    flightIdLabel: 'معرف الرحلة الحالية',
    flightIdPlaceholder: 'أدخل معرف رحلتك الحالية',
    nextBtn: 'التالي',
    backBtn: 'السابق',
    searchBtn: 'البحث عن رحلات',
    searchingBtn: 'جارٍ البحث…',
    originLabel: 'المطار الأصلي',
    originPlaceholder: 'مثال: RUH',
    destinationLabel: 'الوجهة',
    destinationPlaceholder: 'مثال: DXB',
    departureDateLabel: 'تاريخ المغادرة الجديد',
    cabinClassLabel: 'درجة المقصورة',
    cabinClassEconomy: 'الاقتصادية',
    cabinClassBusiness: 'رجال الأعمال',
    cabinClassFirst: 'الأولى',
    noFlightsFound: 'لا توجد رحلات متاحة للمعايير المحددة.',
    selectFlight: 'اختر',
    selectedFlight: 'مختار',
    fareLabel: 'فرق السعر',
    fareCurrency: 'دولار',
    paymentMethodLabel: 'طريقة الدفع',
    payCard: 'الدفع ببطاقة',
    payMiles: 'استرداد الأميال (12,450 ميل)',
    milesBalance: 'رصيد الأميال',
    cancelBtn: 'إلغاء',
    confirmBtn: 'تأكيد والدفع 75.00 دولار',
    confirmingBtn: 'جارٍ المعالجة…',
    successTitle: 'تم تأكيد إعادة الحجز',
    successMsg: 'تمت إعادة حجز رحلتك بنجاح.',
    backToHome: 'العودة إلى الرئيسية',
    errorTitle: 'فشل إعادة الحجز',
    policyError: 'انتهت نافذة إعادة الحجز. يمكنك إعادة الحجز حتى ساعتين قبل الإقلاع فقط.',
    countdownLabel: 'الوقت المتبقي في نافذة إعادة الحجز',
    windowClosed: 'نافذة إعادة الحجز مغلقة (أقل من ساعتين قبل الإقلاع).',
    requiredBookingRef: 'مرجع الحجز مطلوب.',
    requiredFlightId: 'معرف الرحلة مطلوب.',
    requiredNewFlight: 'يرجى اختيار رحلة جديدة.',
    requiredDate: 'تاريخ المغادرة مطلوب.',
    requiredOrigin: 'المطار الأصلي مطلوب.',
    requiredDestination: 'الوجهة مطلوبة.',
    stepOf: 'الخطوة {step} من {total}',
    flightNumber: 'رقم الرحلة',
    airline: 'الخط الجوي',
    departure: 'الإقلاع',
    arrival: 'الوصول',
    duration: 'المدة',
    stops: 'التوقفات',
    direct: 'مباشرة',
    price: 'السعر',
  },
} as const;

type Lang = 'en' | 'ar';

const TOTAL_STEPS = 3;
const FARE_DIFF_USD = 75.0;
const MILES_COST = 12450;

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function Rebooking() {
  const { lang } = useLanguage();
  const t = strings[lang as Lang] ?? strings.en;
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { status: rebookStatus, error: rebookError } = useSelector(
    (state: RootState) => state.booking
  );
  const { searchResults, searchLoading } = useSelector(
    (state: RootState) => state.flight
  );

  // Wizard step: 0 = booking ref, 1 = select new flight, 2 = fare & payment
  const [step, setStep] = useState(0);

  // Step 0 fields
  const [bookingRef, setBookingRef] = useState('');
  const [currentFlightId, setCurrentFlightId] = useState('');

  // Step 1 fields
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [cabinClass, setCabinClass] = useState('Economy');
  const [selectedNewFlight, setSelectedNewFlight] = useState<FlightEntity | null>(null);

  // Step 2 fields
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'miles'>('card');

  // T-2h cutoff simulation: departure time for countdown
  // We derive it from selectedNewFlight if available; otherwise simulate
  const [departureTimestamp, setDepartureTimestamp] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [windowClosed, setWindowClosed] = useState(false);

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Success state
  const [succeeded, setSucceeded] = useState(false);

  // Clear rebook status on mount
  useEffect(() => {
    dispatch(clearRebookStatus());
  }, [dispatch]);

  // Tick clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derive window closed from selected flight's departure
  useEffect(() => {
    if (selectedNewFlight) {
      const ts = new Date(
        `${selectedNewFlight.departureDate}T${selectedNewFlight.departureTime}`
      ).getTime();
      setDepartureTimestamp(ts);
    }
  }, [selectedNewFlight]);

  useEffect(() => {
    if (departureTimestamp !== null) {
      const msUntilDeparture = departureTimestamp - now;
      setWindowClosed(msUntilDeparture < 2 * 60 * 60 * 1000);
    }
  }, [departureTimestamp, now]);

  // Watch for rebook success
  useEffect(() => {
    if (rebookStatus === 'succeeded') {
      setSucceeded(true);
    }
  }, [rebookStatus]);

  const msRemaining =
    departureTimestamp !== null ? departureTimestamp - now : null;

  // Validation
  const validateStep0 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!bookingRef.trim()) errors.bookingRef = t.requiredBookingRef;
    if (!currentFlightId.trim()) errors.currentFlightId = t.requiredFlightId;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!origin.trim()) errors.origin = t.requiredOrigin;
    if (!destination.trim()) errors.destination = t.requiredDestination;
    if (!departureDate) errors.departureDate = t.requiredDate;
    if (!selectedNewFlight) errors.newFlight = t.requiredNewFlight;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && validateStep0()) {
      setStep(1);
      setFieldErrors({});
    } else if (step === 1 && validateStep1()) {
      setStep(2);
      setFieldErrors({});
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((s) => s - 1);
      setFieldErrors({});
    }
  };

  const handleSearch = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!origin.trim()) errors.origin = t.requiredOrigin;
    if (!destination.trim()) errors.destination = t.requiredDestination;
    if (!departureDate) errors.departureDate = t.requiredDate;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    dispatch(
      searchFlightsThunk({
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        departureDate,
        cabinClass,
      })
    );
    setSelectedNewFlight(null);
  }, [dispatch, origin, destination, departureDate, cabinClass, t]);

  const handleCancel = () => {
    dispatch(clearRebookStatus());
    navigate('/');
  };

  const handleConfirm = () => {
    if (windowClosed) return;
    if (!selectedNewFlight) return;
    dispatch(
      rebookThunk({
        bookingId: bookingRef.trim(),
        newFlightId: selectedNewFlight.id,
        paymentMethod: paymentMethod === 'miles' ? 'miles' : 'card',
      })
    );
  };

  const handleBackToHome = () => {
    dispatch(clearRebookStatus());
    navigate('/');
  };

  const stepLabel = t.stepOf
    .replace('{step}', String(step + 1))
    .replace('{total}', String(TOTAL_STEPS));

  if (succeeded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.successTitle}</h2>
          <p className="text-gray-600 mb-6">{t.successMsg}</p>
          <button
            onClick={handleBackToHome}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            {t.backToHome}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t.pageTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">{stepLabel}</p>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 mb-8">
          {[t.stepBookingRef, t.stepNewDate, t.stepFareDiff].map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${i < step ? 'bg-blue-600 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}
              >
                {i < step ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-xs text-center ${i === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Countdown / window closed banner */}
        {departureTimestamp !== null && (
          <div
            className={`mb-6 rounded-xl p-4 flex items-center gap-3 ${
              windowClosed ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
            }`}
          >
            <svg
              className={`w-5 h-5 flex-shrink-0 ${windowClosed ? 'text-red-500' : 'text-amber-500'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className={`text-sm font-medium ${windowClosed ? 'text-red-700' : 'text-amber-700'}`}>
                {windowClosed ? t.windowClosed : t.countdownLabel}
              </p>
              {!windowClosed && msRemaining !== null && (
                <p className="text-lg font-mono font-bold text-amber-800 mt-1">
                  {formatCountdown(msRemaining)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error from rebook thunk */}
        {rebookStatus === 'failed' && rebookError && (
          <div className="mb-6 rounded-xl p-4 bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-700">{t.errorTitle}</p>
            <p className="text-sm text-red-600 mt-1">
              {rebookError.includes('403') || rebookError.toLowerCase().includes('window')
                ? t.policyError
                : rebookError}
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Step 0: Booking Reference */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.bookingRefLabel}
                </label>
                <input
                  type="text"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  placeholder={t.bookingRefPlaceholder}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${fieldErrors.bookingRef ? 'border-red-400' : 'border-gray-200'}`}
                />
                {fieldErrors.bookingRef && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.bookingRef}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.flightIdLabel}
                </label>
                <input
                  type="text"
                  value={currentFlightId}
                  onChange={(e) => setCurrentFlightId(e.target.value)}
                  placeholder={t.flightIdPlaceholder}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${fieldErrors.currentFlightId ? 'border-red-400' : 'border-gray-200'}`}
                />
                {fieldErrors.currentFlightId && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.currentFlightId}</p>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleNext}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  {t.nextBtn}
                </button>
              </div>
            </div>
          )}

          {/* Step 1: New Flight Selection */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.originLabel}
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder={t.originPlaceholder}
                    maxLength={3}
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${fieldErrors.origin ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {fieldErrors.origin && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.origin}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.destinationLabel}
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={t.destinationPlaceholder}
                    maxLength={3}
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${fieldErrors.destination ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {fieldErrors.destination && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.destination}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.departureDateLabel}
                  </label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${fieldErrors.departureDate ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {fieldErrors.departureDate && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.departureDate}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.cabinClassLabel}
                  </label>
                  <select
                    value={cabinClass}
                    onChange={(e) => setCabinClass(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Economy">{t.cabinClassEconomy}</option>
                    <option value="Business">{t.cabinClassBusiness}</option>
                    <option value="First">{t.cabinClassFirst}</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={searchLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {searchLoading ? t.searchingBtn : t.searchBtn}
              </button>

              {/* Flight results */}
              {searchResults.length === 0 && !searchLoading && (
                <p className="text-sm text-gray-400 text-center py-4">{t.noFlightsFound}</p>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {searchResults.map((flight) => {
                    const isSelected = selectedNewFlight?.id === flight.id;
                    return (
                      <div
                        key={flight.id}
                        className={`border rounded-xl p-4 cursor-pointer transition-colors
                          ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                        onClick={() => setSelectedNewFlight(flight)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {flight.airline} · {flight.flightNumber}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {flight.origin} → {flight.destination}
                            </p>
                            <p className="text-xs text-gray-500">
                              {flight.departureTime} – {flight.arrivalTime} · {flight.duration} ·{' '}
                              {flight.stops === 0 ? t.direct : `${flight.stops} ${t.stops}`}
                            </p>
                          </div>
                          <div className="text-end">
                            <p className="font-bold text-blue-600 text-sm">
                              {flight.currency} {flight.price}
                            </p>
                            <span
                              className={`inline-block mt-1 text-xs px-3 py-1 rounded-full font-medium
                                ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {isSelected ? t.selectedFlight : t.selectFlight}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {fieldErrors.newFlight && (
                <p className="text-xs text-red-500">{fieldErrors.newFlight}</p>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={handleBack}
                  className="text-gray-600 px-6 py-3 rounded-xl font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {t.backBtn}
                </button>
                <button
                  onClick={handleNext}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  {t.nextBtn}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Fare & Payment */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Fare summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">{t.fareLabel}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">{t.fareLabel}</span>
                  <span className="font-bold text-gray-900 text-lg">
                    ${FARE_DIFF_USD.toFixed(2)}
                  </span>
                </div>
                {selectedNewFlight && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t.flightNumber}</span>
                      <span>{selectedNewFlight.flightNumber}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t.airline}</span>
                      <span>{selectedNewFlight.airline}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t.departure}</span>
                      <span>{selectedNewFlight.departureDate} {selectedNewFlight.departureTime}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment method */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">{t.paymentMethodLabel}</p>
                <div className="space-y-3">
                  <label
                    className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors
                      ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="accent-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-800">{t.payCard}</span>
                  </label>
                  <label
                    className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors
                      ${paymentMethod === 'miles' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="miles"
                      checked={paymentMethod === 'miles'}
                      onChange={() => setPaymentMethod('miles')}
                      className="accent-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-800">{t.payMiles}</span>
                  </label>
                </div>
              </div>

              {/* Window closed warning on this step */}
              {windowClosed && (
                <div className="rounded-xl p-4 bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700 font-medium">{t.windowClosed}</p>
                  <p className="text-xs text-red-500 mt-1">{t.policyError}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-between pt-2 gap-3">
                <button
                  onClick={handleBack}
                  className="text-gray-600 px-4 py-3 rounded-xl font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {t.backBtn}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="text-gray-700 px-6 py-3 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    {t.cancelBtn}
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={windowClosed || rebookStatus === 'loading'}
                    title={windowClosed ? t.policyError : undefined}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {rebookStatus === 'loading' ? t.confirmingBtn : t.confirmBtn}
                  </button>
                </div>
              </div>
              {windowClosed && (
                <p className="text-xs text-red-500 text-end">{t.policyError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
build/frontend-code/src/pages/FlightSearch.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Outlet } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import type { AppDispatch, RootState } from '../store/store';
import {
  searchFlightsThunk,
  type FlightEntity,
  type FlightSearchParams,
} from '../store/flightSlice';
import {
  createBookingThunk,
  type CreateBookingPayload,
} from '../store/bookingSlice';
import FlightCard from '../components/FlightCard';

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------
const strings = {
  en: {
    pageTitle: 'Search & Book Flights',
    availableFlights: 'Available Flights',
    from: 'From',
    to: 'To',
    departureDate: 'Departure Date',
    passengers: 'Passengers',
    cabinClass: 'Cabin Class',
    searchFlights: 'Search Flights',
    select: 'Select',
    economy: 'Economy',
    business: 'Business',
    first: 'First',
    noFlights: 'No flights found. Try adjusting your search.',
    loading: 'Searching for flights…',
    errorPrefix: 'Error: ',
    fareBreakdown: 'Fare Breakdown',
    baseFare: 'Base Fare',
    taxes: 'Taxes & Fees',
    total: 'Total',
    paymentMethod: 'Payment Method',
    card: 'Credit / Debit Card',
    miles: 'Redeem Miles',
    seatPreference: 'Seat Preference',
    window: 'Window',
    middle: 'Middle',
    aisle: 'Aisle',
    confirmBooking: 'Confirm Booking',
    bookingSuccess: 'Booking confirmed!',
    bookingError: 'Booking failed: ',
    close: 'Close',
    loyaltyBalance: 'Miles Balance',
    loyaltyTier: 'Tier',
    milesInsufficient: 'Insufficient miles balance.',
    fromPlaceholder: 'e.g. RUH',
    toPlaceholder: 'e.g. JED',
    stops: 'stops',
    nonstop: 'Nonstop',
    airline: 'Airline',
    flightNo: 'Flight',
    seats: 'seats available',
    duration: 'Duration',
    requiredFields: 'Please fill in origin, destination, and departure date.',
  },
  ar: {
    pageTitle: 'ابحث عن رحلات واحجزها',
    availableFlights: 'الرحلات المتاحة',
    from: 'من',
    to: 'إلى',
    departureDate: 'تاريخ المغادرة',
    passengers: 'المسافرون',
    cabinClass: 'درجة المقصورة',
    searchFlights: 'بحث عن رحلات',
    select: 'اختر',
    economy: 'اقتصادية',
    business: 'رجال أعمال',
    first: 'أولى',
    noFlights: 'لم يتم العثور على رحلات. حاول تعديل بحثك.',
    loading: 'جارٍ البحث عن رحلات…',
    errorPrefix: 'خطأ: ',
    fareBreakdown: 'تفاصيل الأجرة',
    baseFare: 'الأجرة الأساسية',
    taxes: 'الضرائب والرسوم',
    total: 'الإجمالي',
    paymentMethod: 'طريقة الدفع',
    card: 'بطاقة ائتمانية / مدينة',
    miles: 'استرداد الأميال',
    seatPreference: 'تفضيل المقعد',
    window: 'نافذة',
    middle: 'وسط',
    aisle: 'ممر',
    confirmBooking: 'تأكيد الحجز',
    bookingSuccess: 'تم تأكيد الحجز!',
    bookingError: 'فشل الحجز: ',
    close: 'إغلاق',
    loyaltyBalance: 'رصيد الأميال',
    loyaltyTier: 'المستوى',
    milesInsufficient: 'رصيد الأميال غير كافٍ.',
    fromPlaceholder: 'مثال: RUH',
    toPlaceholder: 'مثال: JED',
    stops: 'توقفات',
    nonstop: 'مباشرة',
    airline: 'شركة الطيران',
    flightNo: 'رحلة',
    seats: 'مقاعد متاحة',
    duration: 'المدة',
    requiredFields: 'يرجى تعبئة حقول المغادرة والوصول والتاريخ.',
  },
};

// ---------------------------------------------------------------------------
// Loyalty types (local — no slice provided)
// ---------------------------------------------------------------------------
interface LoyaltyAccount {
  milesBalance: number;
  tierStatus: string;
}

// ---------------------------------------------------------------------------
// Fare estimate helper
// ---------------------------------------------------------------------------
function estimateFare(price: number) {
  const tax = Math.round(price * 0.15);
  return { base: price, tax, total: price + tax };
}

// ---------------------------------------------------------------------------
// Booking confirmation modal
// ---------------------------------------------------------------------------
interface BookingModalProps {
  flight: FlightEntity;
  lang: 'en' | 'ar';
  loyalty: LoyaltyAccount | null;
  onClose: () => void;
  onConfirm: (payload: CreateBookingPayload) => void;
  creating: boolean;
  createError: string | null;
  success: boolean;
}

function BookingModal({
  flight,
  lang,
  loyalty,
  onClose,
  onConfirm,
  creating,
  createError,
  success,
}: BookingModalProps) {
  const t = strings[lang];
  const [seatPref, setSeatPref] = useState<'window' | 'middle' | 'aisle'>('window');
  const [payMethod, setPayMethod] = useState<'card' | 'miles'>('card');
  const fare = estimateFare(flight.price);

  const milesRequired = Math.round(flight.price * 10);
  const milesOk =
    payMethod === 'card' || (loyalty !== null && loyalty.milesBalance >= milesRequired);

  function handleConfirm() {
    if (!milesOk) return;
    onConfirm({ flightId: flight.id, seatPreference: seatPref, paymentMethod: payMethod });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
        {success ? (
          <div className="text-center py-8">
            <p className="text-2xl text-green-600 font-bold">{t.bookingSuccess}</p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t.close}
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">{t.fareBreakdown}</h2>

            <div className="space-y-1 text-sm mb-4">
              <div className="flex justify-between">
                <span>{t.airline}</span>
                <span>{flight.airline}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.flightNo}</span>
                <span>{flight.flightNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.baseFare}</span>
                <span>
                  {flight.currency} {fare.base.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t.taxes}</span>
                <span>
                  {flight.currency} {fare.tax.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1 mt-1">
                <span>{t.total}</span>
                <span>
                  {flight.currency} {fare.total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Seat Preference */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{t.seatPreference}</label>
              <div className="flex gap-2">
                {(['window', 'middle', 'aisle'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSeatPref(opt)}
                    className={`flex-1 py-2 rounded-lg border text-sm ${
                      seatPref === opt
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {t[opt]}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{t.paymentMethod}</label>
              <div className="flex gap-2">
                {(['card', 'miles'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPayMethod(opt)}
                    className={`flex-1 py-2 rounded-lg border text-sm ${
                      payMethod === opt
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {t[opt]}
                  </button>
                ))}
              </div>
              {payMethod === 'miles' && loyalty && (
                <p className="text-xs mt-1 text-gray-500">
                  {t.loyaltyBalance}: {loyalty.milesBalance.toLocaleString()} | {t.loyaltyTier}:{' '}
                  {loyalty.tierStatus}
                </p>
              )}
              {payMethod === 'miles' && !milesOk && (
                <p className="text-xs mt-1 text-red-600">{t.milesInsufficient}</p>
              )}
            </div>

            {createError && (
              <p className="text-sm text-red-600 mb-3">
                {t.bookingError}
                {createError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={creating}
              >
                {t.close}
              </button>
              <button
                onClick={handleConfirm}
                disabled={creating || !milesOk}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? '…' : t.confirmBooking}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavBar import shim — NavBar is generated separately; guard import gracefully
// ---------------------------------------------------------------------------
// The layout obligation in this file: render <NavBar /> + <Outlet />.
// Because NavBar is generated by another file, import it lazily.
let NavBar: React.ComponentType | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  NavBar = require('../components/NavBar').default ?? require('../components/NavBar').NavBar;
} catch {
  NavBar = null;
}

// ---------------------------------------------------------------------------
// AppLayout — owns the single <Outlet /> for the application
// ---------------------------------------------------------------------------
export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {NavBar ? <NavBar /> : null}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlightSearch page
// ---------------------------------------------------------------------------
export function FlightSearch() {
  const { lang } = useLanguage();
  const t = strings[lang as 'en' | 'ar'] ?? strings.en;
  const dispatch = useDispatch<AppDispatch>();

  // Redux state
  const searchResults = useSelector((s: RootState) => s.flights.searchResults);
  const searchLoading = useSelector((s: RootState) => s.flights.searchLoading);
  const searchError = useSelector((s: RootState) => s.flights.searchError);
  const createStatus = useSelector((s: RootState) => s.bookings.createStatus);
  const createError = useSelector((s: RootState) => s.bookings.createError);

  // Form state
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [cabinClass, setCabinClass] = useState('economy');
  const [formError, setFormError] = useState<string | null>(null);

  // Booking modal
  const [selectedFlight, setSelectedFlight] = useState<FlightEntity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Loyalty (fetched locally — no slice provided)
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);

  // Read token from storage — written by the auth login flow which stores it
  // under the key 'accessToken'.
  const getToken = useCallback(() => {
    return localStorage.getItem('accessToken') ?? sessionStorage.getItem('accessToken') ?? '';
  }, []);

  // Fetch loyalty balance
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch('/api/v1/loyalty/balance', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => {
        if (body?.data) {
          setLoyalty({
            milesBalance: body.data.milesBalance ?? body.data.balance ?? 0,
            tierStatus: body.data.tierStatus ?? body.data.tier ?? '',
          });
        }
      })
      .catch(() => {/* non-fatal */});
  }, [getToken]);

  // Search handler
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!origin.trim() || !destination.trim() || !departureDate) {
      setFormError(t.requiredFields);
      return;
    }
    const params: FlightSearchParams = {
      origin: origin.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      departureDate,
      cabinClass,
    };
    dispatch(searchFlightsThunk(params));
  }

  // Select flight → open modal
  function handleSelect(flight: FlightEntity) {
    setSelectedFlight(flight);
    setBookingSuccess(false);
    setModalOpen(true);
  }

  // Confirm booking
  function handleConfirmBooking(payload: CreateBookingPayload) {
    dispatch(createBookingThunk(payload));
  }

  // Watch booking status
  useEffect(() => {
    if (createStatus === 'succeeded') {
      setBookingSuccess(true);
    }
  }, [createStatus]);

  function handleCloseModal() {
    setModalOpen(false);
    setSelectedFlight(null);
    setBookingSuccess(false);
  }

  const cabinOptions = [
    { value: 'economy', label: t.economy },
    { value: 'business', label: t.business },
    { value: 'first', label: t.first },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page heading */}
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t.pageTitle}</h1>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="bg-white rounded-2xl shadow p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* From */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.from}</label>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder={t.fromPlaceholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.to}</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={t.toPlaceholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Departure Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.departureDate}</label>
          <input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Cabin Class */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.cabinClass}</label>
          <select
            value={cabinClass}
            onChange={(e) => setCabinClass(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {cabinOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Form-level validation error */}
        {formError && (
          <p className="md:col-span-2 text-sm text-red-600">{formError}</p>
        )}

        {/* Search button */}
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={searchLoading}
            className="px-8 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searchLoading ? t.loading : t.searchFlights}
          </button>
        </div>
      </form>

      {/* Loyalty banner */}
      {loyalty && (
        <div className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-sm flex gap-4">
          <span>
            {t.loyaltyBalance}: <strong>{loyalty.milesBalance.toLocaleString()}</strong>
          </span>
          <span>
            {t.loyaltyTier}: <strong>{loyalty.tierStatus}</strong>
          </span>
        </div>
      )}

      {/* Available flights heading */}
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t.availableFlights}</h2>

      {/* Search error */}
      {searchError && (
        <p className="text-red-600 mb-4">
          {t.errorPrefix}
          {searchError}
        </p>
      )}

      {/* Loading state */}
      {searchLoading && (
        <p className="text-gray-500 text-center py-12">{t.loading}</p>
      )}

      {/* Results */}
      {!searchLoading && searchResults.length === 0 && !searchError && (
        <p className="text-gray-400 text-center py-12">{t.noFlights}</p>
      )}

      <div className="space-y-4">
        {searchResults.map((flight) => (
          <div key={flight.id} className="bg-white rounded-2xl shadow p-4">
            {/* FlightCard for display */}
            <FlightCard
              flight={{
                id: flight.id,
                flightNumber: flight.flightNumber,
                origin: flight.origin,
                destination: flight.destination,
                departureTime: flight.departureTime,
                arrivalTime: flight.arrivalTime,
                status: 'on-time',
                cabinClass: flight.cabinClass,
                duration: flight.duration,
              }}
            />

            {/* Extra fare / seat info */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600 space-x-4 rtl:space-x-reverse">
                <span>
                  {flight.stops === 0
                    ? t.nonstop
                    : `${flight.stops} ${t.stops}`}
                </span>
                <span>
                  {t.duration}: {flight.duration}
                </span>
                <span>
                  {flight.availableSeats} {t.seats}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-bold text-lg text-blue-700">
                  {flight.currency} {flight.price.toFixed(2)}
                </span>
                <button
                  onClick={() => handleSelect(flight)}
                  disabled={flight.availableSeats === 0}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.select}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Booking modal */}
      {modalOpen && selectedFlight && (
        <BookingModal
          flight={selectedFlight}
          lang={lang as 'en' | 'ar'}
          loyalty={loyalty}
          onClose={handleCloseModal}
          onConfirm={handleConfirmBooking}
          creating={createStatus === 'loading'}
          createError={createError}
          success={bookingSuccess}
        />
      )}
    </div>
  );
}

export default FlightSearch;
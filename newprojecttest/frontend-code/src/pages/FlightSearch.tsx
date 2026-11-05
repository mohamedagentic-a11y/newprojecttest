import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { searchFlights } from '../store/slices/flightSlice';
import { clearFlightResults, clearError } from '../store/slices/flightSlice';
import { createBooking } from '../store/slices/bookingSlice';
import { clearCreateState } from '../store/slices/bookingSlice';
import type { RootState, AppDispatch } from '../store/index';
import { useI18n } from '../i18n/index';

const translations = {
  en: {
    pageTitle: 'Search & Book Flights',
    availableFlights: 'Available Flights',
    from: 'From',
    to: 'To',
    departureDate: 'Departure Date',
    cabinClass: 'Cabin Class',
    searchFlights: 'Search Flights',
    select: 'Select',
    economy: 'Economy',
    business: 'Business',
    first: 'First',
    noFlights: 'No flights found. Please adjust your search criteria.',
    loading: 'Searching for flights...',
    bookingLoading: 'Processing booking...',
    bookingSuccess: 'Booking created successfully!',
    bookingError: 'Booking failed. Please try again.',
    searchError: 'Search failed. Please try again.',
    fromPlaceholder: 'e.g. RUH',
    toPlaceholder: 'e.g. JED',
    airline: 'Airline',
    flightNumber: 'Flight Number',
    departure: 'Departure',
    arrival: 'Arrival',
    duration: 'Duration',
    price: 'Price',
    seats: 'Available Seats',
    loadMore: 'Load More',
    seatPreference: 'Seat Preference',
    window: 'Window',
    aisle: 'Aisle',
    any: 'Any',
    paymentMethod: 'Payment Method',
    miles: 'Miles',
    card: 'Card',
    book: 'Book Flight',
    cancel: 'Cancel',
    confirmBooking: 'Confirm Booking',
    selectedFlight: 'Selected Flight',
    requiredFrom: 'Origin is required',
    requiredTo: 'Destination is required',
    requiredDate: 'Departure date is required',
  },
  ar: {
    pageTitle: 'ابحث عن رحلات واحجزها',
    availableFlights: 'الرحلات المتاحة',
    from: 'من',
    to: 'إلى',
    departureDate: 'تاريخ المغادرة',
    cabinClass: 'درجة الكابينة',
    searchFlights: 'بحث عن رحلات',
    select: 'اختر',
    economy: 'اقتصادية',
    business: 'أعمال',
    first: 'أولى',
    noFlights: 'لم يتم العثور على رحلات. يرجى تعديل معايير البحث.',
    loading: 'جارٍ البحث عن رحلات...',
    bookingLoading: 'جارٍ معالجة الحجز...',
    bookingSuccess: 'تم إنشاء الحجز بنجاح!',
    bookingError: 'فشل الحجز. يرجى المحاولة مرة أخرى.',
    searchError: 'فشل البحث. يرجى المحاولة مرة أخرى.',
    fromPlaceholder: 'مثال: RUH',
    toPlaceholder: 'مثال: JED',
    airline: 'شركة الطيران',
    flightNumber: 'رقم الرحلة',
    departure: 'المغادرة',
    arrival: 'الوصول',
    duration: 'المدة',
    price: 'السعر',
    seats: 'المقاعد المتاحة',
    loadMore: 'تحميل المزيد',
    seatPreference: 'تفضيل المقعد',
    window: 'نافذة',
    aisle: 'ممر',
    any: 'أي',
    paymentMethod: 'طريقة الدفع',
    miles: 'أميال',
    card: 'بطاقة',
    book: 'احجز الرحلة',
    cancel: 'إلغاء',
    confirmBooking: 'تأكيد الحجز',
    selectedFlight: 'الرحلة المختارة',
    requiredFrom: 'المطار الأصلي مطلوب',
    requiredTo: 'وجهة الوصول مطلوبة',
    requiredDate: 'تاريخ المغادرة مطلوب',
  },
};

interface FlightEntity {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  currency: string;
  cabinClass: string;
  availableSeats: number;
}

const FlightSearch: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { language, dir } = useI18n();
  const t = translations[language];

  const flightState = useSelector((state: RootState) => (state as any).flights);
  const bookingState = useSelector((state: RootState) => (state as any).bookings);

  const flights: FlightEntity[] = flightState?.results ?? [];
  const flightLoading: boolean = flightState?.loading ?? false;
  const flightError: string | null = flightState?.error ?? null;
  const nextCursor: string | null = flightState?.nextCursor ?? null;
  const hasMore: boolean = flightState?.hasMore ?? false;

  const bookingLoading: boolean = bookingState?.createLoading ?? false;
  const bookingError: string | null = bookingState?.createError ?? null;
  const bookingSuccess: boolean = bookingState?.createSuccess ?? false;

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [cabinClass, setCabinClass] = useState('economy');

  const [validationErrors, setValidationErrors] = useState<{ origin?: string; destination?: string; departureDate?: string }>({});

  const [selectedFlight, setSelectedFlight] = useState<FlightEntity | null>(null);
  const [seatPreference, setSeatPreference] = useState<'window' | 'aisle' | 'any'>('any');
  const [paymentMethod, setPaymentMethod] = useState<'miles' | 'card'>('card');
  const [showBookingPanel, setShowBookingPanel] = useState(false);

  useEffect(() => {
    dispatch(clearFlightResults());
    dispatch(clearCreateState());
    return () => {
      dispatch(clearFlightResults());
      dispatch(clearCreateState());
    };
  }, [dispatch]);

  useEffect(() => {
    if (bookingSuccess) {
      setShowBookingPanel(false);
      setSelectedFlight(null);
    }
  }, [bookingSuccess]);

  const validate = (): boolean => {
    const errors: { origin?: string; destination?: string; departureDate?: string } = {};
    if (!origin.trim()) errors.origin = t.requiredFrom;
    if (!destination.trim()) errors.destination = t.requiredTo;
    if (!departureDate) errors.departureDate = t.requiredDate;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSearch = () => {
    if (!validate()) return;
    dispatch(clearFlightResults());
    dispatch(clearError());
    dispatch(searchFlights({ origin, destination, departureDate, cabinClass }) as any);
  };

  const handleLoadMore = () => {
    if (!hasMore || !nextCursor) return;
    dispatch(searchFlights({ origin, destination, departureDate, cabinClass, cursor: nextCursor }) as any);
  };

  const handleSelect = (flight: FlightEntity) => {
    setSelectedFlight(flight);
    setShowBookingPanel(true);
    dispatch(clearCreateState());
  };

  const handleCancelBooking = () => {
    setShowBookingPanel(false);
    setSelectedFlight(null);
    dispatch(clearCreateState());
  };

  const handleConfirmBooking = () => {
    if (!selectedFlight) return;
    dispatch(
      createBooking({
        flightId: selectedFlight.id,
        seatPreference,
        paymentMethod,
      }) as any
    );
  };

  const cabinOptions = [
    { value: 'economy', label: t.economy },
    { value: 'business', label: t.business },
    { value: 'first', label: t.first },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Page Heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-start">
          {t.pageTitle}
        </h1>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-start">
                {t.from}
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  if (validationErrors.origin) setValidationErrors((prev) => ({ ...prev, origin: undefined }));
                }}
                placeholder={t.fromPlaceholder}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-start ${
                  validationErrors.origin ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.origin && (
                <p className="text-red-500 text-xs mt-1 text-start">{validationErrors.origin}</p>
              )}
            </div>

            {/* To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-start">
                {t.to}
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  if (validationErrors.destination) setValidationErrors((prev) => ({ ...prev, destination: undefined }));
                }}
                placeholder={t.toPlaceholder}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-start ${
                  validationErrors.destination ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.destination && (
                <p className="text-red-500 text-xs mt-1 text-start">{validationErrors.destination}</p>
              )}
            </div>

            {/* Departure Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-start">
                {t.departureDate}
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => {
                  setDepartureDate(e.target.value);
                  if (validationErrors.departureDate) setValidationErrors((prev) => ({ ...prev, departureDate: undefined }));
                }}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.departureDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {validationErrors.departureDate && (
                <p className="text-red-500 text-xs mt-1 text-start">{validationErrors.departureDate}</p>
              )}
            </div>

            {/* Cabin Class */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-start">
                {t.cabinClass}
              </label>
              <select
                value={cabinClass}
                onChange={(e) => setCabinClass(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {cabinOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Button */}
          <div className="mt-5 flex justify-start">
            <button
              onClick={handleSearch}
              disabled={flightLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold px-8 py-2.5 rounded-lg transition-colors duration-200"
            >
              {flightLoading ? t.loading : t.searchFlights}
            </button>
          </div>

          {flightError && (
            <p className="mt-3 text-red-600 text-sm text-start">{t.searchError}: {flightError}</p>
          )}
        </div>

        {/* Available Flights Heading */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-start">
          {t.availableFlights}
        </h2>

        {/* Booking Confirmation Panel */}
        {showBookingPanel && selectedFlight && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3 text-start">{t.selectedFlight}</h3>
            <div className="text-sm text-gray-700 mb-4 text-start">
              <span className="font-medium">{selectedFlight.airline}</span> — {selectedFlight.flightNumber} |{' '}
              {selectedFlight.origin} → {selectedFlight.destination} |{' '}
              {new Date(selectedFlight.departureTime).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-start">{t.seatPreference}</label>
                <select
                  value={seatPreference}
                  onChange={(e) => setSeatPreference(e.target.value as 'window' | 'aisle' | 'any')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="any">{t.any}</option>
                  <option value="window">{t.window}</option>
                  <option value="aisle">{t.aisle}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-start">{t.paymentMethod}</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'miles' | 'card')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="card">{t.card}</option>
                  <option value="miles">{t.miles}</option>
                </select>
              </div>
            </div>

            {bookingError && (
              <p className="text-red-600 text-sm mb-3 text-start">{t.bookingError}: {bookingError}</p>
            )}
            {bookingSuccess && (
              <p className="text-green-600 text-sm mb-3 text-start">{t.bookingSuccess}</p>
            )}

            <div className="flex gap-3 justify-start">
              <button
                onClick={handleConfirmBooking}
                disabled={bookingLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg transition-colors duration-200"
              >
                {bookingLoading ? t.bookingLoading : t.confirmBooking}
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={bookingLoading}
                className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-semibold px-6 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Flight Results */}
        {flightLoading && flights.length === 0 ? (
          <div className="text-center py-16 text-gray-500">{t.loading}</div>
        ) : flights.length === 0 && !flightLoading ? (
          <div className="text-center py-16 text-gray-400">{t.noFlights}</div>
        ) : (
          <div className="space-y-4">
            {flights.map((flight) => (
              <div
                key={flight.id}
                className={`bg-white rounded-2xl shadow-sm border transition-shadow duration-200 hover:shadow-md p-5 ${
                  selectedFlight?.id === flight.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{flight.airline}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{flight.flightNumber}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-800">
                      <div className="text-start">
                        <p className="font-bold text-lg">{flight.origin}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(flight.departureTime).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <div className="h-px flex-1 bg-gray-300" />
                          <span className="text-xs text-gray-400">{flight.duration}</span>
                          <div className="h-px flex-1 bg-gray-300" />
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="font-bold text-lg">{flight.destination}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(flight.arrivalTime).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>{t.seats}: {flight.availableSeats}</span>
                      <span>·</span>
                      <span>{cabinOptions.find((c) => c.value === flight.cabinClass)?.label ?? flight.cabinClass}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 min-w-[120px]">
                    <div className="text-end">
                      <p className="text-xl font-bold text-blue-700">
                        {flight.currency} {flight.price.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSelect(flight)}
                      disabled={bookingLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors duration-200"
                    >
                      {t.select}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={flightLoading}
                  className="border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold px-8 py-2.5 rounded-lg transition-colors duration-200"
                >
                  {flightLoading ? t.loading : t.loadMore}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightSearch;
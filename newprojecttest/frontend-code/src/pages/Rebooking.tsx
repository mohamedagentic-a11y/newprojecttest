import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { rebookFlight, fetchCheckinStatus } from '../store/slices/bookingSlice';
import { bookingSlice } from '../store/slices/bookingSlice';
import { searchFlights } from '../store/slices/flightSlice';
import { flightSlice } from '../store/slices/flightSlice';
import type { RootState, AppDispatch } from '../store/index';
import { useI18n } from '../i18n/index';

const { clearRebookState } = bookingSlice.actions;
const { clearFlightResults, clearError } = flightSlice.actions;

type PaymentMethod = 'miles' | 'card';

const translations = {
  en: {
    pageTitle: 'Pre-Departure Rebooking',
    existingBooking: 'Existing Booking',
    bookingRef: 'Booking Reference',
    flight: 'Flight',
    departure: 'Departure',
    destination: 'Destination',
    departureTime: 'Departure Time',
    noBookingSelected: 'No booking selected. Please go back and select a booking.',
    selectNewFlight: 'Select New Flight',
    searchFlightsLabel: 'Search Available Flights',
    origin: 'Origin',
    destination_label: 'Destination',
    date: 'Date',
    cabinClass: 'Cabin Class',
    economy: 'Economy',
    business: 'Business',
    first: 'First',
    searchButton: 'Search Flights',
    availableFlights: 'Available Flights',
    selectFlight: 'Select',
    selected: 'Selected',
    noFlightsFound: 'No flights found.',
    paymentMethod: 'Payment Method',
    redeemMiles: 'Redeem Miles (12,450 mi)',
    payByCard: 'Pay by Card',
    fareDifference: 'Fare Difference',
    fareDiffLabel: 'Amount Due',
    cancel: 'Cancel',
    confirmPay: 'Confirm & Pay $75.00',
    rebookingSuccess: 'Rebooking confirmed successfully!',
    rebookingError: 'Rebooking failed. Please try again.',
    cutoffError: 'Rebooking is not available. The departure is within 2 hours or has passed.',
    loadingFlights: 'Searching flights...',
    rebooking: 'Processing rebooking...',
    selectNewFlightPrompt: 'Please select a new flight to proceed.',
    flightNumber: 'Flight No.',
    arrives: 'Arrives',
    price: 'Price',
    seats: 'Seats Available',
    backToBookings: 'Back to Bookings',
  },
  ar: {
    pageTitle: 'إعادة الحجز قبل المغادرة',
    existingBooking: 'الحجز الحالي',
    bookingRef: 'رقم الحجز',
    flight: 'الرحلة',
    departure: 'المغادرة',
    destination: 'الوجهة',
    departureTime: 'وقت المغادرة',
    noBookingSelected: 'لم يتم اختيار حجز. يرجى العودة واختيار حجز.',
    selectNewFlight: 'اختر رحلة جديدة',
    searchFlightsLabel: 'البحث عن الرحلات المتاحة',
    origin: 'المطار الأصلي',
    destination_label: 'الوجهة',
    date: 'التاريخ',
    cabinClass: 'درجة المقصورة',
    economy: 'الاقتصادية',
    business: 'رجال الأعمال',
    first: 'الأولى',
    searchButton: 'البحث عن الرحلات',
    availableFlights: 'الرحلات المتاحة',
    selectFlight: 'اختر',
    selected: 'مختارة',
    noFlightsFound: 'لا توجد رحلات متاحة.',
    paymentMethod: 'طريقة الدفع',
    redeemMiles: 'استبدال الأميال (١٢٬٤٥٠ ميل)',
    payByCard: 'الدفع بالبطاقة',
    fareDifference: 'فرق السعر',
    fareDiffLabel: 'المبلغ المستحق',
    cancel: 'إلغاء',
    confirmPay: 'تأكيد والدفع $75.00',
    rebookingSuccess: 'تم تأكيد إعادة الحجز بنجاح!',
    rebookingError: 'فشلت إعادة الحجز. يرجى المحاولة مرة أخرى.',
    cutoffError: 'إعادة الحجز غير متاحة. موعد المغادرة خلال ساعتين أو قد مضى.',
    loadingFlights: 'جارٍ البحث عن الرحلات...',
    rebooking: 'جارٍ معالجة إعادة الحجز...',
    selectNewFlightPrompt: 'يرجى اختيار رحلة جديدة للمتابعة.',
    flightNumber: 'رقم الرحلة',
    arrives: 'الوصول',
    price: 'السعر',
    seats: 'المقاعد المتاحة',
    backToBookings: 'العودة إلى الحجوزات',
  },
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const Rebooking: React.FC = () => {
  const { language, dir } = useI18n();
  const t = translations[language];
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const selectedBooking = useSelector((state: RootState) => state.booking.selectedBooking);
  const rebookStatus = useSelector((state: RootState) => state.booking.rebookStatus);
  const rebookError = useSelector((state: RootState) => state.booking.rebookError);

  const flights = useSelector((state: RootState) => state.flight.flights);
  const flightSearchStatus = useSelector((state: RootState) => state.flight.status);

  const [cutoffViolation, setCutoffViolation] = useState(false);
  const [selectedNewFlightId, setSelectedNewFlightId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('miles');

  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDestination, setSearchDestination] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchCabin, setSearchCabin] = useState('economy');
  const [hasSearched, setHasSearched] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    document.title = t.pageTitle;
  }, [language, t.pageTitle]);

  useEffect(() => {
    if (selectedBooking) {
      const depTime = new Date(selectedBooking.departureTime).getTime();
      const now = Date.now();
      if (depTime - now < TWO_HOURS_MS) {
        setCutoffViolation(true);
      } else {
        setCutoffViolation(false);
      }
      setSearchOrigin(selectedBooking.origin || '');
      setSearchDestination(selectedBooking.destination || '');
    }
  }, [selectedBooking]);

  useEffect(() => {
    return () => {
      dispatch(clearRebookState());
      dispatch(clearFlightResults());
    };
  }, [dispatch]);

  useEffect(() => {
    if (rebookStatus === 'succeeded') {
      setSuccessMessage(t.rebookingSuccess);
    }
  }, [rebookStatus, t.rebookingSuccess]);

  const handleSearch = () => {
    if (!searchOrigin || !searchDestination || !searchDate) return;
    setHasSearched(true);
    dispatch(clearFlightResults());
    dispatch(
      searchFlights({
        origin: searchOrigin,
        destination: searchDestination,
        departureDate: searchDate,
        cabinClass: searchCabin,
      })
    );
  };

  const handleCancel = () => {
    dispatch(clearRebookState());
    dispatch(clearFlightResults());
    navigate(-1);
  };

  const handleConfirmPay = () => {
    if (!selectedBooking || !selectedNewFlightId) return;
    dispatch(
      rebookFlight({
        bookingId: selectedBooking.id,
        newFlightId: selectedNewFlightId,
        paymentMethod,
      })
    );
  };

  const canConfirm =
    !!selectedNewFlightId && !cutoffViolation && rebookStatus !== 'loading';

  if (!selectedBooking) {
    return (
      <div dir={dir} className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <p className="text-gray-600 mb-4">{t.noBookingSelected}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t.backToBookings}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page Heading */}
        <h1 className="text-2xl font-bold text-gray-900">{t.pageTitle}</h1>

        {/* Cutoff Error */}
        {cutoffViolation && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-4">
            {t.cutoffError}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-300 text-green-700 rounded-lg p-4">
            {successMessage}
          </div>
        )}

        {/* Rebook Error */}
        {rebookStatus === 'failed' && rebookError && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-4">
            {rebookError}
          </div>
        )}

        {/* Existing Booking */}
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t.existingBooking}</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt className="text-gray-500 font-medium">{t.bookingRef}</dt>
            <dd className="text-gray-900">{selectedBooking.id}</dd>

            <dt className="text-gray-500 font-medium">{t.flight}</dt>
            <dd className="text-gray-900">{selectedBooking.flightNumber || '—'}</dd>

            <dt className="text-gray-500 font-medium">{t.departure}</dt>
            <dd className="text-gray-900">{selectedBooking.origin || '—'}</dd>

            <dt className="text-gray-500 font-medium">{t.destination}</dt>
            <dd className="text-gray-900">{selectedBooking.destination || '—'}</dd>

            <dt className="text-gray-500 font-medium">{t.departureTime}</dt>
            <dd className="text-gray-900">
              {selectedBooking.departureTime
                ? new Date(selectedBooking.departureTime).toLocaleString(
                    language === 'ar' ? 'ar-SA' : 'en-US'
                  )
                : '—'}
            </dd>
          </dl>
        </section>

        {/* Search New Flights */}
        {!cutoffViolation && rebookStatus !== 'succeeded' && (
          <section className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{t.selectNewFlight}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.origin}
                </label>
                <input
                  type="text"
                  value={searchOrigin}
                  onChange={(e) => setSearchOrigin(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. RUH"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.destination_label}
                </label>
                <input
                  type="text"
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. JED"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.date}
                </label>
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.cabinClass}
                </label>
                <select
                  value={searchCabin}
                  onChange={(e) => setSearchCabin(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="economy">{t.economy}</option>
                  <option value="business">{t.business}</option>
                  <option value="first">{t.first}</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchOrigin || !searchDestination || !searchDate || flightSearchStatus === 'loading'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {flightSearchStatus === 'loading' ? t.loadingFlights : t.searchButton}
            </button>

            {/* Flight Results */}
            {hasSearched && flightSearchStatus !== 'loading' && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                  {t.availableFlights}
                </h3>
                {flights && flights.length > 0 ? (
                  <ul className="space-y-3">
                    {flights.map((flight: any) => {
                      const isSelected = selectedNewFlightId === flight.id;
                      return (
                        <li
                          key={flight.id}
                          className={`border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedNewFlightId(flight.id)}
                        >
                          <div className="text-sm space-y-1">
                            <p className="font-semibold text-gray-900">
                              {t.flightNumber}: {flight.flightNumber}
                            </p>
                            <p className="text-gray-500">
                              {flight.origin} → {flight.destination}
                            </p>
                            <p className="text-gray-500">
                              {flight.departureTime
                                ? new Date(flight.departureTime).toLocaleString(
                                    language === 'ar' ? 'ar-SA' : 'en-US'
                                  )
                                : '—'}
                            </p>
                            {flight.price !== undefined && (
                              <p className="text-gray-700">
                                {t.price}: ${flight.price}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNewFlightId(flight.id);
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium shrink-0 ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                          >
                            {isSelected ? t.selected : t.selectFlight}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">{t.noFlightsFound}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Payment Method */}
        {!cutoffViolation && rebookStatus !== 'succeeded' && (
          <section className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{t.paymentMethod}</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="miles"
                  checked={paymentMethod === 'miles'}
                  onChange={() => setPaymentMethod('miles')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-800">{t.redeemMiles}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-800">{t.payByCard}</span>
              </label>
            </div>

            {/* Fare Difference */}
            <div className="mt-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">{t.fareDifference}</h3>
              <p className="text-gray-900 font-medium">
                {t.fareDiffLabel}: <span className="text-blue-700">$75.00</span>
              </p>
            </div>
          </section>
        )}

        {/* Actions */}
        {rebookStatus !== 'succeeded' && (
          <div className="flex flex-wrap gap-4 justify-end">
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleConfirmPay}
              disabled={!canConfirm}
              title={
                !selectedNewFlightId
                  ? t.selectNewFlightPrompt
                  : cutoffViolation
                  ? t.cutoffError
                  : undefined
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {rebookStatus === 'loading' ? t.rebooking : t.confirmPay}
            </button>
          </div>
        )}

        {/* Hint when no flight selected */}
        {!selectedNewFlightId && !cutoffViolation && rebookStatus !== 'succeeded' && (
          <p className="text-sm text-gray-400 text-end">{t.selectNewFlightPrompt}</p>
        )}
      </div>
    </div>
  );
};

export default Rebooking;
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { createBooking } from '../store/slices/bookingSlice';
import { fetchLoyaltyBalance, redeemMilesThunk } from '../store/slices/loyaltySlice';
import { clearRedeemError, clearLoyaltyError } from '../store/slices/loyaltySlice';
import type { RootState, AppDispatch } from '../store/index';
import { useI18n } from '../i18n/index';

type SeatType = 'window' | 'aisle' | 'middle';
type SeatStatus = 'available' | 'occupied' | 'selected' | 'upgrade';
type CabinClass = 'economy' | 'business';

interface Seat {
  id: string;
  row: number;
  col: string;
  type: SeatType;
  status: SeatStatus;
  cabin: CabinClass;
  upgradeRequired: boolean;
}

const translations = {
  en: {
    pageTitle: 'Seat Selection & Upgrades',
    heading: 'Seat Selection & Upgrades',
    loyaltyBalance: 'Loyalty Miles Balance',
    miles: 'miles',
    tier: 'Tier',
    economy: 'Economy',
    business: 'Business',
    seatMapHeading: 'Select Your Seat',
    window: 'Window',
    aisle: 'Aisle',
    middle: 'Middle',
    available: 'Available',
    occupied: 'Occupied',
    selected: 'Selected',
    upgradeAvailable: 'Upgrade Available',
    upgradeSection: 'Upgrade to Business Class',
    upgradeDesc: 'Redeem miles to upgrade your seat to Business Class.',
    milesRequired: 'Miles required',
    redeemUpgrade: 'Redeem Miles for Upgrade',
    redeeming: 'Redeeming…',
    upgradeSuccess: 'Upgrade successful! Business class seat unlocked.',
    upgradeError: 'Failed to redeem miles. Please try again.',
    confirmSelection: 'Confirm Selection',
    confirming: 'Confirming…',
    noSeatSelected: 'Please select a seat to continue.',
    bookingSuccess: 'Booking confirmed!',
    bookingError: 'Failed to create booking. Please try again.',
    selectedSeat: 'Selected Seat',
    row: 'Row',
    seatPreference: 'Seat Preference',
    flightId: 'Flight',
    loadingBalance: 'Loading loyalty balance…',
    balanceError: 'Could not load loyalty balance.',
    noFlightSelected: 'No flight selected. Please go back and select a flight.',
    payWithMiles: 'Pay with miles',
    payWithCard: 'Pay with card',
    paymentMethod: 'Payment Method',
    legend: 'Legend',
  },
  ar: {
    pageTitle: 'اختيار المقعد والترقيات',
    heading: 'اختيار المقعد والترقيات',
    loyaltyBalance: 'رصيد أميال الولاء',
    miles: 'ميل',
    tier: 'المستوى',
    economy: 'الدرجة الاقتصادية',
    business: 'درجة رجال الأعمال',
    seatMapHeading: 'اختر مقعدك',
    window: 'نافذة',
    aisle: 'ممر',
    middle: 'وسط',
    available: 'متاح',
    occupied: 'مشغول',
    selected: 'محدد',
    upgradeAvailable: 'ترقية متاحة',
    upgradeSection: 'الترقية إلى درجة رجال الأعمال',
    upgradeDesc: 'استبدل الأميال للترقية إلى مقعد في درجة رجال الأعمال.',
    milesRequired: 'الأميال المطلوبة',
    redeemUpgrade: 'استبدال الأميال للترقية',
    redeeming: 'جارٍ الاستبدال…',
    upgradeSuccess: 'تمت الترقية بنجاح! تم فتح مقعد درجة رجال الأعمال.',
    upgradeError: 'فشل استبدال الأميال. يرجى المحاولة مجددًا.',
    confirmSelection: 'تأكيد الاختيار',
    confirming: 'جارٍ التأكيد…',
    noSeatSelected: 'يرجى اختيار مقعد للمتابعة.',
    bookingSuccess: 'تم تأكيد الحجز!',
    bookingError: 'فشل إنشاء الحجز. يرجى المحاولة مجددًا.',
    selectedSeat: 'المقعد المحدد',
    row: 'صف',
    seatPreference: 'تفضيل المقعد',
    flightId: 'الرحلة',
    loadingBalance: 'جارٍ تحميل رصيد الولاء…',
    balanceError: 'تعذّر تحميل رصيد الولاء.',
    noFlightSelected: 'لم يتم اختيار رحلة. يرجى العودة واختيار رحلة.',
    payWithMiles: 'الدفع بالأميال',
    payWithCard: 'الدفع بالبطاقة',
    paymentMethod: 'طريقة الدفع',
    legend: 'المفتاح',
  },
};

const UPGRADE_MILES_COST = 5000;

function generateSeatMap(): Seat[] {
  const seats: Seat[] = [];
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  const colTypes: Record<string, SeatType> = {
    A: 'window',
    B: 'middle',
    C: 'aisle',
    D: 'aisle',
    E: 'middle',
    F: 'window',
  };

  for (let row = 1; row <= 20; row++) {
    const cabin: CabinClass = row <= 4 ? 'business' : 'economy';
    for (const col of cols) {
      const occupied = Math.random() < 0.3;
      seats.push({
        id: `${row}${col}`,
        row,
        col,
        type: colTypes[col],
        status: occupied ? 'occupied' : 'available',
        cabin,
        upgradeRequired: cabin === 'business',
      });
    }
  }
  return seats;
}

const INITIAL_SEATS = generateSeatMap();

const SeatSelection: React.FC = () => {
  const { language } = useI18n();
  const t = translations[language];
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const loyaltyState = useSelector((state: RootState) => state.loyalty);
  const bookingState = useSelector((state: RootState) => state.booking);

  const [seats, setSeats] = useState<Seat[]>(INITIAL_SEATS);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'miles' | 'card'>('card');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const flightId = useSelector((state: RootState) => {
    const bookings = (state.booking as any).bookings;
    if (Array.isArray(bookings) && bookings.length > 0) {
      return bookings[bookings.length - 1]?.flightId ?? null;
    }
    return null;
  });

  const selectedFlightId: string | null =
    (bookingState as any).selectedFlightId ??
    (bookingState as any).currentFlightId ??
    flightId ??
    null;

  useEffect(() => {
    dispatch(fetchLoyaltyBalance());
    return () => {
      dispatch(clearLoyaltyError());
      dispatch(clearRedeemError());
    };
  }, [dispatch]);

  const balance: number = (loyaltyState as any).balance ?? (loyaltyState as any).miles ?? 0;
  const tier: string = (loyaltyState as any).tier ?? (loyaltyState as any).tierStatus ?? '';
  const loyaltyLoading: boolean = (loyaltyState as any).loading ?? false;
  const loyaltyError: string | null = (loyaltyState as any).error ?? null;
  const redeemError: string | null = (loyaltyState as any).redeemError ?? null;

  const selectedSeat = seats.find((s) => s.id === selectedSeatId) ?? null;

  const handleSeatClick = (seat: Seat) => {
    if (seat.status === 'occupied') return;
    if (seat.upgradeRequired && !upgraded) return;

    setSeats((prev) =>
      prev.map((s) => {
        if (s.id === seat.id) {
          return { ...s, status: s.status === 'selected' ? 'available' : 'selected' };
        }
        if (s.status === 'selected') {
          return { ...s, status: 'available' };
        }
        return s;
      })
    );
    setSelectedSeatId((prev) => (prev === seat.id ? null : seat.id));
    setBookingMessage(null);
  };

  const handleRedeemMiles = async () => {
    if (balance < UPGRADE_MILES_COST) return;
    setIsRedeeming(true);
    setUpgradeMessage(null);
    try {
      const result = await dispatch(
        redeemMilesThunk({ amount: UPGRADE_MILES_COST, serviceType: 'upgrade' })
      );
      if (redeemMilesThunk.fulfilled.match(result)) {
        setUpgraded(true);
        setUpgradeMessage(t.upgradeSuccess);
        dispatch(fetchLoyaltyBalance());
      } else {
        setUpgradeMessage(t.upgradeError);
      }
    } catch {
      setUpgradeMessage(t.upgradeError);
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleConfirmSelection = async () => {
    if (!selectedSeat) return;
    if (!selectedFlightId) {
      setBookingMessage(t.noFlightSelected);
      return;
    }
    setIsConfirming(true);
    setBookingMessage(null);
    try {
      const result = await dispatch(
        createBooking({
          flightId: selectedFlightId,
          seatPreference: selectedSeat.type,
          paymentMethod,
        })
      );
      if (createBooking.fulfilled.match(result)) {
        setBookingMessage(t.bookingSuccess);
        setTimeout(() => navigate('/bookings'), 1500);
      } else {
        setBookingMessage(t.bookingError);
      }
    } catch {
      setBookingMessage(t.bookingError);
    } finally {
      setIsConfirming(false);
    }
  };

  const getSeatColor = (seat: Seat): string => {
    if (seat.status === 'occupied') return 'bg-gray-400 cursor-not-allowed';
    if (seat.status === 'selected') return 'bg-blue-600 text-white cursor-pointer';
    if (seat.upgradeRequired && !upgraded)
      return 'bg-yellow-200 border-yellow-500 cursor-not-allowed opacity-60';
    if (seat.cabin === 'business') return 'bg-yellow-300 border-yellow-600 cursor-pointer hover:bg-yellow-400';
    switch (seat.type) {
      case 'window':
        return 'bg-green-200 border-green-500 cursor-pointer hover:bg-green-300';
      case 'aisle':
        return 'bg-blue-200 border-blue-500 cursor-pointer hover:bg-blue-300';
      case 'middle':
        return 'bg-purple-200 border-purple-500 cursor-pointer hover:bg-purple-300';
      default:
        return 'bg-gray-200 cursor-pointer hover:bg-gray-300';
    }
  };

  const businessSeats = seats.filter((s) => s.cabin === 'business');
  const economySeats = seats.filter((s) => s.cabin === 'economy');

  const businessRows = Array.from(new Set(businessSeats.map((s) => s.row))).sort((a, b) => a - b);
  const economyRows = Array.from(new Set(economySeats.map((s) => s.row))).sort((a, b) => a - b);

  const renderRow = (row: number) => {
    const rowSeats = seats.filter((s) => s.row === row).sort((a, b) => a.col.localeCompare(b.col));
    return (
      <div key={row} className="flex items-center gap-1 mb-1">
        <span className="w-6 text-xs text-gray-500 text-center shrink-0">{row}</span>
        {rowSeats.slice(0, 3).map((seat) => (
          <button
            key={seat.id}
            type="button"
            onClick={() => handleSeatClick(seat)}
            disabled={seat.status === 'occupied' || (seat.upgradeRequired && !upgraded)}
            aria-label={`${t.row} ${seat.row} ${seat.col} - ${seat.type}`}
            aria-pressed={seat.status === 'selected'}
            className={`w-8 h-8 rounded border text-xs font-medium transition-colors ${getSeatColor(seat)}`}
          >
            {seat.col}
          </button>
        ))}
        <div className="w-6" />
        {rowSeats.slice(3).map((seat) => (
          <button
            key={seat.id}
            type="button"
            onClick={() => handleSeatClick(seat)}
            disabled={seat.status === 'occupied' || (seat.upgradeRequired && !upgraded)}
            aria-label={`${t.row} ${seat.row} ${seat.col} - ${seat.type}`}
            aria-pressed={seat.status === 'selected'}
            className={`w-8 h-8 rounded border text-xs font-medium transition-colors ${getSeatColor(seat)}`}
          >
            {seat.col}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{t.heading}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Seat Map */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">{t.seatMapHeading}</h2>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-6 text-xs">
              <span className="font-semibold text-gray-700">{t.legend}:</span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded bg-green-200 border border-green-500" />
                {t.window}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded bg-blue-200 border border-blue-500" />
                {t.aisle}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded bg-purple-200 border border-purple-500" />
                {t.middle}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded bg-yellow-300 border border-yellow-600" />
                {t.business}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded bg-blue-600 border border-blue-800" />
                {t.selected}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded bg-gray-400 border border-gray-500" />
                {t.occupied}
              </span>
            </div>

            {/* Business Class */}
            <div className="mb-4">
              <div className="text-sm font-semibold text-yellow-700 mb-2 uppercase tracking-wide">
                {t.business}
              </div>
              {businessRows.map(renderRow)}
            </div>

            <div className="border-t border-dashed border-gray-300 my-4" />

            {/* Economy Class */}
            <div>
              <div className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                {t.economy}
              </div>
              {economyRows.map(renderRow)}
            </div>
          </div>

          {/* Right: Panel */}
          <div className="flex flex-col gap-4">
            {/* Loyalty Balance */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-base font-semibold text-gray-700 mb-2">{t.loyaltyBalance}</h3>
              {loyaltyLoading ? (
                <p className="text-sm text-gray-500">{t.loadingBalance}</p>
              ) : loyaltyError ? (
                <p className="text-sm text-red-500">{t.balanceError}</p>
              ) : (
                <div>
                  <p className="text-2xl font-bold text-blue-700">
                    {balance.toLocaleString()} <span className="text-sm font-normal">{t.miles}</span>
                  </p>
                  {tier && (
                    <p className="text-sm text-gray-500 mt-1">
                      {t.tier}: <span className="font-medium capitalize">{tier}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Upgrade Section */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-base font-semibold text-gray-700 mb-1">{t.upgradeSection}</h3>
              <p className="text-sm text-gray-500 mb-3">{t.upgradeDesc}</p>
              <p className="text-sm text-gray-700 mb-3">
                {t.milesRequired}:{' '}
                <span className="font-bold text-yellow-700">
                  {UPGRADE_MILES_COST.toLocaleString()} {t.miles}
                </span>
              </p>
              {upgraded ? (
                <p className="text-sm text-green-600 font-medium">{t.upgradeSuccess}</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleRedeemMiles}
                    disabled={isRedeeming || loyaltyLoading || balance < UPGRADE_MILES_COST}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    {isRedeeming ? t.redeeming : t.redeemUpgrade}
                  </button>
                  {balance < UPGRADE_MILES_COST && !loyaltyLoading && (
                    <p className="text-xs text-gray-400 mt-1">
                      {language === 'ar'
                        ? `تحتاج إلى ${(UPGRADE_MILES_COST - balance).toLocaleString()} ميل إضافي`
                        : `You need ${(UPGRADE_MILES_COST - balance).toLocaleString()} more miles`}
                    </p>
                  )}
                </>
              )}
              {(upgradeMessage || redeemError) && (
                <p
                  className={`text-sm mt-2 ${
                    upgraded ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {upgradeMessage ?? redeemError}
                </p>
              )}
            </div>

            {/* Selected Seat Info */}
            {selectedSeat && (
              <div className="bg-blue-50 rounded-xl shadow p-5 border border-blue-200">
                <h3 className="text-base font-semibold text-blue-800 mb-2">{t.selectedSeat}</h3>
                <p className="text-sm text-gray-700">
                  {t.row}: <span className="font-medium">{selectedSeat.row}</span>
                </p>
                <p className="text-sm text-gray-700">
                  {t.seatPreference}:{' '}
                  <span className="font-medium capitalize">
                    {t[selectedSeat.type as keyof typeof t] ?? selectedSeat.type}
                  </span>
                </p>
                <p className="text-sm text-gray-700">
                  {selectedSeat.cabin === 'business' ? t.business : t.economy}
                </p>
              </div>
            )}

            {/* Payment Method */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-base font-semibold text-gray-700 mb-3">{t.paymentMethod}</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{t.payWithCard}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="miles"
                    checked={paymentMethod === 'miles'}
                    onChange={() => setPaymentMethod('miles')}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{t.payWithMiles}</span>
                </label>
              </div>
            </div>

            {/* Confirm Button */}
            <div>
              {!selectedSeat && (
                <p className="text-sm text-amber-600 mb-2">{t.noSeatSelected}</p>
              )}
              {!selectedFlightId && (
                <p className="text-sm text-red-500 mb-2">{t.noFlightSelected}</p>
              )}
              <button
                type="button"
                onClick={handleConfirmSelection}
                disabled={!selectedSeat || !selectedFlightId || isConfirming}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors text-base"
              >
                {isConfirming ? t.confirming : t.confirmSelection}
              </button>
              {bookingMessage && (
                <p
                  className={`text-sm mt-2 text-center ${
                    bookingMessage === t.bookingSuccess ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {bookingMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatSelection;
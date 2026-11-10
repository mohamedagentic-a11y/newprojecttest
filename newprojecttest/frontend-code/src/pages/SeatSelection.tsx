import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLanguage } from '../i18n/LanguageContext';
import type { RootState, AppDispatch } from '../store/store';
import { fetchSeatMap } from '../store/flightSlice';
import { fetchLoyaltyBalance, redeemMilesThunk, loyaltySlice } from '../store/loyaltySlice';
import type { RedeemMilesPayload } from '../store/loyaltySlice';
import SeatGrid from '../components/SeatGrid';

const { clearRedemptionStatus } = loyaltySlice.actions;

const strings = {
  en: {
    pageTitle: 'Seat Selection & Upgrades',
    heading: 'Seat Selection & Upgrades',
    subheading: 'Select your preferred seat and explore upgrade options',
    cabinUpgrades: 'Cabin Upgrade Options',
    currentCabin: 'Current Cabin',
    upgradeTo: 'Upgrade To',
    economy: 'Economy',
    business: 'Business',
    firstClass: 'First Class',
    premiumEconomy: 'Premium Economy',
    milesRedemption: 'Miles Redemption',
    milesBalance: 'Your Miles Balance',
    milesRequired: 'Miles Required',
    milesInput: 'Miles to Redeem',
    redeemMiles: 'Redeem Miles',
    budgetInput: 'Budget (Optional)',
    budgetPlaceholder: 'Enter max budget',
    availabilityLegend: 'Seat Availability',
    available: 'Available',
    occupied: 'Occupied',
    locked: 'Locked',
    selected: 'Your Selection',
    window: 'Window',
    middle: 'Middle',
    aisle: 'Aisle',
    confirmSelection: 'Confirm Selection',
    noFlightSelected: 'No flight selected. Please search for a flight first.',
    goBack: 'Go Back to Search',
    loadingSeats: 'Loading seat map…',
    seatMapError: 'Failed to load seat map.',
    noSeatSelected: 'Please select a seat to continue.',
    selectedSeat: 'Selected Seat',
    priceSummary: 'Price Summary',
    baseFare: 'Base Fare',
    upgradePrice: 'Upgrade Price',
    milesDiscount: 'Miles Discount',
    totalPrice: 'Total Price',
    currency: 'SAR',
    redemptionSuccess: 'Miles redeemed successfully!',
    redemptionFailed: 'Redemption failed. Please try again.',
    insufficientMiles: 'Insufficient miles balance.',
    tierIneligible: 'Your tier is not eligible for this redemption.',
    upgradeOption: 'Upgrade Option',
    selectUpgrade: 'Select Upgrade',
    noUpgradeSelected: 'No upgrade selected',
    milesOnly: 'Miles Only',
    cashOnly: 'Cash Only',
    paymentMethod: 'Payment Method',
    upgradeConfirm: 'Apply Upgrade',
    seatPositionLabel: 'Position',
    rowLabel: 'Row',
    classLabel: 'Class',
    loading: 'Loading…',
    loyaltyError: 'Failed to load loyalty data.',
    na: 'N/A',
  },
  ar: {
    pageTitle: 'اختيار المقعد والترقيات',
    heading: 'اختيار المقعد والترقيات',
    subheading: 'اختر مقعدك المفضل واستكشف خيارات الترقية',
    cabinUpgrades: 'خيارات ترقية الدرجة',
    currentCabin: 'الدرجة الحالية',
    upgradeTo: 'الترقية إلى',
    economy: 'الدرجة الاقتصادية',
    business: 'درجة رجال الأعمال',
    firstClass: 'الدرجة الأولى',
    premiumEconomy: 'الاقتصادية المميزة',
    milesRedemption: 'استبدال الأميال',
    milesBalance: 'رصيد أميالك',
    milesRequired: 'الأميال المطلوبة',
    milesInput: 'الأميال المراد استبدالها',
    redeemMiles: 'استبدال الأميال',
    budgetInput: 'الميزانية (اختياري)',
    budgetPlaceholder: 'أدخل الحد الأقصى للميزانية',
    availabilityLegend: 'توافر المقاعد',
    available: 'متاح',
    occupied: 'مشغول',
    locked: 'محجوز',
    selected: 'اختيارك',
    window: 'نافذة',
    middle: 'وسط',
    aisle: 'ممر',
    confirmSelection: 'تأكيد الاختيار',
    noFlightSelected: 'لم يتم اختيار رحلة. يرجى البحث عن رحلة أولاً.',
    goBack: 'العودة إلى البحث',
    loadingSeats: 'جارٍ تحميل خريطة المقاعد…',
    seatMapError: 'فشل تحميل خريطة المقاعد.',
    noSeatSelected: 'يرجى اختيار مقعد للمتابعة.',
    selectedSeat: 'المقعد المختار',
    priceSummary: 'ملخص السعر',
    baseFare: 'السعر الأساسي',
    upgradePrice: 'سعر الترقية',
    milesDiscount: 'خصم الأميال',
    totalPrice: 'السعر الإجمالي',
    currency: 'ريال',
    redemptionSuccess: 'تم استبدال الأميال بنجاح!',
    redemptionFailed: 'فشل الاستبدال. يرجى المحاولة مجدداً.',
    insufficientMiles: 'رصيد الأميال غير كافٍ.',
    tierIneligible: 'مستواك غير مؤهل لهذا الاستبدال.',
    upgradeOption: 'خيار الترقية',
    selectUpgrade: 'اختر الترقية',
    noUpgradeSelected: 'لم يتم اختيار ترقية',
    milesOnly: 'أميال فقط',
    cashOnly: 'نقداً فقط',
    paymentMethod: 'طريقة الدفع',
    upgradeConfirm: 'تطبيق الترقية',
    seatPositionLabel: 'الموضع',
    rowLabel: 'الصف',
    classLabel: 'الدرجة',
    loading: 'جارٍ التحميل…',
    loyaltyError: 'فشل تحميل بيانات الولاء.',
    na: 'غير متاح',
  },
};

const cabinClasses = ['economy', 'premiumEconomy', 'business', 'firstClass'] as const;
type CabinKey = typeof cabinClasses[number];

const cabinUpgradePrices: Record<CabinKey, number> = {
  economy: 0,
  premiumEconomy: 500,
  business: 1500,
  firstClass: 3000,
};

const cabinUpgradeMiles: Record<CabinKey, number> = {
  economy: 0,
  premiumEconomy: 5000,
  business: 15000,
  firstClass: 30000,
};

function cabinKeyFromString(cabin: string): CabinKey {
  const map: Record<string, CabinKey> = {
    economy: 'economy',
    Economy: 'economy',
    ECONOMY: 'economy',
    'premium economy': 'premiumEconomy',
    'Premium Economy': 'premiumEconomy',
    premiumEconomy: 'premiumEconomy',
    business: 'business',
    Business: 'business',
    BUSINESS: 'business',
    first: 'firstClass',
    'first class': 'firstClass',
    firstClass: 'firstClass',
    'First Class': 'firstClass',
  };
  return map[cabin] ?? 'economy';
}

export function SeatSelection() {
  const { lang } = useLanguage();
  const t = strings[lang as 'en' | 'ar'] ?? strings.en;
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const selectedFlight = useSelector((s: RootState) => s.flight.selectedFlight);
  const seatMap = useSelector((s: RootState) => s.flight.seatMap);
  const seatMapLoading = useSelector((s: RootState) => s.flight.seatMapLoading);
  const seatMapError = useSelector((s: RootState) => s.flight.seatMapError);
  const selectedSeat = useSelector((s: RootState) => s.flight.selectedSeat);

  const milesBalance = useSelector((s: RootState) => s.loyalty.milesBalance);
  const tierStatus = useSelector((s: RootState) => s.loyalty.tierStatus);
  const loyaltyLoading = useSelector((s: RootState) => s.loyalty.loading);
  const loyaltyError = useSelector((s: RootState) => s.loyalty.error);
  const redemptionStatus = useSelector((s: RootState) => s.loyalty.redemptionStatus);
  const redemptionError = useSelector((s: RootState) => s.loyalty.redemptionError);

  const currentCabinKey: CabinKey = selectedFlight
    ? cabinKeyFromString(selectedFlight.cabinClass)
    : 'economy';

  const [selectedUpgrade, setSelectedUpgrade] = useState<CabinKey | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'miles' | 'cash'>('cash');
  const [milesInput, setMilesInput] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [upgradeApplied, setUpgradeApplied] = useState(false);

  useEffect(() => {
    if (selectedFlight) {
      dispatch(fetchSeatMap({ flightId: selectedFlight.id, cabinClass: selectedFlight.cabinClass }));
    }
  }, [dispatch, selectedFlight]);

  useEffect(() => {
    dispatch(fetchLoyaltyBalance());
  }, [dispatch]);

  useEffect(() => {
    if (redemptionStatus === 'succeeded') {
      setUpgradeApplied(true);
      setTimeout(() => dispatch(clearRedemptionStatus()), 4000);
    }
  }, [redemptionStatus, dispatch]);

  const handleConfirmSelection = useCallback(() => {
    if (!selectedSeat) return;
    navigate('/booking');
  }, [selectedSeat, navigate]);

  const handleApplyUpgrade = useCallback(() => {
    if (!selectedUpgrade) return;
    const requiredMiles = cabinUpgradeMiles[selectedUpgrade];
    if (paymentMethod === 'miles') {
      if (milesBalance === null || milesBalance < requiredMiles) return;
      const payload: RedeemMilesPayload = { amount: requiredMiles, serviceType: 'upgrade' };
      dispatch(redeemMilesThunk(payload));
    } else {
      setUpgradeApplied(true);
    }
  }, [selectedUpgrade, paymentMethod, milesBalance, dispatch]);

  const eligibleUpgrades = cabinClasses.filter((c) => {
    const currentIdx = cabinClasses.indexOf(currentCabinKey);
    const upgradeIdx = cabinClasses.indexOf(c);
    return upgradeIdx > currentIdx;
  });

  const baseFare = selectedFlight?.price ?? 0;
  const upgradePrice = selectedUpgrade ? cabinUpgradePrices[selectedUpgrade] : 0;
  const milesDiscount =
    upgradeApplied && paymentMethod === 'miles' && selectedUpgrade
      ? cabinUpgradePrices[selectedUpgrade]
      : 0;
  const totalPrice = baseFare + upgradePrice - milesDiscount;

  const canConfirm = !!selectedSeat;

  const canApplyUpgrade =
    !!selectedUpgrade &&
    !upgradeApplied &&
    redemptionStatus !== 'pending' &&
    (paymentMethod === 'cash' ||
      (paymentMethod === 'miles' &&
        milesBalance !== null &&
        milesBalance >= cabinUpgradeMiles[selectedUpgrade]));

  const insufficientMiles =
    paymentMethod === 'miles' &&
    selectedUpgrade &&
    milesBalance !== null &&
    milesBalance < cabinUpgradeMiles[selectedUpgrade];

  // Build SeatGrid-compatible data from seatMap
  const seatGridSections = seatMap
    ? [
        {
          cabinClass: seatMap.cabinClass as unknown as Parameters<typeof SeatGrid>[0] extends { sections: Array<{ cabinClass: infer C }> } ? C : string,
          seats: seatMap.seats.map((s) => ({
            id: s.seatNumber,
            row: s.row,
            column: s.column,
            status: s.status as unknown as Parameters<typeof SeatGrid>[0] extends { sections: Array<{ seats: Array<{ status: infer S }> }> } ? S : string,
            cabinClass: seatMap.cabinClass as unknown as Parameters<typeof SeatGrid>[0] extends { sections: Array<{ cabinClass: infer C }> } ? C : string,
            price: selectedFlight?.price ?? 0,
            currency: selectedFlight?.currency ?? 'SAR',
          })),
          rows: Array.from({ length: seatMap.totalRows }, (_, i) => i + 1),
          columns: seatMap.columns,
        },
      ]
    : [];

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t.heading}</h1>
          <p className="mt-2 text-gray-500">{t.subheading}</p>
        </div>

        {/* No flight selected */}
        {!selectedFlight && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 mb-4">{t.noFlightSelected}</p>
            <button
              onClick={() => navigate('/search')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {t.goBack}
            </button>
          </div>
        )}

        {selectedFlight && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column: Seat Map */}
            <div className="lg:col-span-2 space-y-6">
              {/* Flight summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                  <span className="font-semibold">{selectedFlight.airline} {selectedFlight.flightNumber}</span>
                  <span>{selectedFlight.origin} → {selectedFlight.destination}</span>
                  <span>{selectedFlight.departureDate} · {selectedFlight.departureTime}</span>
                  <span className="capitalize">{t[currentCabinKey] ?? selectedFlight.cabinClass}</span>
                </div>
              </div>

              {/* Availability Legend */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">{t.availabilityLegend}</h2>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-green-400" />
                    <span>{t.available}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-gray-400" />
                    <span>{t.occupied}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-orange-400" />
                    <span>{t.locked}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-blue-500" />
                    <span>{t.selected}</span>
                  </div>
                </div>
              </div>

              {/* Seat Map */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                {seatMapLoading && (
                  <div className="flex items-center justify-center py-16 text-gray-400">
                    {t.loadingSeats}
                  </div>
                )}
                {seatMapError && !seatMapLoading && (
                  <div className="flex items-center justify-center py-16 text-red-500">
                    {t.seatMapError}
                  </div>
                )}
                {!seatMapLoading && !seatMapError && seatMap && (
                  <SeatGrid sections={seatGridSections as any} />
                )}
              </div>

              {/* Selected Seat Info */}
              {selectedSeat && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
                  <span className="font-semibold">{t.selectedSeat}: </span>
                  <span>{selectedSeat}</span>
                </div>
              )}
            </div>

            {/* Right column: Upgrades & Pricing */}
            <div className="space-y-6">
              {/* Cabin Upgrades */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">{t.cabinUpgrades}</h2>

                <div className="mb-3 text-sm text-gray-500">
                  <span className="font-medium">{t.currentCabin}: </span>
                  <span className="capitalize">{t[currentCabinKey] ?? selectedFlight.cabinClass}</span>
                </div>

                {eligibleUpgrades.length === 0 ? (
                  <p className="text-sm text-gray-400">{t.firstClass}</p>
                ) : (
                  <div className="space-y-3">
                    {eligibleUpgrades.map((cabin) => (
                      <button
                        key={cabin}
                        onClick={() => {
                          setSelectedUpgrade(cabin);
                          setUpgradeApplied(false);
                          dispatch(clearRedemptionStatus());
                        }}
                        disabled={upgradeApplied}
                        className={`w-full text-start px-4 py-3 rounded-lg border transition-colors ${
                          selectedUpgrade === cabin
                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        } ${upgradeApplied ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="font-medium text-sm">{t.upgradeTo}: {t[cabin]}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {cabinUpgradePrices[cabin]} {t.currency} · {cabinUpgradeMiles[cabin].toLocaleString()} {t.milesInput}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedUpgrade && !upgradeApplied && (
                  <div className="mt-4 space-y-3">
                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.paymentMethod}</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPaymentMethod('cash')}
                          className={`flex-1 text-sm py-2 rounded-md border transition-colors ${
                            paymentMethod === 'cash'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {t.cashOnly}
                        </button>
                        <button
                          onClick={() => setPaymentMethod('miles')}
                          className={`flex-1 text-sm py-2 rounded-md border transition-colors ${
                            paymentMethod === 'miles'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {t.milesOnly}
                        </button>
                      </div>
                    </div>

                    {/* Miles input */}
                    {paymentMethod === 'miles' && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          {t.milesBalance}:{' '}
                          {loyaltyLoading
                            ? t.loading
                            : milesBalance !== null
                            ? milesBalance.toLocaleString()
                            : t.na}
                        </label>
                        <div className="text-xs text-gray-500 mb-1">
                          {t.milesRequired}: {selectedUpgrade ? cabinUpgradeMiles[selectedUpgrade].toLocaleString() : 0}
                        </div>
                        {insufficientMiles && (
                          <p className="text-xs text-red-500 mb-1">{t.insufficientMiles}</p>
                        )}
                      </div>
                    )}

                    {/* Budget */}
                    {paymentMethod === 'cash' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.budgetInput}</label>
                        <input
                          type="number"
                          min={0}
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          placeholder={t.budgetPlaceholder}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    )}

                    {/* Loyalty error */}
                    {loyaltyError && (
                      <p className="text-xs text-red-500">{t.loyaltyError}</p>
                    )}

                    {/* Apply Upgrade */}
                    <button
                      onClick={handleApplyUpgrade}
                      disabled={!canApplyUpgrade}
                      className={`w-full py-2 rounded-md text-sm font-semibold transition-colors ${
                        canApplyUpgrade
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {redemptionStatus === 'pending' ? t.loading : t.upgradeConfirm}
                    </button>
                  </div>
                )}

                {/* Redemption feedback */}
                {redemptionStatus === 'succeeded' && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                    {t.redemptionSuccess}
                  </div>
                )}
                {redemptionStatus === 'failed' && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {redemptionError ?? t.redemptionFailed}
                  </div>
                )}
                {upgradeApplied && redemptionStatus !== 'succeeded' && redemptionStatus !== 'failed' && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                    {t.redemptionSuccess}
                  </div>
                )}
              </div>

              {/* Miles Redemption summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">{t.milesRedemption}</h2>
                <div className="text-sm space-y-2 text-gray-700">
                  <div className="flex justify-between">
                    <span>{t.milesBalance}</span>
                    <span>
                      {loyaltyLoading
                        ? t.loading
                        : milesBalance !== null
                        ? milesBalance.toLocaleString()
                        : t.na}
                    </span>
                  </div>
                  {tierStatus && (
                    <div className="flex justify-between">
                      <span>Tier</span>
                      <span className="capitalize">{tierStatus}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">{t.priceSummary}</h2>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>{t.baseFare}</span>
                    <span>{baseFare.toLocaleString()} {selectedFlight.currency}</span>
                  </div>
                  {upgradePrice > 0 && (
                    <div className="flex justify-between">
                      <span>{t.upgradePrice}</span>
                      <span>+{upgradePrice.toLocaleString()} {selectedFlight.currency}</span>
                    </div>
                  )}
                  {milesDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{t.milesDiscount}</span>
                      <span>-{milesDiscount.toLocaleString()} {selectedFlight.currency}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-900">
                    <span>{t.totalPrice}</span>
                    <span>{totalPrice.toLocaleString()} {selectedFlight.currency}</span>
                  </div>
                </div>
              </div>

              {/* Confirm Selection */}
              <div>
                {!selectedSeat && (
                  <p className="text-sm text-amber-600 mb-2 text-center">{t.noSeatSelected}</p>
                )}
                <button
                  onClick={handleConfirmSelection}
                  disabled={!canConfirm}
                  className={`w-full py-3 rounded-xl text-base font-bold transition-colors ${
                    canConfirm
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {t.confirmSelection}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SeatSelection;
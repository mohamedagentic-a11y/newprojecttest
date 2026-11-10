import React, { useState, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SeatStatus = 'available' | 'occupied' | 'selected' | 'locking';
export type CabinClass = 'First' | 'Business' | 'Economy';

export interface Seat {
  id: string;
  row: number;
  column: string;
  status: SeatStatus;
  cabinClass: CabinClass;
  price: number;
  currency: string;
}

export interface CabinSection {
  cabinClass: CabinClass;
  seats: Seat[];
  rows: number[];
  columns: string[];
}

interface SeatGridProps {
  sections: CabinSection[];
  onSeatSelect?: (seat: Seat) => void;
  onSeatDeselect?: (seatId: string) => void;
  selectedSeatIds?: string[];
  lockedSeatIds?: string[];
  currencyCode?: string;
}

// ─── Bilingual strings ────────────────────────────────────────────────────────

const strings = {
  en: {
    cabinLabels: {
      First: 'First Class',
      Business: 'Business Class',
      Economy: 'Economy Class',
    },
    legend: {
      available: 'Available',
      occupied: 'Occupied',
      selected: 'Selected',
      locking: 'Being Selected',
    },
    seatLabel: (row: number, col: string) => `Seat ${row}${col}`,
    priceLabel: (price: number, currency: string) =>
      `${currency} ${price.toLocaleString('en-US')}`,
    lockingFeedback: 'Another passenger is selecting this seat. Please choose another.',
    selectedFeedback: (seatId: string) => `Seat ${seatId} selected.`,
    noSeatsAvailable: 'No seats available for this section.',
    seatAriaLabel: (row: number, col: string, status: SeatStatus, price: number, currency: string) =>
      `Row ${row}, Column ${col}. Status: ${status}. Price: ${currency} ${price}`,
    exitRow: 'Exit Row',
    priceFrom: 'From',
  },
  ar: {
    cabinLabels: {
      First: 'الدرجة الأولى',
      Business: 'درجة رجال الأعمال',
      Economy: 'الدرجة الاقتصادية',
    },
    legend: {
      available: 'متاح',
      occupied: 'محجوز',
      selected: 'محدد',
      locking: 'قيد الاختيار',
    },
    seatLabel: (row: number, col: string) => `مقعد ${row}${col}`,
    priceLabel: (price: number, currency: string) =>
      `${price.toLocaleString('ar-SA')} ${currency}`,
    lockingFeedback: 'راكب آخر يختار هذا المقعد. يرجى اختيار مقعد آخر.',
    selectedFeedback: (seatId: string) => `تم اختيار المقعد ${seatId}.`,
    noSeatsAvailable: 'لا توجد مقاعد متاحة لهذا القسم.',
    seatAriaLabel: (row: number, col: string, status: SeatStatus, price: number, currency: string) =>
      `الصف ${row}، العمود ${col}. الحالة: ${status}. السعر: ${price} ${currency}`,
    exitRow: 'صف المخرج',
    priceFrom: 'ابتداءً من',
  },
};

// ─── Seat colour mappings ─────────────────────────────────────────────────────

const seatStatusClass: Record<SeatStatus, string> = {
  available:
    'bg-emerald-100 border-emerald-400 text-emerald-800 hover:bg-emerald-300 cursor-pointer',
  occupied:
    'bg-slate-200 border-slate-400 text-slate-500 cursor-not-allowed opacity-60',
  selected:
    'bg-blue-500 border-blue-700 text-white cursor-pointer ring-2 ring-blue-400',
  locking:
    'bg-amber-100 border-amber-400 text-amber-800 cursor-not-allowed animate-pulse',
};

const cabinHeaderClass: Record<CabinClass, string> = {
  First: 'bg-amber-50 border-amber-300 text-amber-800',
  Business: 'bg-indigo-50 border-indigo-300 text-indigo-800',
  Economy: 'bg-slate-50 border-slate-300 text-slate-800',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LegendProps {
  t: typeof strings['en'];
}

const Legend: React.FC<LegendProps> = ({ t }) => (
  <div className="flex flex-wrap gap-4 mb-6 justify-center">
    {(Object.entries(t.legend) as [SeatStatus, string][]).map(([status, label]) => (
      <div key={status} className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded border-2 ${seatStatusClass[status].split(' ').slice(0, 2).join(' ')}`}
        />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
    ))}
  </div>
);

interface SeatButtonProps {
  seat: Seat;
  isSelected: boolean;
  isLocking: boolean;
  onClick: (seat: Seat) => void;
  t: typeof strings['en'];
}

const SeatButton: React.FC<SeatButtonProps> = ({ seat, isSelected, isLocking, onClick, t }) => {
  const effectiveStatus: SeatStatus = isLocking
    ? 'locking'
    : isSelected
    ? 'selected'
    : seat.status;

  const disabled = effectiveStatus === 'occupied' || effectiveStatus === 'locking';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onClick(seat)}
      aria-label={t.seatAriaLabel(seat.row, seat.column, effectiveStatus, seat.price, seat.currency)}
      aria-pressed={isSelected}
      className={`
        w-10 h-10 rounded border-2 text-xs font-semibold
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400
        ${seatStatusClass[effectiveStatus]}
      `}
    >
      {seat.row}{seat.column}
    </button>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const SeatGrid: React.FC<SeatGridProps> = ({
  sections,
  onSeatSelect,
  onSeatDeselect,
  selectedSeatIds = [],
  lockedSeatIds = [],
  currencyCode = 'SAR',
}) => {
  const { lang } = useLanguage();
  const t = strings[lang as keyof typeof strings] ?? strings.en;

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleSeatClick = useCallback(
    (seat: Seat) => {
      if (seat.status === 'occupied') return;

      if (lockedSeatIds.includes(seat.id)) {
        showToast(t.lockingFeedback);
        return;
      }

      if (selectedSeatIds.includes(seat.id)) {
        onSeatDeselect?.(seat.id);
      } else {
        onSeatSelect?.(seat);
        showToast(t.selectedFeedback(seat.row + seat.column));
      }
    },
    [lockedSeatIds, selectedSeatIds, onSeatSelect, onSeatDeselect, showToast, t]
  );

  const getMinPrice = (seats: Seat[]) => {
    const available = seats.filter(s => s.status === 'available');
    if (available.length === 0) return null;
    return Math.min(...available.map(s => s.price));
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto px-4">
      {/* Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 inset-x-0 mx-auto w-fit z-50 bg-slate-800 text-white text-sm px-5 py-3 rounded-lg shadow-lg transition-all"
        >
          {toastMessage}
        </div>
      )}

      {/* Legend */}
      <Legend t={t} />

      {/* Cabin Sections */}
      <div className="space-y-10">
        {sections.map((section) => {
          const minPrice = getMinPrice(section.seats);

          return (
            <section
              key={section.cabinClass}
              aria-labelledby={`cabin-${section.cabinClass}`}
              className={`border-2 rounded-xl overflow-hidden ${cabinHeaderClass[section.cabinClass]}`}
            >
              {/* Section header */}
              <div className={`flex items-center justify-between px-5 py-3 border-b-2 ${cabinHeaderClass[section.cabinClass]}`}>
                <h2
                  id={`cabin-${section.cabinClass}`}
                  className="text-base font-bold"
                >
                  {t.cabinLabels[section.cabinClass]}
                </h2>
                {minPrice !== null && (
                  <span className="text-sm font-medium">
                    {t.priceFrom}{' '}
                    {t.priceLabel(minPrice, currencyCode)}
                  </span>
                )}
              </div>

              {/* Seat grid body */}
              <div className="bg-white px-6 py-6">
                {section.seats.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-4">
                    {t.noSeatsAvailable}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Column header row */}
                    <div
                      className="flex items-center mb-3"
                      aria-hidden="true"
                    >
                      {/* Row number placeholder */}
                      <div className="w-8 shrink-0" />
                      {section.columns.map((col) => (
                        <div
                          key={col}
                          className="w-10 mx-1 text-center text-xs font-semibold text-slate-400 uppercase"
                        >
                          {col}
                        </div>
                      ))}
                    </div>

                    {/* Rows */}
                    {section.rows.map((rowNum) => {
                      const rowSeats = section.seats.filter(s => s.row === rowNum);
                      return (
                        <div
                          key={rowNum}
                          className="flex items-center mb-2"
                        >
                          {/* Row number */}
                          <div
                            className="w-8 shrink-0 text-center text-xs text-slate-400 font-medium"
                            aria-hidden="true"
                          >
                            {rowNum}
                          </div>

                          {/* Seats in this row, ordered by column */}
                          {section.columns.map((col) => {
                            const seat = rowSeats.find(s => s.column === col);
                            if (!seat) {
                              // Aisle gap
                              return (
                                <div
                                  key={`${rowNum}-${col}-empty`}
                                  className="w-10 mx-1"
                                  aria-hidden="true"
                                />
                              );
                            }
                            return (
                              <div key={seat.id} className="mx-1">
                                <SeatButton
                                  seat={seat}
                                  isSelected={selectedSeatIds.includes(seat.id)}
                                  isLocking={lockedSeatIds.includes(seat.id)}
                                  onClick={handleSeatClick}
                                  t={t}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default SeatGrid;
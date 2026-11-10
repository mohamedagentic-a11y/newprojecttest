import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export interface FlightData {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  status: 'on-time' | 'delayed' | 'cancelled' | 'boarding' | 'departed' | 'arrived';
  cabinClass?: string;
  duration?: string;
  originCity?: string;
  destinationCity?: string;
}

interface FlightCardProps {
  flight: FlightData;
  onClick?: (flight: FlightData) => void;
  selected?: boolean;
}

const strings = {
  en: {
    flightNumber: 'Flight',
    departure: 'Departure',
    arrival: 'Arrival',
    duration: 'Duration',
    cabinClass: 'Class',
    status: {
      'on-time': 'On Time',
      delayed: 'Delayed',
      cancelled: 'Cancelled',
      boarding: 'Boarding',
      departed: 'Departed',
      arrived: 'Arrived',
    },
    selectFlight: 'Select Flight',
  },
  ar: {
    flightNumber: 'رحلة',
    departure: 'المغادرة',
    arrival: 'الوصول',
    duration: 'المدة',
    cabinClass: 'الدرجة',
    status: {
      'on-time': 'في الموعد',
      delayed: 'متأخر',
      cancelled: 'ملغى',
      boarding: 'جارٍ الصعود',
      departed: 'غادر',
      arrived: 'وصل',
    },
    selectFlight: 'اختر الرحلة',
  },
};

const statusColors: Record<FlightData['status'], string> = {
  'on-time': 'bg-green-100 text-green-800',
  delayed: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  boarding: 'bg-blue-100 text-blue-800',
  departed: 'bg-gray-100 text-gray-800',
  arrived: 'bg-indigo-100 text-indigo-800',
};

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function FlightCard({ flight, onClick, selected = false }: FlightCardProps): JSX.Element {
  const { lang } = useLanguage();
  const t = strings[lang as 'en' | 'ar'] ?? strings.en;

  const handleClick = () => {
    if (onClick) {
      onClick(flight);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(flight);
    }
  };

  return (
    <div
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={[
        'rounded-xl border bg-white shadow-sm transition-all duration-200',
        'p-4 md:p-6',
        onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500' : '',
        selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header row: flight number + status badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {t.flightNumber}
          </span>
          <span className="text-base font-bold text-gray-900">{flight.flightNumber}</span>
          {flight.cabinClass && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-500">{t.cabinClass}:</span>
              <span className="text-xs font-semibold text-gray-700">{flight.cabinClass}</span>
            </>
          )}
        </div>
        <span
          className={[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
            statusColors[flight.status],
          ].join(' ')}
        >
          {t.status[flight.status]}
        </span>
      </div>

      {/* Route row */}
      <div className="flex items-center gap-3">
        {/* Departure */}
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold text-gray-900 leading-none">{flight.origin}</p>
          {flight.originCity && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{flight.originCity}</p>
          )}
          <p className="text-sm font-semibold text-gray-800 mt-1">{formatTime(flight.departureTime)}</p>
          <p className="text-xs text-gray-400">{formatDate(flight.departureTime)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t.departure}</p>
        </div>

        {/* Duration / divider */}
        <div className="flex flex-col items-center flex-shrink-0 px-2">
          {flight.duration && (
            <span className="text-xs text-gray-400 mb-1">{flight.duration}</span>
          )}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full border-2 border-blue-400" />
            <div className="w-12 md:w-20 h-px bg-blue-200" />
            <svg
              className="w-4 h-4 text-blue-500 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </div>
          {flight.duration && (
            <span className="text-xs text-gray-400 mt-1">{t.duration}</span>
          )}
        </div>

        {/* Arrival */}
        <div className="flex-1 min-w-0 text-end">
          <p className="text-2xl font-bold text-gray-900 leading-none">{flight.destination}</p>
          {flight.destinationCity && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{flight.destinationCity}</p>
          )}
          <p className="text-sm font-semibold text-gray-800 mt-1">{formatTime(flight.arrivalTime)}</p>
          <p className="text-xs text-gray-400">{formatDate(flight.arrivalTime)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t.arrival}</p>
        </div>
      </div>
    </div>
  );
}

export default FlightCard;
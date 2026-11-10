import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import FlightSearch from './pages/FlightSearch';
import Rebooking from './pages/Rebooking';
import SeatSelection from './pages/SeatSelection';
import BaggageClaims from './pages/BaggageClaims';
import Navigation from './components/Navigation';
import { ProtectedRoute, AppLayout } from './auth/authGuard';
import { I18nProvider } from './i18n/index';

const LayoutWithNav: React.FC = () => (
  <div className="min-h-screen flex flex-col">
    <Navigation />
    <main className="flex-1">
      <Outlet />
    </main>
  </div>
);

const App: React.FC = () => {
  return (
    <I18nProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<LayoutWithNav />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/flights" element={<FlightSearch />} />
            <Route path="/flight-search" element={<FlightSearch />} />
            <Route path="/rebook" element={<Rebooking />} />
            <Route path="/seats" element={<SeatSelection />} />
            <Route path="/seat-selection" element={<SeatSelection />} />
            <Route path="/baggage" element={<BaggageClaims />} />
            <Route path="/baggage-claims" element={<BaggageClaims />} />
            <Route path="/bookings" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </I18nProvider>
  );
};

export default App;

Wait, the instructions say "PROVIDERS ARE ALREADY MOUNTED in build/frontend-code/src/main.tsx" — so I should NOT mount I18nProvider again here. Let me remove it.

Also I need to check: `AppLayout` is exported from authGuard — let me check if I should use that instead of my own LayoutWithNav. The obligation says "YOU OWN THE LAYOUT THAT HOLDS THE PAGES" and to define it here. I'll define my own layout component here.

import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import FlightSearch from './pages/FlightSearch';
import Rebooking from './pages/Rebooking';
import SeatSelection from './pages/SeatSelection';
import BaggageClaims from './pages/BaggageClaims';
import Navigation from './components/Navigation';
import { ProtectedRoute } from './auth/authGuard';

const AuthenticatedLayout: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-gray-50" dir="auto">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 py-6">
      <Outlet />
    </main>
  </div>
);

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/flights" element={<FlightSearch />} />
          <Route path="/flight-search" element={<FlightSearch />} />
          <Route path="/rebook" element={<Rebooking />} />
          <Route path="/seats" element={<SeatSelection />} />
          <Route path="/seat-selection" element={<SeatSelection />} />
          <Route path="/baggage" element={<BaggageClaims />} />
          <Route path="/baggage-claims" element={<BaggageClaims />} />
          <Route path="/bookings" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
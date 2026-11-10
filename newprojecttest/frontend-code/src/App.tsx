import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import NavBar from './components/NavBar';
import { AuthGuard, ROLES } from './components/AuthGuard';
import { LoginPage } from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import FlightSearch from './pages/FlightSearch';
import { Rebooking } from './pages/Rebooking';
import SeatSelection from './pages/SeatSelection';
import BaggageClaims from './pages/BaggageClaims';

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <NavBar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

const NotFound: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <p className="text-gray-500 text-lg">404 — Page not found</p>
  </div>
);

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected layout routes */}
        <Route
          element={
            <AuthGuard
              allowedRoles={[
                ROLES.CORPORATE_TRAVELER,
                ROLES.LEISURE_PASSENGER,
                ROLES.TRAVEL_OPERATIONS_SPECIALIST,
              ]}
            >
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route index path="/" element={<Dashboard />} />
          <Route path="/flights" element={<FlightSearch />} />
          <Route path="/flights/search" element={<FlightSearch />} />
          <Route path="/search" element={<FlightSearch />} />
          <Route path="/rebook" element={<Rebooking />} />
          <Route path="/seats" element={<SeatSelection />} />
          <Route path="/baggage" element={<BaggageClaims />} />

          {/* Navigation targets declared by other pages */}
          <Route path="/booking" element={<SeatSelection />} />
          <Route path="/bookings" element={<Dashboard />} />
          <Route path="/loyalty" element={<Dashboard />} />
          <Route path="/profile" element={<Dashboard />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </LanguageProvider>
  );
};

export default App;
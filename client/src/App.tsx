import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import BrowsePage from './pages/BrowsePage';
import TimelinePage from './pages/TimelinePage';
import DiscoverPage from './pages/DiscoverPage';
import SplashPage from './pages/SplashPage';

function splashAlreadySeen() {
  return sessionStorage.getItem('chronicle_splash') === '1';
}

/** Routes wrapper — the key on the outer div restarts the fadeIn animation on navigation. */
function AppRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="routeTransition">
      <Routes>
        <Route path="/" element={<BrowsePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/timelines/:slug" element={<TimelinePage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(splashAlreadySeen);

  if (!splashDone) {
    return (
      <SplashPage
        onReady={() => {
          sessionStorage.setItem('chronicle_splash', '1');
          setSplashDone(true);
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import BrowsePage from './pages/BrowsePage';
import TimelinePage from './pages/TimelinePage';
import DiscoverPage from './pages/DiscoverPage';
import SplashPage from './pages/SplashPage';
import { useTimelinePageStore } from './store/useTimelinePageStore';
import styles from './App.module.scss';

function ScrollToTopButton() {
  const [scrolled, setScrolled] = useState(false);
  const selectedEvent = useTimelinePageStore((s) => s.selectedEvent);

  useEffect(() => {
    const check = () => setScrolled(window.scrollY > 300);
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, []);

  const visible = scrolled && !selectedEvent;

  return (
    <button
      className={`${styles.scrollTop} ${visible ? styles.scrollTopVisible : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
    >
      <span className="ti ti-arrow-up" aria-hidden="true" />
    </button>
  );
}

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
      <ScrollToTopButton />
    </BrowserRouter>
  );
}

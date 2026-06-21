import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BrowsePage from './pages/BrowsePage';
import TimelinePage from './pages/TimelinePage';
import DiscoverPage from './pages/DiscoverPage';
import SplashPage from './pages/SplashPage';

function splashAlreadySeen() {
  return sessionStorage.getItem('chronicle_splash') === '1';
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
      <Routes>
        <Route path="/" element={<BrowsePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/timelines/:slug" element={<TimelinePage />} />
      </Routes>
    </BrowserRouter>
  );
}

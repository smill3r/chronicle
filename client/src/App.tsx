import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BrowsePage from './pages/BrowsePage';
import TimelinePage from './pages/TimelinePage';
import DiscoverPage from './pages/DiscoverPage';

export default function App() {
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

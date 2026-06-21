export interface Timeline {
  _id: string;
  title: string;
  slug: string;
  eventCount: number;
  yearStart: number;
  yearEnd: number;
  categories: string[];
  sourceUrl: string;
  tagline?: string;
  description?: string;
  heroImage?: string;
  wikiLink?: string;
}

export interface HistoricalEvent {
  _id: string;
  year: number;
  yearDisplay: string;
  datePrecision: 'year' | 'month' | 'day' | 'circa' | 'range' | 'unknown';
  title: string;
  description: string;
  category: string[];
  location: string[];
  wikiLink: string;
  wikiSummary?: string;
  wikiThumbnail?: string;
  sourceArticle: string;
  sourceUrl: string;
}

export interface PaginatedEvents {
  data: HistoricalEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const CATEGORY_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  'War':           { dot: '#E24B4A', bg: '#F7C1C1', text: '#A32D2D' },
  'Politics':      { dot: '#378ADD', bg: '#B5D4F4', text: '#0C447C' },
  'Science':       { dot: '#1D9E75', bg: '#9FE1CB', text: '#085041' },
  'Religion':      { dot: '#7F77DD', bg: '#CECBF6', text: '#3C3489' },
  'Art & Culture': { dot: '#D85A30', bg: '#F5C4B3', text: '#712B13' },
  'Exploration':   { dot: '#0F6E56', bg: '#E1F5EE', text: '#04342C' },
  'Economics':     { dot: '#BA7517', bg: '#FAC775', text: '#633806' },
  'Law':           { dot: '#534AB7', bg: '#EEEDFE', text: '#26215C' },
  'Philosophy':    { dot: '#534AB7', bg: '#EEEDFE', text: '#26215C' },
  'Technology':    { dot: '#639922', bg: '#C0DD97', text: '#27500A' },
  'Natural Event': { dot: '#0F6E56', bg: '#E1F5EE', text: '#04342C' },
  'Society':       { dot: '#993556', bg: '#FBEAF0', text: '#4B1528' },
};

// Must stay in sync with scraper/prompts/extractEvents.js CATEGORIES constant
export const ALL_CATEGORIES = [
  'War', 'Politics', 'Science', 'Religion', 'Art & Culture',
  'Exploration', 'Economics', 'Law', 'Philosophy', 'Technology',
  'Natural Event', 'Society',
] as const;

export type Category = typeof ALL_CATEGORIES[number];

'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Main Page
   Single-page app with animated tab navigation
   ─────────────────────────────────────────────────────────────── */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext';
import type {
  Section,
  LibraryCountry,
  DashboardData,
  TearsheetData,
  DossierResponse,
  CompareData,
  ChatResponse,
  NewsItem,
} from '@/lib/types';
import {
  fetchLibrary,
  fetchDashboard,
  fetchTearsheet,
  fetchDossier,
  fetchCompare,
  sendChat,
  streamBuild,
  buildDossier,
  fetchNews,
  logUserAction,
} from '@/lib/api';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import DashboardView from '@/components/dashboard/DashboardView';
import LandingPage from '@/components/dashboard/LandingPage';
import CountryProfile from '@/components/profile/CountryProfile';
import ReportGenerator from '@/components/reports/ReportGenerator';
import CompareView from '@/components/compare/CompareView';
import ChatView from '@/components/chat/ChatView';
import AdminPanel from '@/components/admin/AdminPanel';
import DelegationBriefings from '@/components/briefings/DelegationBriefings';

/* ── Page transition variants ──────────────────────────────── */
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -12 },
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.3,
};

/* ── Inner app (needs useLanguage hook) ────────────────────── */
function AppContent() {
  const { lang, t } = useLanguage();

  // Navigation state
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [selectedCountry, setSelectedCountry] = useState(''); // Will auto-select first country with data

  // Library
  const [countries, setCountries] = useState<LibraryCountry[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  // Build progress
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string | null>(null);

  // Dashboard data
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [tearsheetData, setTearsheetData] = useState<TearsheetData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Profile data
  const [dossierData, setDossierData] = useState<DossierResponse | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // Compare data
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Backend connectivity
  const [backendOffline, setBackendOffline] = useState(false);

  // Council & News data
  const [councilData, setCouncilData] = useState<string | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  // ── Fetch library on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLibraryLoading(true);
    fetchLibrary()
      .then((data) => {
        if (!cancelled) {
          setCountries(data);
          setLibraryLoading(false);
          setBackendOffline(data.length === 0); // Empty library means backend is likely down
          // Auto-select first country that has data
          if (data.length > 0) {
            const withData = data.filter(c => c.found > 0);
            if (withData.length > 0) {
              setSelectedCountry(withData[0].country_iso);
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLibraryLoading(false);
          setBackendOffline(true);
        }
      });
    // Fetch news on mount
    fetchNews(6).then((items) => {
      if (!cancelled) setNewsItems(items);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Build dossier handler ─────────────────────────────────
  const handleBuildDossier = useCallback(
    async (country: string) => {
      setBuilding(true);
      setBuildProgress('Starting dossier build…');
      try {
        await streamBuild(
          country,
          (ev) => {
            if (ev.event === 'progress' && ev.message) {
              setBuildProgress(ev.message);
            } else if (ev.event === 'field' && ev.field_name) {
              setBuildProgress(`Gathering: ${ev.field_name}…`);
            } else if (ev.event === 'done') {
              setBuildProgress('Finalizing…');
            } else if (ev.event === 'error') {
              setBuildProgress(`Error: ${ev.error || 'Build failed'}`);
            }
          },
          lang,
        );
        // Log user action
        logUserAction('build_dossier', `Built dossier for ${country}`, country);
        // After build, re-fetch dashboard + tearsheet
        const [dash, tear] = await Promise.all([
          fetchDashboard(country, lang).catch(() => null),
          fetchTearsheet(country, lang).catch(() => null),
        ]);
        setDashboardData(dash);
        setTearsheetData(tear);
        setCouncilData(dash?.data?.council ?? null);
        // Also re-fetch dossier if on profile tab
        if (activeSection === 'profile') {
          try {
            const dossier = await fetchDossier(country);
            setDossierData(dossier);
          } catch {
            setDossierData(null);
          }
        }
      } catch {
        setBuildProgress('Build failed. Try again.');
      } finally {
        setBuilding(false);
        setBuildProgress(null);
      }
    },
    [lang, activeSection],
  );

  // ── Fetch dashboard & tearsheet when country changes ──────
  useEffect(() => {
    if (!selectedCountry) {
      setDashboardData(null);
      setTearsheetData(null);
      setDossierData(null);
      return;
    }

    let cancelled = false;
    setDashboardLoading(true);

    Promise.all([
      fetchDashboard(selectedCountry, lang).catch(() => null),
      fetchTearsheet(selectedCountry, lang).catch(() => null),
    ])
      .then(([dash, tear]) => {
        if (!cancelled) {
          setDashboardData(dash);
          setTearsheetData(tear);
          setCouncilData(dash?.data?.council ?? null);
          setDashboardLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDashboardLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedCountry, lang]);

  // ── Fetch dossier when profile tab is active ──────────────
  useEffect(() => {
    if (activeSection !== 'profile' || !selectedCountry) return;

    let cancelled = false;
    setDossierLoading(true);

    fetchDossier(selectedCountry)
      .then((data) => {
        if (!cancelled) {
          setDossierData(data);
          setDossierLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDossierData(null);
          setDossierLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [activeSection, selectedCountry]);

  // ── Compare handler ───────────────────────────────────────
  const handleCompare = useCallback(
    async (countryList: string[]) => {
      setCompareLoading(true);
      try {
        const data = await fetchCompare(countryList, lang);
        setCompareData(data);
        logUserAction('compare_countries', `Compared ${countryList.join(', ')}`);
      } catch {
        setCompareData(null);
      } finally {
        setCompareLoading(false);
      }
    },
    [lang],
  );

  // ── Chat handler ──────────────────────────────────────────
  const handleSendChat = useCallback(
    async (question: string): Promise<ChatResponse> => {
      const result = await sendChat(question, lang, selectedCountry || undefined);
      logUserAction('chat_question', question, selectedCountry || undefined);
      return result;
    },
    [lang, selectedCountry],
  );

  // ── Section change handler ────────────────────────────────
  const handleSectionChange = useCallback((s: Section) => {
    setActiveSection(s);
    logUserAction('navigate', `Navigated to ${s}`);
  }, []);

  // ── Country change handler ────────────────────────────────
  const handleCountryChange = useCallback((c: string) => {
    setSelectedCountry(c);
    // Reset section-specific data
    setCompareData(null);
    if (c) {
      logUserAction('select_country', `Selected ${c}`, c);
    }
  }, []);

  // ── Field edited handler ──────────────────────────────────
  const handleFieldEdited = useCallback(async () => {
    if (!selectedCountry) return;
    try {
      const dossier = await fetchDossier(selectedCountry);
      setDossierData(dossier);
    } catch {
      // Silently fail
    }
  }, [selectedCountry]);

  // ── Render active section ─────────────────────────────────
  const renderSection = () => {
    // Admin panel doesn't require a country
    if (activeSection === 'admin') {
      return (
        <AdminPanel backendOffline={backendOffline} />
      );
    }

    // When no country is selected, show the landing page only on dashboard tab
    if (!selectedCountry && activeSection === 'dashboard') {
      return (
        <LandingPage
          countries={countries}
          onCountryChange={handleCountryChange}
        />
      );
    }

    // When no country is selected on other tabs, show a placeholder
    if (!selectedCountry) {
      const tabLabels: Record<Section, string> = {
        dashboard: t('nav.dashboard'),
        profile: t('nav.profile'),
        reports: t('nav.reports'),
        compare: t('nav.compare'),
        chat: t('nav.chat'),
        briefings: t('nav.briefings'),
        admin: t('admin.title'),
      };
      return (
        <div className="max-w-screen-xl mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">{tabLabels[activeSection]}</h2>
            <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
              {t('reports.selectCountry', { section: tabLabels[activeSection] })}
            </p>
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case 'dashboard':
        return (
          <DashboardView
            dashboardData={dashboardData}
            tearsheetData={tearsheetData}
            loading={dashboardLoading}
            selectedCountry={selectedCountry}
            countries={countries}
            onBuildDossier={handleBuildDossier}
            building={building}
            buildProgress={buildProgress}
            backendOffline={backendOffline}
            councilData={councilData}
            newsItems={newsItems}
          />
        );
      case 'profile':
        return (
          <CountryProfile
            dossierData={dossierData}
            loading={dossierLoading}
            onFieldEdited={handleFieldEdited}
          />
        );
      case 'reports':
        return (
          <ReportGenerator
            dashboardData={dashboardData}
            tearsheetData={tearsheetData}
            dossierData={dossierData}
            loading={dashboardLoading || dossierLoading}
          />
        );
      case 'compare':
        return (
          <CompareView
            compareData={compareData}
            loading={compareLoading}
            onCompare={handleCompare}
          />
        );
      case 'chat':
        return (
          <ChatView
            onSendChat={handleSendChat}
            loading={false}
            selectedCountry={selectedCountry}
            countryName={countries.find(c => c.country_iso === selectedCountry)?.country_name}
          />
        );
      case 'briefings':
        return (
          <DelegationBriefings
            selectedCountry={selectedCountry}
            countries={countries}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Header
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        selectedCountry={selectedCountry}
        onCountryChange={handleCountryChange}
        countries={countries}
      />

      {/* Main content area with animated transitions */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
          >
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}

/* ── Page wrapper with LanguageProvider ────────────────────── */
export default function Home() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

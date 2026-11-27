import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { BayminiProvider, useBaymini } from './context/BayminiContext';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { HealthPlanView } from './components/health-plan/HealthPlanView';
import { SymptomsView } from './components/symptoms/SymptomsView';
import { DoctorsView } from './components/doctors/DoctorsView';
import { MyBookingsDrawer } from './components/doctors/MyBookingsDrawer';
import { FloatingChatbot } from './components/chatbot/FloatingChatbot';
import { Footer } from './components/Footer';
import { FooterModals, type FooterModalType } from './components/FooterModals';
import { ToastContainer } from './components/ToastContainer';
import { DevAutoTestModal } from './components/DevAutoTestModal';

function BayminiShell() {
  const { activeView, mapsQuotaExceeded, dismissMapsQuotaBanner } = useBaymini();
  const [activeModal, setActiveModal] = useState<FooterModalType>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('test') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (
        event.altKey &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        (event.key.toLowerCase() === 'd' || event.code === 'KeyD')
      ) {
        event.preventDefault();
        setDiagnosticsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="baymini-app-shell min-h-screen flex flex-col bg-bm-bg text-bm-text">
      {/* Case A Demo Key Quota Notice Banner — shown ONLY when Google Maps returns a quota/auth error */}
      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="no-print sticky top-0 z-50 border-b border-bm-prompt/40 bg-bm-surface px-4 py-2.5 text-xs sm:text-sm text-bm-text"
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className="w-4 h-4 text-bm-prompt shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>
                The free Google Maps demo key has reached its daily quota limit. Switch to your own Cloud project API key or try again later.
              </span>
            </div>
            <button
              type="button"
              onClick={dismissMapsQuotaBanner}
              aria-label="Dismiss Maps quota notice"
              className="w-7 h-7 rounded-full hover:bg-bm-tint flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <Navbar />

      <main className="flex-1">
        {activeView === 'home' ? (
          <HomeView />
        ) : activeView === 'health-plan' ? (
          <HealthPlanView />
        ) : activeView === 'symptoms' ? (
          <SymptomsView />
        ) : (
          <DoctorsView />
        )}
      </main>

      <Footer
        onOpenModal={setActiveModal}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
      />

      <FooterModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
      />

      <MyBookingsDrawer />
      <FloatingChatbot />
      <ToastContainer />
      <DevAutoTestModal
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <BayminiProvider>
      <BayminiShell />
    </BayminiProvider>
  );
}

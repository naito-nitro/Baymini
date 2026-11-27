import { useRef } from 'react';
import { useBaymini } from '../context/BayminiContext';
import { BayminiLogo } from './BayminiLogo';
import type { FooterModalType } from './FooterModals';

interface FooterProps {
  onOpenModal: (modal: Exclude<FooterModalType, null>) => void;
  onOpenDiagnostics?: () => void;
}

const RAPID_CLICK_COUNT = 5;
const RAPID_CLICK_WINDOW_MS = 2500;

export function Footer({ onOpenModal, onOpenDiagnostics }: FooterProps) {
  const { navigateTo } = useBaymini();
  const copyrightClicksRef = useRef<number[]>([]);

  const handleCopyrightClick = () => {
    if (!onOpenDiagnostics) return;
    const now = Date.now();
    const recent = copyrightClicksRef.current.filter(
      (timestamp) => now - timestamp <= RAPID_CLICK_WINDOW_MS
    );
    recent.push(now);

    if (recent.length >= RAPID_CLICK_COUNT) {
      copyrightClicksRef.current = [];
      onOpenDiagnostics();
    } else {
      copyrightClicksRef.current = recent;
    }
  };

  return (
    <footer className="no-print border-t border-bm-border bg-bm-bg">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="max-w-md">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              aria-label="Baymini home"
              className="inline-flex items-center hover:opacity-85 transition-opacity"
            >
              <BayminiLogo compact />
            </button>
            <p className="mt-3 text-xs leading-relaxed text-bm-text-muted">
              General health and wellness information only. Not a substitute for
              professional medical advice.
            </p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm"
          >
            <button
              type="button"
              onClick={() => onOpenModal('about')}
              className="text-bm-text-muted hover:text-bm-text transition-colors duration-150 whitespace-nowrap"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => onOpenModal('privacy')}
              className="text-bm-text-muted hover:text-bm-text transition-colors duration-150 whitespace-nowrap"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => onOpenModal('disclaimer')}
              className="text-bm-text-muted hover:text-bm-text transition-colors duration-150 whitespace-nowrap"
            >
              Medical Disclaimer
            </button>
            <button
              type="button"
              onClick={() => onOpenModal('clear-data')}
              className="text-bm-text-muted hover:text-bm-emergency dark:hover:text-[#F27474] transition-colors duration-150 whitespace-nowrap"
            >
              Clear My Data
            </button>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-bm-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-bm-text-muted">
          <p onClick={handleCopyrightClick}>
            Copyright {new Date().getFullYear()} Baymini. All rights reserved.
          </p>
          <p>Guest-first personal wellness workspace</p>
        </div>
      </div>
    </footer>
  );
}

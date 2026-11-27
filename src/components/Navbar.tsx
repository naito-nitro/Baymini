import { useEffect, useRef, useState } from 'react';
import { Calendar, Menu, Moon, Sun, X } from 'lucide-react';
import { useBaymini } from '../context/BayminiContext';
import type { ActiveView } from '../types/baymini';
import { BayminiLogo } from './BayminiLogo';

const NAV_ITEMS: ReadonlyArray<{ id: Exclude<ActiveView, 'home'>; label: string }> = [
  { id: 'health-plan', label: 'Health Plan' },
  { id: 'symptoms', label: 'Symptoms' },
  { id: 'doctors', label: 'Find Doctors' },
];

export function Navbar() {
  const {
    activeView,
    navigateTo,
    theme,
    toggleTheme,
    upcomingBookingsCount,
    openBookingsDrawer,
  } = useBaymini();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (
        navWrapperRef.current &&
        !navWrapperRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [mobileMenuOpen]);

  const handleNavSelect = (view: ActiveView) => {
    navigateTo(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="no-print fixed top-4 inset-x-0 z-40 px-4 sm:px-6">
      <div ref={navWrapperRef} className="max-w-5xl mx-auto">
        <div className="bm-glass border border-bm-border rounded-full h-14 px-3.5 sm:px-5 flex items-center justify-between gap-4 shadow-[0_6px_28px_rgba(19,34,27,0.05)] dark:shadow-[0_6px_28px_rgba(0,0,0,0.34)]">
          {/* Brand Zone */}
          <button
            type="button"
            onClick={() => handleNavSelect('home')}
            aria-label="Baymini home"
            className="inline-flex items-center rounded-full py-1 px-1 text-left transition-opacity hover:opacity-85 whitespace-nowrap shrink-0"
          >
            <BayminiLogo />
          </button>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-1.5"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-bm-tint text-bm-primary'
                      : 'text-bm-text-muted hover:text-bm-text hover:bg-bm-surface-subtle/70'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Utility Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {upcomingBookingsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openBookingsDrawer();
                }}
                aria-label={`Open My Bookings (${upcomingBookingsCount} upcoming)`}
                className="inline-flex items-center gap-1.5 rounded-full border border-bm-border bg-bm-tint px-3 h-9 text-xs font-semibold text-bm-primary hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span className="hidden sm:inline">Bookings</span>
                <span className="tabular-nums">{upcomingBookingsCount}</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
              title={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
              className="w-10 h-10 rounded-full border border-bm-border bg-bm-surface/75 hover:bg-bm-tint text-bm-text flex items-center justify-center transition-colors duration-150 shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="baymini-mobile-nav"
              aria-label={
                mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
              }
              className="md:hidden w-10 h-10 rounded-full border border-bm-border bg-bm-surface/75 hover:bg-bm-tint text-bm-text flex items-center justify-center transition-colors duration-150 shrink-0"
            >
              {mobileMenuOpen ? (
                <X className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Menu className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Frosted-Glass Dropdown Sheet */}
        {mobileMenuOpen && (
          <nav
            id="baymini-mobile-nav"
            aria-label="Mobile navigation"
            className="md:hidden mt-2.5 bg-white/95 dark:bg-[#14241D]/95 backdrop-blur-md border border-bm-border rounded-2xl p-2 shadow-[0_12px_32px_rgba(19,34,27,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.48)]"
          >
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavSelect(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full text-left rounded-xl px-4 min-h-[44px] text-sm font-medium transition-colors duration-150 flex items-center justify-between ${
                      isActive
                        ? 'bg-bm-tint text-bm-primary'
                        : 'text-bm-text hover:bg-bm-surface-subtle/80'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

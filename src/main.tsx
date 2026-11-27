import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Tier 1 Google Maps Platform Demo Key Quota Detection:
// Register global auth/quota listeners before mounting so the app surfaces
// a calm notice only if Maps JS encounters an auth or quota failure.
declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

window.gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const joined = args.map((a) => String(a)).join(' ');
  if (
    joined.includes('OverQuotaMapError') ||
    joined.includes('QuotaExceededError')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
  origConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);

import { useBaymini } from '../context/BayminiContext';
import { Modal } from './Modal';

export type FooterModalType =
  | 'about'
  | 'privacy'
  | 'disclaimer'
  | 'clear-data'
  | null;

interface FooterModalsProps {
  activeModal: FooterModalType;
  onClose: () => void;
}

export function FooterModals({ activeModal, onClose }: FooterModalsProps) {
  const { clearAllSessionData, showToast } = useBaymini();

  const handleConfirmClear = () => {
    clearAllSessionData();
    onClose();
    showToast('Local session data cleared.');
  };

  return (
    <>
      <Modal
        isOpen={activeModal === 'about'}
        title="About Baymini"
        onClose={onClose}
      >
        <div className="space-y-4">
          <p>
            Baymini is a personal health and wellness platform built to help you
            organize realistic daily habits, prepare clearer questions before
            seeing a clinician, and locate care near you without visual clutter.
          </p>
          <p>
            You can explore Baymini immediately as a guest. Optional Google
            Calendar syncing is only requested when you explicitly choose to add
            a routine or appointment to your schedule.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-5 py-2 text-sm font-semibold transition-colors duration-150 whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'privacy'}
        title="Privacy & Local Storage"
        onClose={onClose}
      >
        <div className="space-y-4">
          <p>
            Baymini operates guest-first. Your wellness profile, generated
            routines, symptom summaries, saved location, and appointment records
            are stored locally in your browser using versioned local storage
            so your session persists between visits without requiring an account.
          </p>
          <p>
            You remain in full control of this data and can remove all stored
            session information at any time using Clear My Data in the footer.
            Your light or dark appearance preference is kept separately so your
            display stays comfortable.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-5 py-2 text-sm font-semibold transition-colors duration-150 whitespace-nowrap"
          >
            Got it
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'disclaimer'}
        title="Medical Disclaimer"
        onClose={onClose}
      >
        <div className="space-y-4">
          <p>
            Baymini provides general health, nutrition, fitness, and symptom
            guidance for informational purposes only. It does not provide
            medical diagnoses, prescribe treatments, or replace advice from a
            qualified healthcare professional.
          </p>
          <p className="text-bm-text font-medium">
            If you are experiencing a medical emergency—such as chest pain,
            severe shortness of breath, sudden weakness, or uncontrolled
            bleeding—call your local emergency number or seek immediate in-person
            emergency care.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-5 py-2 text-sm font-semibold transition-colors duration-150 whitespace-nowrap"
          >
            Understood
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'clear-data'}
        title="Clear local session data?"
        onClose={onClose}
      >
        <div className="space-y-4">
          <p>
            This will permanently remove your saved health profile, generated
            health plan, symptom assessments, selected clinic, local bookings,
            and session chat history from this browser.
          </p>
          <p>Your chosen Light or Dark theme setting will be preserved.</p>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmClear}
            className="rounded-full bg-bm-emergency hover:opacity-90 text-white px-5 py-2 text-sm font-medium transition-opacity duration-150 whitespace-nowrap"
          >
            Clear My Data
          </button>
        </div>
      </Modal>
    </>
  );
}

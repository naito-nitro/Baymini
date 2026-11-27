import { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BatteryLow,
  Bone,
  Brain,
  Check,
  CircleDot,
  ClipboardCopy,
  Compass,
  Droplets,
  FileText,
  HeartPulse,
  HelpCircle,
  Info,
  Loader2,
  MicOff,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Thermometer,
  User,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import { useBaymini } from '../../context/BayminiContext';
import type {
  SymptomFollowUpQA,
  SymptomFollowUpQuestion,
  UrgencyLevel,
} from '../../types/baymini';
import {
  SYMPTOM_OPTIONS,
  detectClientEmergency,
  extractProfileHealthSummary,
  formatDoctorQuestionsText,
  type SymptomIconKey,
} from '../../utils/symptoms';
import {
  fetchSymptomAssessment,
  fetchSymptomQuestions,
} from '../../services/symptomsApi';
import { PreVisitBriefModal } from './PreVisitBriefModal';

type WizardStep = 1 | 2 | 3;

interface EmergencyInterceptState {
  reason: string;
  allowMildBypass: boolean;
}

const STEP_LABELS: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: 'Select Symptoms' },
  { step: 2, label: 'Follow-Up Questions' },
  { step: 3, label: 'Guidance & Specialist' },
];

function renderSymptomIcon(key: SymptomIconKey) {
  const props = {
    className: 'w-4 h-4 shrink-0',
    strokeWidth: 1.75,
    'aria-hidden': true as const,
  };
  switch (key) {
    case 'brain':
      return <Brain {...props} />;
    case 'thermometer':
      return <Thermometer {...props} />;
    case 'wind':
      return <Wind {...props} />;
    case 'mic-off':
      return <MicOff {...props} />;
    case 'battery-low':
      return <BatteryLow {...props} />;
    case 'compass':
      return <Compass {...props} />;
    case 'waves':
      return <Waves {...props} />;
    case 'droplets':
      return <Droplets {...props} />;
    case 'circle-dot':
      return <CircleDot {...props} />;
    case 'activity':
      return <Activity {...props} />;
    case 'lungs':
      return <Wind {...props} />;
    case 'heart-pulse':
      return <HeartPulse {...props} />;
    case 'user':
      return <User {...props} />;
    case 'bone':
      return <Bone {...props} />;
    case 'sparkles':
      return <Sparkles {...props} />;
    case 'plus-circle':
      return <PlusCircle {...props} />;
  }
}

const URGENCY_STYLES: Record<
  UrgencyLevel,
  {
    badge: string;
    container: string;
    accentText: string;
    iconBg: string;
  }
> = {
  emergency: {
    badge: 'Emergency Care',
    container:
      'border-bm-emergency/45 bg-bm-emergency/10 dark:bg-bm-emergency/15',
    accentText: 'text-bm-emergency dark:text-[#F27474]',
    iconBg: 'bg-bm-emergency text-white',
  },
  prompt: {
    badge: 'Prompt Medical Attention',
    container: 'border-bm-prompt/40 bg-bm-prompt/10 dark:bg-bm-prompt/15',
    accentText: 'text-bm-prompt dark:text-[#E8A559]',
    iconBg: 'bg-bm-prompt text-white',
  },
  routine: {
    badge: 'Routine Consultation',
    container: 'border-bm-routine/35 bg-bm-routine/10 dark:bg-bm-routine/15',
    accentText: 'text-bm-routine dark:text-[#5DC2BF]',
    iconBg: 'bg-bm-routine text-white',
  },
  'self-care': {
    badge: 'General Self-Care',
    container: 'border-bm-confirmed/35 bg-bm-tint/70',
    accentText: 'text-bm-primary',
    iconBg: 'bg-bm-primary text-white dark:text-[#0D1813]',
  },
};

export function SymptomsView() {
  const {
    healthProfile,
    symptomAssessment,
    setSymptomAssessment,
    navigateToDoctorsWithSpecialty,
    showToast,
  } = useBaymini();

  const [step, setStep] = useState<WizardStep>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [useHealthProfile, setUseHealthProfile] = useState(true);

  const [emergencyIntercept, setEmergencyIntercept] =
    useState<EmergencyInterceptState | null>(null);

  const [questions, setQuestions] = useState<SymptomFollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [briefModalOpen, setBriefModalOpen] = useState(false);

  const profileSummary = useMemo(
    () => extractProfileHealthSummary(healthProfile),
    [healthProfile]
  );

  const filteredSymptoms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SYMPTOM_OPTIONS;
    return SYMPTOM_OPTIONS.filter((opt) =>
      opt.label.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const canContinueStep1 =
    selectedSymptoms.length > 0 || customNotes.trim().length > 0;

  const toggleSymptom = (label: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const activeProfileContext =
    profileSummary.hasRelevantData && useHealthProfile
      ? profileSummary.promptText
      : '';
  const activeProfilePills =
    profileSummary.hasRelevantData && useHealthProfile
      ? profileSummary.pills
      : [];

  const requestFollowUpQuestions = async () => {
    setEmergencyIntercept(null);
    setQuestionsError(null);
    setLoadingQuestions(true);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const response = await fetchSymptomQuestions({
        selectedSymptoms,
        customNotes: customNotes.trim(),
        profileContext: activeProfileContext,
      });

      if (response.isEmergency) {
        setEmergencyIntercept({
          reason: response.emergencyReason,
          allowMildBypass: false,
        });
        setQuestions([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setQuestions(response.questions);
      setAnswers({});
    } catch (err) {
      setQuestionsError(
        err instanceof Error
          ? err.message
          : 'We could not load follow-up questions right now.'
      );
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleStep1Continue = () => {
    if (!canContinueStep1) return;

    const clientCheck = detectClientEmergency(selectedSymptoms, customNotes);
    if (clientCheck.isEmergency) {
      setEmergencyIntercept({
        reason: clientCheck.reason,
        allowMildBypass: !clientCheck.isHardRedFlag,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    void requestFollowUpQuestions();
  };

  const handleSingleAnswer = (questionId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleMultiAnswer = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const existing = Array.isArray(prev[questionId])
        ? (prev[questionId] as string[])
        : [];
      const next = existing.includes(option)
        ? existing.filter((item) => item !== option)
        : [...existing, option];
      return { ...prev, [questionId]: next };
    });
  };

  const handleTextAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const requestFinalAssessment = async () => {
    setAssessmentError(null);
    setLoadingAssessment(true);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const followUpQA: SymptomFollowUpQA[] = questions
      .map((q) => {
        const raw = answers[q.id];
        const formatted = Array.isArray(raw)
          ? raw.join(', ')
          : typeof raw === 'string'
            ? raw.trim()
            : '';
        return {
          question: q.question,
          answer: formatted || 'Not specified',
        };
      })
      .filter((item) => item.question);

    try {
      const result = await fetchSymptomAssessment({
        selectedSymptoms,
        customNotes: customNotes.trim(),
        followUpQA,
        profileContext: activeProfileContext,
        factoredProfileSummary: activeProfilePills,
      });
      setSymptomAssessment(result);
      showToast('Symptom guidance is ready.');
    } catch (err) {
      setAssessmentError(
        err instanceof Error
          ? err.message
          : 'Could not generate symptom guidance right now.'
      );
    } finally {
      setLoadingAssessment(false);
    }
  };

  const handleCopyQuestions = async (items: string[]) => {
    const text = formatDoctorQuestionsText(items);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    showToast('Doctor questions copied.');
  };

  const handleStartNewCheck = () => {
    setSelectedSymptoms([]);
    setCustomNotes('');
    setSearchQuery('');
    setQuestions([]);
    setAnswers({});
    setEmergencyIntercept(null);
    setQuestionsError(null);
    setAssessmentError(null);
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="print-main pt-28 sm:pt-34 pb-24 sm:pb-32">
      <div className="max-w-4xl mx-auto px-5 sm:px-8">
        {/* Page Heading */}
        <header className="mb-5">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-bm-text text-balance">
            Symptoms Checker
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-bm-text-muted max-w-2xl leading-relaxed">
            Describe how you feel to get structured guidance, urgency cues, and the right specialist match.
          </p>
        </header>

        {/* Layer 1 Safety: Quiet Always-Visible Emergency Escape Hatch */}
        <div className="no-print mb-6 rounded-xl border border-bm-border bg-bm-surface px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-bm-text-muted">
            <AlertCircle
              className="w-4 h-4 text-bm-emergency dark:text-[#F27474] shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span>Experiencing severe or sudden symptoms?</span>
          </div>
          <button
            type="button"
            onClick={() => navigateToDoctorsWithSpecialty('Emergency Hospital')}
            className="text-xs sm:text-sm font-semibold text-bm-emergency dark:text-[#F27474] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>Find Emergency Care</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {/* Clean 3-Step Indicator Bar */}
        <nav
          aria-label="Symptom check progress"
          className="no-print mb-7 bm-card rounded-2xl px-4 sm:px-6 py-3.5"
        >
          <ol className="grid grid-cols-3 gap-2 sm:gap-4">
            {STEP_LABELS.map((item) => {
              const isCurrent = step === item.step && !emergencyIntercept;
              const isCompleted = step > item.step && !emergencyIntercept;
              return (
                <li
                  key={item.step}
                  className="flex items-center gap-2 sm:gap-2.5 min-w-0"
                >
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 transition-colors ${
                      isCurrent
                        ? 'bg-bm-primary text-white dark:text-[#0D1813]'
                        : isCompleted
                          ? 'bg-bm-tint text-bm-primary border border-bm-primary/25'
                          : 'bg-bm-surface-subtle text-bm-text-muted border border-bm-border'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      item.step
                    )}
                  </span>
                  <span
                    className={`text-xs sm:text-sm truncate ${
                      isCurrent
                        ? 'font-semibold text-bm-text'
                        : isCompleted
                          ? 'font-medium text-bm-text'
                          : 'text-bm-text-muted'
                    }`}
                  >
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* LAYER 2 / LAYER 3 HIGH-CONTRAST EMERGENCY ALERT CARD */}
        {emergencyIntercept && (
          <section
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border-2 border-bm-emergency bg-bm-surface p-6 sm:p-8 shadow-sm space-y-5"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-bm-emergency text-white flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-bm-emergency dark:text-[#F27474]">
                  Immediate Emergency Guidance
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-bm-text">
                  Please seek emergency medical care right away
                </h2>
                <p className="text-sm sm:text-base leading-relaxed text-bm-text-muted">
                  {emergencyIntercept.reason}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-bm-emergency/30 bg-bm-emergency/10 px-4 py-3.5 text-sm text-bm-text leading-relaxed">
              Call your local emergency services number immediately or go to the nearest emergency room. Do not wait for symptoms to pass or drive yourself if you feel unwell.
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  navigateToDoctorsWithSpecialty('Emergency Hospital')
                }
                className="rounded-full bg-bm-emergency hover:opacity-90 text-white px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition-opacity"
              >
                <HeartPulse className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                <span>Find Nearest Emergency Hospitals</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmergencyIntercept(null);
                  setStep(1);
                }}
                className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2.5 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                <span>Edit Symptoms</span>
              </button>
            </div>

            {emergencyIntercept.allowMildBypass && (
              <div className="pt-2 border-t border-bm-border">
                <button
                  type="button"
                  onClick={() => void requestFollowUpQuestions()}
                  className="text-xs font-medium text-bm-text-muted hover:text-bm-text underline underline-offset-4 transition-colors"
                >
                  My symptoms are mild — continue check anyway
                </button>
              </div>
            )}
          </section>
        )}

        {/* STEP 1 — INITIAL SYMPTOM CHECKLIST */}
        {!emergencyIntercept && step === 1 && (
          <div className="space-y-5">
            {/* Saved Assessment Quick Return Banner */}
            {symptomAssessment && (
              <div className="bm-card rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-bm-tint/55">
                <div className="text-xs sm:text-sm text-bm-text">
                  <span className="font-semibold">Previous check saved:</span>{' '}
                  <span className="text-bm-text-muted">
                    {symptomAssessment.recommendedSpecialty} ({symptomAssessment.urgencyTitle})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-primary px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>View Last Assessment</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Profile-Aware Opt-Out Banner (Only when Health Profile has saved details) */}
            {profileSummary.hasRelevantData && (
              <div className="bm-card rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={useHealthProfile}
                      onClick={() => setUseHealthProfile((prev) => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        useHealthProfile
                          ? 'bg-bm-primary'
                          : 'bg-bm-border'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-[#0D1813] transition-transform ${
                          useHealthProfile ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-semibold text-bm-text">
                      Factor in my Health Profile
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-11.5">
                    {useHealthProfile ? (
                      profileSummary.pills.map((pill) => (
                        <span
                          key={pill}
                          className="rounded-full border border-bm-border bg-bm-tint/70 px-2.5 py-0.5 text-xs font-medium text-bm-primary"
                        >
                          {pill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-bm-text-muted">
                        Profile details will be excluded from this symptom check.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Checklist Solid Card */}
            <section className="bm-card rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                    Let&apos;s understand how you&apos;re feeling.
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-bm-text-muted">
                    Select any symptoms that apply, or describe them in your own words below.
                  </p>
                </div>

                {/* Compact Filter Input */}
                <div className="relative w-full sm:w-60 shrink-0">
                  <Search
                    className="w-4 h-4 text-bm-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter symptoms..."
                    aria-label="Filter symptoms"
                    className="w-full rounded-full border border-bm-border bg-bm-surface-subtle pl-9 pr-8 py-2 text-xs sm:text-sm text-bm-text placeholder:text-bm-text-muted focus:border-bm-primary transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear filter"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bm-text-muted hover:text-bm-text"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Breathable Symptom Pill Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredSymptoms.map((option) => {
                  const isSelected = selectedSymptoms.includes(option.label);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleSymptom(option.label)}
                      className={`rounded-xl border px-3.5 py-3 text-left text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-colors duration-150 ${
                        isSelected
                          ? 'border-bm-primary bg-bm-tint text-bm-primary'
                          : 'border-bm-border bg-bm-surface hover:bg-bm-surface-subtle text-bm-text'
                      }`}
                    >
                      <span
                        className={
                          isSelected ? 'text-bm-primary' : 'text-bm-text-muted'
                        }
                      >
                        {renderSymptomIcon(option.icon)}
                      </span>
                      <span className="leading-snug">{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {filteredSymptoms.length === 0 && (
                <p className="text-xs sm:text-sm text-bm-text-muted text-center py-3">
                  No checklist matches for &ldquo;{searchQuery}&rdquo;. You can describe your symptom in the box below.
                </p>
              )}

              {/* Optional Multilingual Description */}
              <div className="space-y-2 pt-2 border-t border-bm-border">
                <label
                  htmlFor="symptom-notes"
                  className="block text-sm font-medium text-bm-text"
                >
                  Additional details
                </label>
                <textarea
                  id="symptom-notes"
                  rows={3}
                  maxLength={800}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Describe duration, severity, or anything else you notice (optional)"
                  className="w-full rounded-xl border border-bm-border bg-bm-surface-subtle px-4 py-3 text-sm text-bm-text placeholder:text-bm-text-muted focus:border-bm-primary transition-colors resize-y"
                />
              </div>

              {/* Step 1 Footer CTA */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <p className="text-xs text-bm-text-muted">
                  {selectedSymptoms.length > 0
                    ? `${selectedSymptoms.length} symptom${selectedSymptoms.length === 1 ? '' : 's'} selected`
                    : 'Select at least one symptom or add a brief note to continue.'}
                </p>
                <button
                  type="button"
                  disabled={!canContinueStep1}
                  onClick={handleStep1Continue}
                  className="rounded-full bg-bm-primary hover:bg-bm-primary-hover disabled:opacity-45 disabled:cursor-not-allowed text-white dark:text-[#0D1813] px-7 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>
        )}

        {/* STEP 2 — ADAPTIVE AI FOLLOW-UP QUESTIONS */}
        {!emergencyIntercept && step === 2 && (
          <div className="space-y-5">
            {loadingQuestions ? (
              <div className="bm-card rounded-2xl p-10 sm:p-14 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-bm-tint text-bm-primary flex items-center justify-center mx-auto">
                  <Loader2
                    className="w-5 h-5 animate-spin"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-bm-text">
                    Preparing follow-up questions
                  </h2>
                  <p className="text-sm text-bm-text-muted max-w-md mx-auto">
                    Reviewing your reported symptoms to ask a few calm, targeted clarifying questions.
                  </p>
                </div>
              </div>
            ) : questionsError ? (
              <div className="bm-card rounded-2xl p-6 sm:p-8 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="w-5 h-5 text-bm-prompt shrink-0 mt-0.5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-bm-text">
                      Could not load follow-up questions
                    </h2>
                    <p className="text-sm text-bm-text-muted">
                      {questionsError}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void requestFollowUpQuestions()}
                    className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-5 py-2 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Back</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {questions.map((q, index) => {
                    const currentVal = answers[q.id];
                    return (
                      <section
                        key={q.id}
                        className="bm-card rounded-2xl p-5 sm:p-6 space-y-3.5"
                      >
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-xs font-semibold text-bm-primary tabular-nums">
                            0{index + 1}
                          </span>
                          <h2 className="text-sm sm:text-base font-semibold text-bm-text leading-snug">
                            {q.question}
                          </h2>
                        </div>

                        {q.type === 'single' && (
                          <div className="flex flex-wrap gap-2">
                            {q.options.map((option) => {
                              const selected = currentVal === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => handleSingleAnswer(q.id, option)}
                                  className={`rounded-full border px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                                    selected
                                      ? 'border-bm-primary bg-bm-tint text-bm-primary'
                                      : 'border-bm-border bg-bm-surface hover:bg-bm-surface-subtle text-bm-text'
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'multi' && (
                          <div className="space-y-2">
                            <p className="text-xs text-bm-text-muted">
                              Select all that apply
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {q.options.map((option) => {
                                const selected =
                                  Array.isArray(currentVal) &&
                                  currentVal.includes(option);
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() =>
                                      handleMultiAnswer(q.id, option)
                                    }
                                    className={`rounded-full border px-4 py-2 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                                      selected
                                        ? 'border-bm-primary bg-bm-tint text-bm-primary'
                                        : 'border-bm-border bg-bm-surface hover:bg-bm-surface-subtle text-bm-text'
                                    }`}
                                  >
                                    {selected && (
                                      <Check
                                        className="w-3.5 h-3.5"
                                        strokeWidth={2}
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span>{option}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {q.type === 'text' && (
                          <input
                            type="text"
                            value={typeof currentVal === 'string' ? currentVal : ''}
                            onChange={(e) =>
                              handleTextAnswer(q.id, e.target.value)
                            }
                            placeholder="Type a brief answer (optional)"
                            className="w-full rounded-xl border border-bm-border bg-bm-surface-subtle px-4 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted focus:border-bm-primary transition-colors"
                          />
                        )}
                      </section>
                    );
                  })}
                </div>

                {/* Step 2 Bottom Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2.5 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void requestFinalAssessment()}
                    className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-7 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <span>Get AI Guidance</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3 — STRUCTURED AI GUIDANCE, SPECIALIST BRIDGE & PRE-VISIT BRIEF */}
        {!emergencyIntercept && step === 3 && (
          <div className="space-y-5">
            {loadingAssessment ? (
              <div className="bm-card rounded-2xl p-10 sm:p-14 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-bm-tint text-bm-primary flex items-center justify-center mx-auto">
                  <Loader2
                    className="w-5 h-5 animate-spin"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-bm-text">
                    Organizing your symptom guidance
                  </h2>
                  <p className="text-sm text-bm-text-muted max-w-md mx-auto">
                    Evaluating urgency cues, safe self-care steps, and the right specialist match.
                  </p>
                </div>
              </div>
            ) : assessmentError ? (
              <div className="bm-card rounded-2xl p-6 sm:p-8 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="w-5 h-5 text-bm-prompt shrink-0 mt-0.5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-bm-text">
                      Could not generate symptom guidance
                    </h2>
                    <p className="text-sm text-bm-text-muted">
                      {assessmentError}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void requestFinalAssessment()}
                    className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-5 py-2 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Back to Questions</span>
                  </button>
                </div>
              </div>
            ) : symptomAssessment ? (
              <>
                {/* 1. Urgency Level Banner */}
                {(() => {
                  const style = URGENCY_STYLES[symptomAssessment.urgencyLevel];
                  return (
                    <section
                      className={`rounded-2xl border p-6 sm:p-7 ${style.container}`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.iconBg}`}
                        >
                          {symptomAssessment.urgencyLevel === 'emergency' ? (
                            <ShieldAlert
                              className="w-5 h-5"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                          ) : (
                            <Activity
                              className="w-5 h-5"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <p
                            className={`text-xs font-semibold uppercase tracking-[0.1em] ${style.accentText}`}
                          >
                            {style.badge}
                          </p>
                          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-bm-text">
                            {symptomAssessment.urgencyTitle}
                          </h2>
                          <p className="text-sm sm:text-base leading-relaxed text-bm-text-muted">
                            {symptomAssessment.urgencySummary}
                          </p>
                        </div>
                      </div>
                    </section>
                  );
                })()}

                {/* 2. Recommended Specialist Bridge Card */}
                <section
                  className={`rounded-2xl border p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${
                    symptomAssessment.urgencyLevel === 'emergency'
                      ? 'border-bm-emergency/35 bg-bm-surface'
                      : 'border-bm-border bg-bm-tint/60'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-bm-primary">
                      <Stethoscope
                        className="w-4 h-4"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <span>Recommended Specialist</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-bm-text">
                      {symptomAssessment.recommendedSpecialty}
                    </h3>
                    <p className="text-sm text-bm-text-muted leading-relaxed max-w-xl">
                      {symptomAssessment.specialtyReason}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigateToDoctorsWithSpecialty(
                        symptomAssessment.recommendedSpecialty
                      )
                    }
                    className={`rounded-full px-6 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shrink-0 whitespace-nowrap ${
                      symptomAssessment.urgencyLevel === 'emergency'
                        ? 'bg-bm-emergency hover:opacity-90 text-white'
                        : 'bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813]'
                    }`}
                  >
                    <span>
                      {symptomAssessment.urgencyLevel === 'emergency'
                        ? 'Find Nearest Emergency Hospitals'
                        : `Find ${symptomAssessment.recommendedSpecialty} Near You`}
                    </span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </section>

                {/* 3. Possible Explanations Card */}
                <section className="bm-card rounded-2xl p-6 sm:p-7 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-semibold text-bm-text">
                      Possible Explanations
                    </h3>
                    <p className="text-xs text-bm-text-muted">
                      Educational possibilities only — not a medical diagnosis.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {symptomAssessment.possibleExplanations.map((item, idx) => (
                      <div
                        key={`${item.title}-${idx}`}
                        className="rounded-xl border border-bm-border bg-bm-surface-subtle/70 p-4 space-y-1.5"
                      >
                        <h4 className="text-sm font-semibold text-bm-text">
                          {item.title}
                        </h4>
                        <p className="text-xs sm:text-sm leading-relaxed text-bm-text-muted">
                          {item.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 4 & 5. Self-Care Guidance + Warning Signs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <section className="bm-card rounded-2xl p-6 space-y-3.5">
                    <h3 className="text-base font-semibold text-bm-text">
                      General Self-Care Guidance
                    </h3>
                    <ul className="space-y-2.5">
                      {symptomAssessment.selfCareGuidance.map((stepText, idx) => (
                        <li
                          key={`${stepText}-${idx}`}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-bm-text-muted"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-bm-primary mt-2 shrink-0" />
                          <span>{stepText}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="bm-card rounded-2xl p-6 space-y-3.5 border-bm-emergency/25">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className="w-4 h-4 text-bm-emergency shrink-0"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <h3 className="text-base font-semibold text-bm-text">
                        Warning Signs — When to Seek Immediate Help
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      {symptomAssessment.warningSigns.map((sign, idx) => (
                        <li
                          key={`${sign}-${idx}`}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-bm-text-muted"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-bm-emergency mt-2 shrink-0" />
                          <span>{sign}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                {/* 6. Questions to Ask Your Doctor + Pre-Visit Brief CTA */}
                <section className="bm-card rounded-2xl p-6 sm:p-7 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <HelpCircle
                        className="w-4 h-4 text-bm-primary shrink-0"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <h3 className="text-base sm:text-lg font-semibold text-bm-text">
                        Questions to Ask Your Doctor
                      </h3>
                    </div>

                    <div className="no-print flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyQuestions(
                            symptomAssessment.doctorQuestions
                          )
                        }
                        className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                      >
                        <ClipboardCopy
                          className="w-3.5 h-3.5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span>Copy Questions</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBriefModalOpen(true)}
                        className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <FileText
                          className="w-3.5 h-3.5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span>Open Pre-Visit Doctor Brief</span>
                      </button>
                    </div>
                  </div>

                  <ol className="space-y-2 list-decimal list-inside text-sm leading-relaxed text-bm-text-muted">
                    {symptomAssessment.doctorQuestions.map((question, idx) => (
                      <li key={`${question}-${idx}`}>{question}</li>
                    ))}
                  </ol>
                </section>

                {/* 7. Visible Medical Disclaimer Box */}
                <div className="rounded-2xl border border-bm-border bg-bm-surface-subtle/75 px-5 py-4 flex items-start gap-3">
                  <Info
                    className="w-4 h-4 text-bm-text-muted shrink-0 mt-0.5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <p className="text-xs sm:text-sm leading-relaxed text-bm-text-muted">
                    Baymini provides AI-generated health information for educational purposes only. It is not a substitute for professional medical diagnosis, treatment, or advice.
                  </p>
                </div>

                {/* 8. Bottom Action Button */}
                <div className="no-print flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleStartNewCheck}
                    className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-6 py-2.5 text-sm font-medium inline-flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw
                      className="w-4 h-4"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span>Start New Symptom Check</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Printable 1-Page Pre-Visit Doctor Brief Modal */}
      <PreVisitBriefModal
        isOpen={briefModalOpen}
        assessment={symptomAssessment}
        onClose={() => setBriefModalOpen(false)}
        onCopied={() => showToast('Pre-visit brief copied.')}
      />
    </div>
  );
}

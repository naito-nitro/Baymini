import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useBaymini } from '../../context/BayminiContext';
import type { HealthProfile } from '../../types/baymini';
import { generateHealthPlanRequest } from '../../services/healthPlanApi';
import { HealthProfileForm } from './HealthProfileForm';
import { HealthPlanResults } from './HealthPlanResults';

const LOADING_STAGES = [
  'Reviewing your health profile and safety notes...',
  'Tailoring local, budget-friendly meals for your region...',
  'Structuring your daily routine and exercise guidance...',
] as const;

export function HealthPlanView() {
  const {
    healthProfile,
    setHealthProfile,
    healthPlan,
    setHealthPlan,
    showToast,
  } = useBaymini();

  const [isEditing, setIsEditing] = useState<boolean>(() => !healthPlan);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAttemptProfile, setLastAttemptProfile] =
    useState<HealthProfile | null>(null);

  // If user clears session data from the footer while viewing results, return cleanly to the empty form
  useEffect(() => {
    if (!healthPlan && !isGenerating && !errorMessage) {
      setIsEditing(true);
    }
  }, [healthPlan, isGenerating, errorMessage]);

  useEffect(() => {
    if (!isGenerating) return;
    setLoadingStageIndex(0);
    const interval = setInterval(() => {
      setLoadingStageIndex((prev) => (prev + 1) % LOADING_STAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const runGeneration = async (profileToUse: HealthProfile) => {
    setHealthProfile(profileToUse);
    setLastAttemptProfile(profileToUse);
    setErrorMessage(null);
    setIsGenerating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const plan = await generateHealthPlanRequest(profileToUse);
      setHealthPlan(plan);
      setIsEditing(false);
      showToast('Your personalized health plan is ready.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'We could not generate your health plan right now. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <section className="pt-32 sm:pt-40 pb-24 sm:pb-32">
        <div className="max-w-xl mx-auto px-5 sm:px-8">
          <div
            role="status"
            aria-live="polite"
            className="bm-card rounded-2xl p-8 sm:p-11 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-bm-tint text-bm-primary flex items-center justify-center mx-auto mb-6">
              <Loader2
                className="w-6 h-6 animate-spin"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-bm-text">
              Crafting your wellness plan
            </h1>

            <p className="mt-3 text-sm sm:text-base leading-relaxed text-bm-text-muted min-h-[3rem]">
              {LOADING_STAGES[loadingStageIndex]}
            </p>

            <div className="mt-6 flex items-center justify-center gap-2">
              {LOADING_STAGES.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === loadingStageIndex
                      ? 'w-7 bg-bm-primary'
                      : 'w-2 bg-bm-border'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="pt-32 sm:pt-40 pb-24 sm:pb-32">
        <div className="max-w-xl mx-auto px-5 sm:px-8">
          <div
            role="alert"
            className="bm-card rounded-2xl p-8 sm:p-10 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-bm-tint text-bm-emergency flex items-center justify-center mx-auto mb-5">
              <AlertCircle
                className="w-6 h-6"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-bm-text">
              Plan generation paused
            </h1>

            <p className="mt-3 text-sm sm:text-base leading-relaxed text-bm-text-muted">
              {errorMessage}
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = lastAttemptProfile ?? healthProfile;
                  if (target) {
                    void runGeneration(target);
                  } else {
                    setErrorMessage(null);
                    setIsEditing(true);
                  }
                }}
                className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <RefreshCw
                  className="w-4 h-4"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setIsEditing(true);
                }}
                className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!isEditing && healthPlan && healthProfile) {
    return (
      <HealthPlanResults
        profile={healthProfile}
        plan={healthPlan}
        onEditInfo={() => {
          setIsEditing(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onRegenerate={() => {
          void runGeneration(healthProfile);
        }}
      />
    );
  }

  return (
    <HealthProfileForm
      initialProfile={healthProfile}
      hasExistingPlan={Boolean(healthPlan)}
      onSubmit={(submittedProfile) => {
        void runGeneration(submittedProfile);
      }}
      onCancelEdit={
        healthPlan
          ? () => {
              setIsEditing(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          : undefined
      }
    />
  );
}

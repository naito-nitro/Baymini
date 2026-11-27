import { useEffect, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Dumbbell,
  Edit3,
  Info,
  Loader2,
  Moon,
  Printer,
  RefreshCw,
  ShoppingBasket,
  Sun,
  SunMedium,
  Undo2,
  Utensils,
} from 'lucide-react';
import { useBaymini } from '../../context/BayminiContext';
import type {
  ExerciseItem,
  HealthPlan,
  HealthProfile,
  MealOption,
} from '../../types/baymini';
import {
  countShoppingListItems,
  formatShoppingListForClipboard,
} from '../../utils/healthPlan';
import {
  swapExerciseRequest,
  swapMealRequest,
} from '../../services/healthPlanApi';
import { CalendarSyncModal } from './CalendarSyncModal';

const JUMP_SECTIONS = [
  { id: 'section-morning', label: 'Morning' },
  { id: 'section-afternoon', label: 'Afternoon' },
  { id: 'section-evening', label: 'Evening' },
  { id: 'section-diet', label: 'Diet' },
  { id: 'section-exercise', label: 'Exercise' },
  { id: 'section-sleep', label: 'Sleep' },
] as const;

const MEAL_SWAP_REASONS = [
  'Cheaper local option',
  'Quicker to prepare',
  'Different flavor',
] as const;

const EXERCISE_SWAP_REASONS = [
  'Easier / gentler',
  'No equipment',
  'Injury-safe alternative',
] as const;

interface HealthPlanResultsProps {
  profile: HealthProfile;
  plan: HealthPlan;
  onEditInfo: () => void;
  onRegenerate: () => void;
}

export function HealthPlanResults({
  profile,
  plan,
  onEditInfo,
  onRegenerate,
}: HealthPlanResultsProps) {
  const { setHealthPlan, showToast } = useBaymini();
  const [activeSection, setActiveSection] = useState<string>('section-morning');
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);

  // Single-item meal swap state
  const [openMealSwapId, setOpenMealSwapId] = useState<string | null>(null);
  const [swappingMealId, setSwappingMealId] = useState<string | null>(null);
  const [previousMeals, setPreviousMeals] = useState<Record<string, MealOption>>(
    {}
  );

  // Single-item exercise swap state
  const [openExerciseSwapId, setOpenExerciseSwapId] = useState<string | null>(
    null
  );
  const [swappingExerciseId, setSwappingExerciseId] = useState<string | null>(
    null
  );
  const [previousExercises, setPreviousExercises] = useState<
    Record<string, ExerciseItem>
  >({});

  useEffect(() => {
    const elements = JUMP_SECTIONS.map((s) =>
      document.getElementById(s.id)
    ).filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: '-140px 0px -55% 0px',
        threshold: 0.05,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [plan]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleMealSwap = async (meal: MealOption, reason: string) => {
    setOpenMealSwapId(null);
    setSwappingMealId(meal.id);

    try {
      const replacement = await swapMealRequest(profile, meal, reason);
      setPreviousMeals((prev) => ({ ...prev, [meal.id]: meal }));
      setHealthPlan({
        ...plan,
        meals: plan.meals.map((item) =>
          item.id === meal.id ? replacement : item
        ),
      });
      showToast(`${meal.slot} updated.`);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Could not swap meal right now.'
      );
    } finally {
      setSwappingMealId(null);
    }
  };

  const handleUndoMealSwap = (mealId: string) => {
    const previous = previousMeals[mealId];
    if (!previous) return;
    setHealthPlan({
      ...plan,
      meals: plan.meals.map((item) => (item.id === mealId ? previous : item)),
    });
    setPreviousMeals((prev) => {
      const next = { ...prev };
      delete next[mealId];
      return next;
    });
    showToast(`${previous.slot} restored.`);
  };

  const handleExerciseSwap = async (
    exercise: ExerciseItem,
    reason: string
  ) => {
    setOpenExerciseSwapId(null);
    setSwappingExerciseId(exercise.id);

    try {
      const replacement = await swapExerciseRequest(profile, exercise, reason);
      setPreviousExercises((prev) => ({ ...prev, [exercise.id]: exercise }));
      setHealthPlan({
        ...plan,
        exercises: plan.exercises.map((item) =>
          item.id === exercise.id ? replacement : item
        ),
      });
      showToast('Exercise updated.');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Could not swap exercise right now.'
      );
    } finally {
      setSwappingExerciseId(null);
    }
  };

  const handleUndoExerciseSwap = (exerciseId: string) => {
    const previous = previousExercises[exerciseId];
    if (!previous) return;
    setHealthPlan({
      ...plan,
      exercises: plan.exercises.map((item) =>
        item.id === exerciseId ? previous : item
      ),
    });
    setPreviousExercises((prev) => {
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
    showToast('Previous exercise restored.');
  };

  const handleCopyShoppingList = async () => {
    const text = formatShoppingListForClipboard(
      plan.shoppingList,
      profile.region
    );
    try {
      await navigator.clipboard.writeText(text);
      showToast('Shopping list copied.');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Shopping list copied.');
    }
  };

  const displayDietType =
    profile.dietType === 'Other'
      ? profile.dietTypeOther || 'Custom Diet'
      : profile.dietType || 'Balanced';

  const shoppingItemCount = countShoppingListItems(plan.shoppingList);

  return (
    <div className="print-main pt-28 sm:pt-34 pb-24 sm:pb-32">
      <div className="max-w-5xl mx-auto px-5 sm:px-8">
        {/* Top Plan Header */}
        <header className="bm-card rounded-2xl p-6 sm:p-8 mb-6">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-bm-text text-balance">
            Your Personalized Health Plan
          </h1>

          <p className="mt-3 text-sm sm:text-base leading-relaxed text-bm-text-muted max-w-3xl">
            {plan.intro}
          </p>

          {/* Compact Metadata Row */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {profile.primaryGoal && (
              <span className="rounded-full bg-bm-tint text-bm-primary px-3 py-1 text-xs font-medium">
                {profile.primaryGoal}
              </span>
            )}
            <span className="rounded-full bg-bm-tint text-bm-primary px-3 py-1 text-xs font-medium">
              {displayDietType}
            </span>
            {profile.budget && (
              <span className="rounded-full bg-bm-tint text-bm-primary px-3 py-1 text-xs font-medium">
                {profile.budget}
              </span>
            )}
            {profile.region && (
              <span className="rounded-full bg-bm-tint text-bm-primary px-3 py-1 text-xs font-medium">
                {profile.region}
              </span>
            )}
          </div>

          {/* Action Bar */}
          <div className="no-print mt-6 pt-5 border-t border-bm-border flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCalendarModalOpen(true)}
              className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Calendar
                className="w-4 h-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>Sync Routine to Calendar</span>
            </button>

            <button
              type="button"
              onClick={onEditInfo}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Edit3 className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              <span>Edit Info</span>
            </button>

            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className="w-4 h-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>Regenerate</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Printer
                className="w-4 h-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>Print / PDF</span>
            </button>
          </div>
        </header>

        {/* Sticky Section Jump-Bar */}
        <div className="no-print sticky top-[5rem] z-30 mb-8">
          <nav
            aria-label="Health plan sections"
            className="bm-glass border border-bm-border rounded-full px-2 py-1.5 shadow-[0_4px_20px_rgba(19,34,27,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] overflow-x-auto"
          >
            <div className="flex items-center justify-start sm:justify-center gap-1 min-w-max">
              {JUMP_SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-bm-tint text-bm-primary'
                        : 'text-bm-text-muted hover:text-bm-text'
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Plan Content Sections */}
        <div className="space-y-8">
          {/* A. Morning Routine */}
          <section
            id="section-morning"
            className="scroll-mt-36 bm-card rounded-2xl p-6 sm:p-8 print-break-avoid"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                <SunMedium
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                  Morning Routine
                </h2>
                <p className="text-xs text-bm-text-muted">
                  Calm start, hydration, nourishment, and light movement
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Wake-up habit
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.morningRoutine.wakeUpHabit}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Hydration cue
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.morningRoutine.hydrationCue}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Breakfast link
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.morningRoutine.breakfastLink}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Morning movement
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.morningRoutine.morningMovement}
                </p>
              </div>
            </div>

            {plan.morningRoutine.steps.length > 0 && (
              <ul className="mt-5 divide-y divide-bm-border border-t border-bm-border">
                {plan.morningRoutine.steps.map((step, idx) => (
                  <li
                    key={`${step.time}-${idx}`}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-5"
                  >
                    <span className="text-xs font-semibold tabular-nums text-bm-primary sm:w-24 shrink-0">
                      {step.time}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-bm-text">
                        {step.title}
                      </span>
                      {step.description && (
                        <p className="mt-0.5 text-xs sm:text-sm text-bm-text-muted leading-relaxed">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* B. Afternoon Routine */}
          <section
            id="section-afternoon"
            className="scroll-mt-36 bm-card rounded-2xl p-6 sm:p-8 print-break-avoid"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                <Sun
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                  Afternoon Routine
                </h2>
                <p className="text-xs text-bm-text-muted">
                  Steady hydration, posture resets, and sustained focus
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Midday habits
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.afternoonRoutine.middayHabits}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Hydration reminder
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.afternoonRoutine.hydrationReminder}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Posture & movement break
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.afternoonRoutine.postureBreak}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Afternoon energy guidance
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.afternoonRoutine.energyGuidance}
                </p>
              </div>
            </div>

            {plan.afternoonRoutine.steps.length > 0 && (
              <ul className="mt-5 divide-y divide-bm-border border-t border-bm-border">
                {plan.afternoonRoutine.steps.map((step, idx) => (
                  <li
                    key={`${step.time}-${idx}`}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-5"
                  >
                    <span className="text-xs font-semibold tabular-nums text-bm-primary sm:w-24 shrink-0">
                      {step.time}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-bm-text">
                        {step.title}
                      </span>
                      {step.description && (
                        <p className="mt-0.5 text-xs sm:text-sm text-bm-text-muted leading-relaxed">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* C. Evening Routine */}
          <section
            id="section-evening"
            className="scroll-mt-36 bm-card rounded-2xl p-6 sm:p-8 print-break-avoid"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                <Moon
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                  Evening Routine
                </h2>
                <p className="text-xs text-bm-text-muted">
                  Dinner timing, recovery, screen wind-down, and rest cues
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Dinner timing
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.eveningRoutine.dinnerTiming}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Recovery habits
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.eveningRoutine.recoveryHabits}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Screen wind-down
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.eveningRoutine.screenWindDown}
                </p>
              </div>
              <div className="rounded-xl border border-bm-border bg-bm-bg p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Evening relaxation
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.eveningRoutine.relaxationCue}
                </p>
              </div>
            </div>

            {plan.eveningRoutine.steps.length > 0 && (
              <ul className="mt-5 divide-y divide-bm-border border-t border-bm-border">
                {plan.eveningRoutine.steps.map((step, idx) => (
                  <li
                    key={`${step.time}-${idx}`}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-5"
                  >
                    <span className="text-xs font-semibold tabular-nums text-bm-primary sm:w-24 shrink-0">
                      {step.time}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-bm-text">
                        {step.title}
                      </span>
                      {step.description && (
                        <p className="mt-0.5 text-xs sm:text-sm text-bm-text-muted leading-relaxed">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* D. Personalized Daily Diet + Single-Item AI Swap + Local Shopping List */}
          <section id="section-diet" className="scroll-mt-36 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                <Utensils
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                  Personalized Daily Diet
                </h2>
                <p className="text-xs text-bm-text-muted">
                  Tailored for {profile.region} ({profile.budget || 'Balanced'})
                  · All nutrition figures are estimates
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {plan.meals.map((meal) => {
                const isSwapping = swappingMealId === meal.id;
                const swapMenuOpen = openMealSwapId === meal.id;
                const canUndo = Boolean(previousMeals[meal.id]);

                return (
                  <article
                    key={meal.id}
                    className="bm-card rounded-2xl p-6 flex flex-col justify-between print-break-avoid"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-bm-primary">
                          {meal.slot}
                        </span>

                        <div className="no-print flex items-center gap-1.5">
                          {canUndo && !isSwapping && (
                            <button
                              type="button"
                              onClick={() => handleUndoMealSwap(meal.id)}
                              className="rounded-full border border-bm-border bg-bm-bg hover:bg-bm-tint text-bm-text-muted hover:text-bm-text px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <Undo2
                                className="w-3 h-3"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              <span>Undo</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isSwapping}
                            onClick={() =>
                              setOpenMealSwapId((prev) =>
                                prev === meal.id ? null : meal.id
                              )
                            }
                            aria-expanded={swapMenuOpen}
                            aria-label={`Swap ${meal.slot}`}
                            className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {isSwapping ? (
                              <Loader2
                                className="w-3.5 h-3.5 animate-spin text-bm-primary"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            ) : (
                              <RefreshCw
                                className="w-3.5 h-3.5 text-bm-primary"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            )}
                            <span>{isSwapping ? 'Swapping...' : 'Swap'}</span>
                          </button>
                        </div>
                      </div>

                      {swapMenuOpen && !isSwapping && (
                        <div className="no-print mb-4 rounded-xl border border-bm-border bg-bm-bg p-3 space-y-2">
                          <p className="text-xs font-medium text-bm-text-muted">
                            Swap {meal.slot} for:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {MEAL_SWAP_REASONS.map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => handleMealSwap(meal, reason)}
                                className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap"
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <h3 className="text-base sm:text-lg font-semibold tracking-tight text-bm-text">
                        {meal.dishName}
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-bm-text-muted">
                        {meal.portionGuidance}
                      </p>

                      <p className="mt-3 text-xs font-medium text-bm-text tabular-nums">
                        {meal.nutritionEstimate}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-bm-border space-y-2 text-xs leading-relaxed">
                      <p className="text-bm-text-muted">
                        <span className="font-medium text-bm-text">
                          Local note:{' '}
                        </span>
                        {meal.localAvailabilityNote}
                      </p>
                      <p className="text-bm-text-muted">
                        <span className="font-medium text-bm-primary">
                          Budget Swap Tip:{' '}
                        </span>
                        {meal.budgetSwapTip}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Collapsible Local Shopping List */}
            {plan.shoppingList.length > 0 && (
              <div className="bm-card rounded-2xl overflow-hidden print-break-avoid">
                <div className="px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShoppingOpen((prev) => !prev)}
                    aria-expanded={shoppingOpen}
                    className="flex items-center gap-3 text-left min-w-0 flex-1"
                  >
                    <div className="w-9 h-9 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                      <ShoppingBasket
                        className="w-[18px] h-[18px]"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-base font-semibold tracking-tight text-bm-text">
                          Local Shopping List
                        </h3>
                        <span className="text-xs font-medium text-bm-text-muted tabular-nums">
                          {shoppingItemCount} everyday items
                        </span>
                      </div>
                      <p className="text-xs text-bm-text-muted">
                        Ingredients grouped for easy local market shopping
                      </p>
                    </div>
                  </button>

                  <div className="no-print flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyShoppingList}
                      className="rounded-full border border-bm-border bg-bm-bg hover:bg-bm-tint text-bm-text px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <ClipboardCopy
                        className="w-3.5 h-3.5"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <span>Copy List</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShoppingOpen((prev) => !prev)}
                      aria-label={
                        shoppingOpen
                          ? 'Collapse shopping list'
                          : 'Expand shopping list'
                      }
                      className="w-8 h-8 rounded-full border border-bm-border bg-bm-bg hover:bg-bm-tint text-bm-text flex items-center justify-center transition-colors"
                    >
                      {shoppingOpen ? (
                        <ChevronUp
                          className="w-4 h-4"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDown
                          className="w-4 h-4"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>
                </div>

                {shoppingOpen && (
                  <div className="px-6 pb-6 pt-4 border-t border-bm-border grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {plan.shoppingList.map((group) => (
                      <div key={group.category}>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-bm-primary mb-2.5">
                          {group.category}
                        </h4>
                        <ul className="space-y-1.5 text-sm text-bm-text-muted">
                          {group.items.map((item, idx) => (
                            <li
                              key={`${group.category}-${idx}`}
                              className="flex items-start gap-2"
                            >
                              <span
                                aria-hidden="true"
                                className="text-bm-primary mt-0.5"
                              >
                                -
                              </span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* E. Exercise Recommendations + Single-Item AI Swap */}
          <section id="section-exercise" className="scroll-mt-36 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                <Dumbbell
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                  Exercise Recommendations
                </h2>
                <p className="text-xs text-bm-text-muted">
                  Tailored to {profile.fitnessLevel} fitness level with
                  injury-safe modifications
                </p>
              </div>
            </div>

            {/* Exercise Overview Card */}
            <div className="bm-card rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4 print-break-avoid">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Weekly rhythm
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.exerciseOverview.weeklyRhythm}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Intensity guidance
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.exerciseOverview.intensityGuidance}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-bm-text-muted">
                  Safety adjustments
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-bm-text">
                  {plan.exerciseOverview.safetyAdjustments}
                </p>
              </div>
            </div>

            {/* Exercise Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {plan.exercises.map((exercise) => {
                const isSwapping = swappingExerciseId === exercise.id;
                const swapMenuOpen = openExerciseSwapId === exercise.id;
                const canUndo = Boolean(previousExercises[exercise.id]);

                return (
                  <article
                    key={exercise.id}
                    className="bm-card rounded-2xl p-6 flex flex-col justify-between print-break-avoid"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-bm-tint text-bm-primary px-2.5 py-0.5 font-medium">
                            {exercise.intensity}
                          </span>
                          <span className="text-bm-text-muted tabular-nums font-medium">
                            {exercise.durationOrSets}
                          </span>
                        </div>

                        <div className="no-print flex items-center gap-1.5 shrink-0">
                          {canUndo && !isSwapping && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUndoExerciseSwap(exercise.id)
                              }
                              className="rounded-full border border-bm-border bg-bm-bg hover:bg-bm-tint text-bm-text-muted hover:text-bm-text px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <Undo2
                                className="w-3 h-3"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              <span>Undo</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isSwapping}
                            onClick={() =>
                              setOpenExerciseSwapId((prev) =>
                                prev === exercise.id ? null : exercise.id
                              )
                            }
                            aria-expanded={swapMenuOpen}
                            aria-label={`Swap ${exercise.name}`}
                            className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {isSwapping ? (
                              <Loader2
                                className="w-3.5 h-3.5 animate-spin text-bm-primary"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            ) : (
                              <RefreshCw
                                className="w-3.5 h-3.5 text-bm-primary"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            )}
                            <span>{isSwapping ? 'Swapping...' : 'Swap'}</span>
                          </button>
                        </div>
                      </div>

                      {swapMenuOpen && !isSwapping && (
                        <div className="no-print mb-4 rounded-xl border border-bm-border bg-bm-bg p-3 space-y-2">
                          <p className="text-xs font-medium text-bm-text-muted">
                            Swap exercise for:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {EXERCISE_SWAP_REASONS.map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() =>
                                  handleExerciseSwap(exercise, reason)
                                }
                                className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap"
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <h3 className="text-base font-semibold tracking-tight text-bm-text">
                        {exercise.name}
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-bm-text-muted">
                        {exercise.guidance}
                      </p>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-bm-border text-xs leading-relaxed text-bm-text-muted">
                      <span className="font-medium text-bm-primary">
                        Beginner-friendly modification:{' '}
                      </span>
                      {exercise.beginnerModification}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* F. Sleep & Lifestyle */}
          <section
            id="section-sleep"
            className="scroll-mt-36 bm-card rounded-2xl p-6 sm:p-8 print-break-avoid"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                <Moon
                  className="w-5 h-5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                  Sleep & Lifestyle
                </h2>
                <p className="text-xs text-bm-text-muted">
                  Consistent recovery window, hydration, and everyday calm
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-xl border border-bm-border bg-bm-bg p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-bm-primary">
                  Sleep window & hygiene
                </p>
                <p className="text-sm font-medium text-bm-text leading-relaxed">
                  {plan.sleepAndLifestyle.sleepWindow}
                </p>
                {plan.sleepAndLifestyle.sleepHygiene.length > 0 && (
                  <ul className="space-y-2 text-sm text-bm-text-muted pt-1">
                    {plan.sleepAndLifestyle.sleepHygiene.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span aria-hidden="true" className="text-bm-primary">
                          -
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-bm-border bg-bm-bg p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-bm-primary">
                  Hydration & stress balance
                </p>
                <p className="text-sm font-medium text-bm-text leading-relaxed">
                  {plan.sleepAndLifestyle.hydrationGuidance}
                </p>
                {plan.sleepAndLifestyle.stressHabits.length > 0 && (
                  <ul className="space-y-2 text-sm text-bm-text-muted pt-1">
                    {plan.sleepAndLifestyle.stressHabits.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span aria-hidden="true" className="text-bm-primary">
                          -
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* Bottom Medical Note */}
          <aside
            aria-label="Wellness plan disclaimer"
            className="bm-card rounded-2xl p-5 sm:p-6 flex items-start gap-3 print-break-avoid"
          >
            <Info
              className="w-4 h-4 text-bm-text-muted shrink-0 mt-0.5"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <p className="text-xs sm:text-sm leading-relaxed text-bm-text-muted">
              This plan provides general personalized wellness guidance and
              approximate nutritional estimates for informational purposes only.
              It is not a medical prescription, clinical diagnosis, or
              substitute for advice from a qualified healthcare professional.
            </p>
          </aside>
        </div>
      </div>

      <CalendarSyncModal
        isOpen={calendarModalOpen}
        plan={plan}
        onClose={() => setCalendarModalOpen(false)}
      />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Dumbbell,
  HeartPulse,
  Leaf,
  Moon,
  RotateCcw,
  Scale,
  ShieldCheck,
  Wind,
  Zap,
} from 'lucide-react';
import type {
  ActivityLevel,
  BudgetTier,
  DietType,
  FitnessLevel,
  GenderOption,
  HealthProfile,
  SleepDurationOption,
} from '../../types/baymini';
import {
  ACTIVITY_LEVEL_OPTIONS,
  BUDGET_TIER_OPTIONS,
  DIET_TYPE_OPTIONS,
  FITNESS_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  HEALTH_GOAL_OPTIONS,
  MEDICAL_CONDITION_OPTIONS,
  SAMPLE_PROFILES,
  SLEEP_DURATION_OPTIONS,
  cmToFeetInches,
  createEmptyHealthProfile,
  feetInchesToCm,
  kgToLbs,
  lbsToKg,
  validateHealthProfileForm,
  type HealthProfileErrors,
} from '../../utils/healthPlan';

const GOAL_ICONS: Record<string, typeof Dumbbell> = {
  'Muscle Building': Dumbbell,
  'Weight Management': Scale,
  'Longevity & Healthy Aging': HeartPulse,
  'Overall Health & Wellness': Leaf,
  'Better Sleep': Moon,
  'Improved Stamina & Fitness': Zap,
  'Stress Management': Wind,
};

interface HealthProfileFormProps {
  initialProfile: HealthProfile | null;
  hasExistingPlan: boolean;
  onSubmit: (profile: HealthProfile) => void;
  onCancelEdit?: () => void;
}

export function HealthProfileForm({
  initialProfile,
  hasExistingPlan,
  onSubmit,
  onCancelEdit,
}: HealthProfileFormProps) {
  const [profile, setProfile] = useState<HealthProfile>(() =>
    initialProfile ? { ...initialProfile } : createEmptyHealthProfile()
  );
  const [errors, setErrors] = useState<HealthProfileErrors>({});
  const [medicalOpen, setMedicalOpen] = useState<boolean>(() => {
    if (!initialProfile) return false;
    const hasConditions = initialProfile.medicalConditions.some(
      (c) => c !== 'None'
    );
    return Boolean(
      hasConditions ||
        initialProfile.allergies ||
        initialProfile.medications ||
        initialProfile.injuries
    );
  });

  // Imperial display buffers so typing ft/in or lbs feels natural without rounding jumps
  const [feetInput, setFeetInput] = useState<string>(() => {
    if (profile.heightCm !== null) {
      return String(cmToFeetInches(profile.heightCm).feet);
    }
    return '';
  });
  const [inchesInput, setInchesInput] = useState<string>(() => {
    if (profile.heightCm !== null) {
      return String(cmToFeetInches(profile.heightCm).inches);
    }
    return '';
  });
  const [lbsInput, setLbsInput] = useState<string>(() => {
    if (profile.weightKg !== null) {
      return String(kgToLbs(profile.weightKg));
    }
    return '';
  });

  useEffect(() => {
    if (!initialProfile) {
      setProfile(createEmptyHealthProfile());
      setFeetInput('');
      setInchesInput('');
      setLbsInput('');
      setErrors({});
    }
  }, [initialProfile]);

  const clearFieldError = (field: keyof HealthProfileErrors) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const applyPreset = (presetProfile: HealthProfile) => {
    const copy: HealthProfile = {
      ...presetProfile,
      medicalConditions: [...presetProfile.medicalConditions],
      goals: [...presetProfile.goals],
    };
    setProfile(copy);
    setErrors({});
    if (copy.heightCm !== null) {
      const fi = cmToFeetInches(copy.heightCm);
      setFeetInput(String(fi.feet));
      setInchesInput(String(fi.inches));
    }
    if (copy.weightKg !== null) {
      setLbsInput(String(kgToLbs(copy.weightKg)));
    }
    const hasMedical =
      copy.medicalConditions.some((c) => c !== 'None') ||
      Boolean(copy.allergies || copy.medications || copy.injuries);
    setMedicalOpen(hasMedical);
  };

  const handleClearForm = () => {
    setProfile(createEmptyHealthProfile());
    setFeetInput('');
    setInchesInput('');
    setLbsInput('');
    setErrors({});
    setMedicalOpen(false);
  };

  const handleHeightUnitChange = (unit: 'cm' | 'ft-in') => {
    if (unit === profile.heightUnit) return;
    if (unit === 'ft-in' && profile.heightCm !== null) {
      const fi = cmToFeetInches(profile.heightCm);
      setFeetInput(String(fi.feet));
      setInchesInput(String(fi.inches));
    }
    setProfile((prev) => ({ ...prev, heightUnit: unit }));
  };

  const handleWeightUnitChange = (unit: 'kg' | 'lbs') => {
    if (unit === profile.weightUnit) return;
    if (unit === 'lbs' && profile.weightKg !== null) {
      setLbsInput(String(kgToLbs(profile.weightKg)));
    }
    setProfile((prev) => ({ ...prev, weightUnit: unit }));
  };

  const handleImperialHeightChange = (nextFeet: string, nextInches: string) => {
    setFeetInput(nextFeet);
    setInchesInput(nextInches);
    clearFieldError('heightCm');
    if (nextFeet.trim() === '' && nextInches.trim() === '') {
      setProfile((prev) => ({ ...prev, heightCm: null }));
      return;
    }
    const f = Number(nextFeet) || 0;
    const i = Number(nextInches) || 0;
    setProfile((prev) => ({ ...prev, heightCm: feetInchesToCm(f, i) }));
  };

  const handleImperialWeightChange = (nextLbs: string) => {
    setLbsInput(nextLbs);
    clearFieldError('weightKg');
    if (nextLbs.trim() === '') {
      setProfile((prev) => ({ ...prev, weightKg: null }));
      return;
    }
    const parsed = Number(nextLbs);
    setProfile((prev) => ({
      ...prev,
      weightKg: Number.isFinite(parsed) ? lbsToKg(parsed) : null,
    }));
  };

  const toggleMedicalCondition = (condition: string) => {
    setProfile((prev) => {
      if (condition === 'None') {
        return {
          ...prev,
          medicalConditions: ['None'],
          medicalConditionsOther: '',
        };
      }
      const withoutNone = prev.medicalConditions.filter((c) => c !== 'None');
      const exists = withoutNone.includes(condition);
      const next = exists
        ? withoutNone.filter((c) => c !== condition)
        : [...withoutNone, condition];
      return {
        ...prev,
        medicalConditions: next.length > 0 ? next : ['None'],
        medicalConditionsOther:
          condition === 'Other' && exists ? '' : prev.medicalConditionsOther,
      };
    });
  };

  const toggleGoal = (goalId: string) => {
    clearFieldError('goals');
    setProfile((prev) => {
      const exists = prev.goals.includes(goalId);
      if (exists) {
        const nextGoals = prev.goals.filter((g) => g !== goalId);
        const nextPrimary =
          prev.primaryGoal === goalId ? (nextGoals[0] ?? '') : prev.primaryGoal;
        return { ...prev, goals: nextGoals, primaryGoal: nextPrimary };
      }
      const nextGoals = [...prev.goals, goalId];
      const nextPrimary = prev.primaryGoal || goalId;
      return { ...prev, goals: nextGoals, primaryGoal: nextPrimary };
    });
  };

  const setPrimaryGoal = (goalId: string) => {
    setProfile((prev) => ({
      ...prev,
      goals: prev.goals.includes(goalId) ? prev.goals : [...prev.goals, goalId],
      primaryGoal: goalId,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validationErrors = validateHealthProfileForm(profile);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstKey = Object.keys(validationErrors)[0];
      const target = document.getElementById(`field-${firstKey}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const normalizedProfile: HealthProfile = {
      ...profile,
      region: profile.region.trim(),
      primaryGoal: profile.primaryGoal || profile.goals[0] || '',
    };
    onSubmit(normalizedProfile);
  };

  const medicalSummary = (() => {
    const items: string[] = [];
    const activeConds = profile.medicalConditions.filter((c) => c !== 'None');
    if (activeConds.length > 0) items.push(activeConds.join(', '));
    if (profile.allergies.trim()) items.push('Allergies noted');
    if (profile.medications.trim()) items.push('Medications noted');
    if (profile.injuries.trim()) items.push('Injuries noted');
    return items.length > 0
      ? items.join(' · ')
      : 'Optional — add conditions, allergies, medications, or injuries';
  })();

  return (
    <div className="pt-28 sm:pt-34 pb-24 sm:pb-32">
      <div className="max-w-4xl mx-auto px-5 sm:px-8">
        {/* Top Header */}
        <header className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-bm-text text-balance">
            Your Customized Health Plan
          </h1>
          <p className="mt-3 text-base leading-relaxed text-bm-text-muted max-w-2xl">
            Share a few details about your routine, region, and goals to
            generate a practical daily wellness plan.
          </p>

          {/* Quick-Fill Presets */}
          <div className="mt-6 pt-5 border-t border-bm-border">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-xs font-medium tracking-wider uppercase text-bm-text-muted">
                Try a sample profile
              </span>
              <button
                type="button"
                onClick={handleClearForm}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-bm-text-muted hover:text-bm-text transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Clear Form</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROFILES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.profile)}
                  className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint hover:border-bm-sage text-bm-text px-4 py-2 text-xs sm:text-[13px] font-medium transition-colors duration-150 text-left"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Card A — Personal Information */}
          <section className="bm-card rounded-2xl p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-medium tabular-nums tracking-widest text-bm-text-muted">
                01
              </p>
              <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                Personal Information
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Age */}
              <div id="field-age">
                <div className="min-h-[28px] flex items-center justify-between mb-2">
                  <label
                    htmlFor="input-age"
                    className="text-sm font-medium text-bm-text"
                  >
                    Age
                  </label>
                </div>
                <input
                  id="input-age"
                  type="number"
                  min={13}
                  max={110}
                  inputMode="numeric"
                  placeholder="e.g., 28"
                  value={profile.age ?? ''}
                  onChange={(e) => {
                    clearFieldError('age');
                    const val = e.target.value;
                    setProfile((prev) => ({
                      ...prev,
                      age: val === '' ? null : Number(val),
                    }));
                  }}
                  aria-invalid={Boolean(errors.age)}
                  className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70 tabular-nums"
                />
                {errors.age && (
                  <p role="alert" className="mt-1.5 text-xs text-bm-emergency dark:text-[#F27474]">
                    {errors.age}
                  </p>
                )}
              </div>

              {/* Height */}
              <div id="field-heightCm">
                <div className="min-h-[28px] flex items-center justify-between mb-2">
                  <label
                    htmlFor="input-height-cm"
                    className="text-sm font-medium text-bm-text"
                  >
                    Height
                  </label>
                  <div
                    role="group"
                    aria-label="Height unit"
                    className="inline-flex rounded-full border border-bm-border bg-bm-bg p-0.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleHeightUnitChange('cm')}
                      className={`px-2.5 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                        profile.heightUnit === 'cm'
                          ? 'bg-bm-tint text-bm-primary'
                          : 'text-bm-text-muted hover:text-bm-text'
                      }`}
                    >
                      cm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHeightUnitChange('ft-in')}
                      className={`px-2.5 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                        profile.heightUnit === 'ft-in'
                          ? 'bg-bm-tint text-bm-primary'
                          : 'text-bm-text-muted hover:text-bm-text'
                      }`}
                    >
                      ft / in
                    </button>
                  </div>
                </div>

                {profile.heightUnit === 'cm' ? (
                  <input
                    id="input-height-cm"
                    type="number"
                    min={90}
                    max={250}
                    step="0.5"
                    inputMode="decimal"
                    placeholder="e.g., 171"
                    value={profile.heightCm ?? ''}
                    onChange={(e) => {
                      clearFieldError('heightCm');
                      const val = e.target.value;
                      setProfile((prev) => ({
                        ...prev,
                        heightCm: val === '' ? null : Number(val),
                      }));
                    }}
                    aria-invalid={Boolean(errors.heightCm)}
                    className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70 tabular-nums"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      id="input-height-cm"
                      type="number"
                      min={3}
                      max={8}
                      aria-label="Height feet"
                      placeholder="ft"
                      value={feetInput}
                      onChange={(e) =>
                        handleImperialHeightChange(e.target.value, inchesInput)
                      }
                      aria-invalid={Boolean(errors.heightCm)}
                      className="w-full rounded-xl border border-bm-border bg-bm-bg px-3 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70 tabular-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      max={11}
                      aria-label="Height inches"
                      placeholder="in"
                      value={inchesInput}
                      onChange={(e) =>
                        handleImperialHeightChange(feetInput, e.target.value)
                      }
                      aria-invalid={Boolean(errors.heightCm)}
                      className="w-full rounded-xl border border-bm-border bg-bm-bg px-3 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70 tabular-nums"
                    />
                  </div>
                )}
                {errors.heightCm && (
                  <p role="alert" className="mt-1.5 text-xs text-bm-emergency dark:text-[#F27474]">
                    {errors.heightCm}
                  </p>
                )}
              </div>

              {/* Weight */}
              <div id="field-weightKg">
                <div className="min-h-[28px] flex items-center justify-between mb-2">
                  <label
                    htmlFor="input-weight"
                    className="text-sm font-medium text-bm-text"
                  >
                    Weight
                  </label>
                  <div
                    role="group"
                    aria-label="Weight unit"
                    className="inline-flex rounded-full border border-bm-border bg-bm-bg p-0.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleWeightUnitChange('kg')}
                      className={`px-2.5 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                        profile.weightUnit === 'kg'
                          ? 'bg-bm-tint text-bm-primary'
                          : 'text-bm-text-muted hover:text-bm-text'
                      }`}
                    >
                      kg
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWeightUnitChange('lbs')}
                      className={`px-2.5 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                        profile.weightUnit === 'lbs'
                          ? 'bg-bm-tint text-bm-primary'
                          : 'text-bm-text-muted hover:text-bm-text'
                      }`}
                    >
                      lbs
                    </button>
                  </div>
                </div>

                {profile.weightUnit === 'kg' ? (
                  <input
                    id="input-weight"
                    type="number"
                    min={25}
                    max={300}
                    step="0.5"
                    inputMode="decimal"
                    placeholder="e.g., 68"
                    value={profile.weightKg ?? ''}
                    onChange={(e) => {
                      clearFieldError('weightKg');
                      const val = e.target.value;
                      setProfile((prev) => ({
                        ...prev,
                        weightKg: val === '' ? null : Number(val),
                      }));
                    }}
                    aria-invalid={Boolean(errors.weightKg)}
                    className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70 tabular-nums"
                  />
                ) : (
                  <input
                    id="input-weight"
                    type="number"
                    min={55}
                    max={660}
                    step="0.5"
                    inputMode="decimal"
                    placeholder="e.g., 150"
                    value={lbsInput}
                    onChange={(e) => handleImperialWeightChange(e.target.value)}
                    aria-invalid={Boolean(errors.weightKg)}
                    className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70 tabular-nums"
                  />
                )}
                {errors.weightKg && (
                  <p role="alert" className="mt-1.5 text-xs text-bm-emergency dark:text-[#F27474]">
                    {errors.weightKg}
                  </p>
                )}
              </div>
            </div>

            {/* Gender */}
            <div className="mt-6">
              <span className="block text-sm font-medium text-bm-text mb-2.5">
                Gender
              </span>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((option) => {
                  const selected = profile.gender === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setProfile((prev) => ({
                          ...prev,
                          gender: option as GenderOption,
                        }))
                      }
                      aria-pressed={selected}
                      className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-bm-tint border-bm-primary/40 text-bm-primary'
                          : 'bg-bm-bg border-bm-border text-bm-text-muted hover:text-bm-text'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Country / Region */}
            <div id="field-region" className="mt-6">
              <label
                htmlFor="input-region"
                className="block text-sm font-medium text-bm-text mb-2"
              >
                Country or Region
              </label>
              <input
                id="input-region"
                type="text"
                placeholder="e.g., Dhaka, Bangladesh or Austin, USA"
                value={profile.region}
                onChange={(e) => {
                  clearFieldError('region');
                  setProfile((prev) => ({ ...prev, region: e.target.value }));
                }}
                aria-invalid={Boolean(errors.region)}
                className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70"
              />
              {errors.region && (
                <p role="alert" className="mt-1.5 text-xs text-bm-emergency dark:text-[#F27474]">
                  {errors.region}
                </p>
              )}
            </div>

            {/* Activity, Fitness, Sleep */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label
                  htmlFor="select-activity"
                  className="block text-sm font-medium text-bm-text mb-2"
                >
                  Activity Level
                </label>
                <select
                  id="select-activity"
                  value={profile.activityLevel}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      activityLevel: e.target.value as ActivityLevel,
                    }))
                  }
                  className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text"
                >
                  {ACTIVITY_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="select-fitness"
                  className="block text-sm font-medium text-bm-text mb-2"
                >
                  Current Fitness Level
                </label>
                <select
                  id="select-fitness"
                  value={profile.fitnessLevel}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      fitnessLevel: e.target.value as FitnessLevel,
                    }))
                  }
                  className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text"
                >
                  {FITNESS_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="select-sleep"
                  className="block text-sm font-medium text-bm-text mb-2"
                >
                  Average Sleep Duration
                </label>
                <select
                  id="select-sleep"
                  value={profile.sleepDuration}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      sleepDuration: e.target.value as SleepDurationOption,
                    }))
                  }
                  className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text"
                >
                  {SLEEP_DURATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Card B — Medical Background (Optional, Collapsible) */}
          <section className="bm-card rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setMedicalOpen((prev) => !prev)}
              aria-expanded={medicalOpen}
              className="w-full px-6 sm:px-8 py-5 sm:py-6 flex items-center justify-between gap-4 text-left hover:bg-bm-surface-subtle/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium tabular-nums tracking-widest text-bm-text-muted">
                  02
                </p>
                <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                  Medical Background{' '}
                  <span className="text-sm font-normal text-bm-text-muted">
                    (Optional)
                  </span>
                </h2>
                {!medicalOpen && (
                  <p className="mt-1 text-xs sm:text-sm text-bm-text-muted truncate">
                    {medicalSummary}
                  </p>
                )}
              </div>
              <span className="w-9 h-9 rounded-full border border-bm-border bg-bm-bg text-bm-text-muted flex items-center justify-center shrink-0">
                {medicalOpen ? (
                  <ChevronUp className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                )}
              </span>
            </button>

            {medicalOpen && (
              <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-2 border-t border-bm-border space-y-5">
                <div>
                  <span className="block text-sm font-medium text-bm-text mb-2.5">
                    Existing medical conditions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {MEDICAL_CONDITION_OPTIONS.map((condition) => {
                      const selected = profile.medicalConditions.includes(condition);
                      return (
                        <button
                          key={condition}
                          type="button"
                          onClick={() => toggleMedicalCondition(condition)}
                          aria-pressed={selected}
                          className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors whitespace-nowrap ${
                            selected
                              ? 'bg-bm-tint border-bm-primary/40 text-bm-primary'
                              : 'bg-bm-bg border-bm-border text-bm-text-muted hover:text-bm-text'
                          }`}
                        >
                          {condition}
                        </button>
                      );
                    })}
                  </div>

                  {profile.medicalConditions.includes('Other') && (
                    <input
                      type="text"
                      aria-label="Other medical conditions"
                      placeholder="Briefly list any other condition"
                      value={profile.medicalConditionsOther}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          medicalConditionsOther: e.target.value,
                        }))
                      }
                      className="mt-3 w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="input-allergies"
                      className="block text-sm font-medium text-bm-text mb-1.5"
                    >
                      Allergies
                    </label>
                    <input
                      id="input-allergies"
                      type="text"
                      placeholder="e.g., Peanuts, shellfish"
                      value={profile.allergies}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          allergies: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-medications"
                      className="block text-sm font-medium text-bm-text mb-1.5"
                    >
                      Current medications
                    </label>
                    <input
                      id="input-medications"
                      type="text"
                      placeholder="Optional"
                      value={profile.medications}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          medications: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-injuries"
                      className="block text-sm font-medium text-bm-text mb-1.5"
                    >
                      Previous injuries
                    </label>
                    <input
                      id="input-injuries"
                      type="text"
                      placeholder="e.g., Knee pain, lower back"
                      value={profile.injuries}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          injuries: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-start gap-2.5 text-xs leading-relaxed text-bm-text-muted">
                  <ShieldCheck
                    className="w-4 h-4 text-bm-primary shrink-0 mt-0.5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <p>
                    Stored only in your browser for this session to tailor safe
                    recommendations. You can clear your data anytime from the
                    footer.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Card C — Health Goals */}
          <section id="field-goals" className="bm-card rounded-2xl p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-medium tabular-nums tracking-widest text-bm-text-muted">
                03
              </p>
              <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                Health Goals
              </h2>
              <p className="mt-1.5 text-sm text-bm-text-muted">
                Select one or more goals. Your first selection becomes Primary,
                and you can switch your primary focus anytime.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {HEALTH_GOAL_OPTIONS.map((goal) => {
                const Icon = GOAL_ICONS[goal.id] ?? Leaf;
                const selected = profile.goals.includes(goal.id);
                const isPrimary = selected && profile.primaryGoal === goal.id;

                return (
                  <div
                    key={goal.id}
                    className={`rounded-2xl border p-4 transition-colors duration-150 flex flex-col justify-between ${
                      selected
                        ? 'bg-bm-tint/70 border-bm-primary/45'
                        : 'bg-bm-bg border-bm-border hover:border-bm-sage'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGoal(goal.id)}
                      aria-pressed={selected}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            selected
                              ? 'bg-bm-primary text-white dark:text-[#0D1813]'
                              : 'bg-bm-surface border border-bm-border text-bm-primary'
                          }`}
                        >
                          <Icon
                            className="w-4 h-4"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        </div>

                        {isPrimary && (
                          <span className="rounded-full bg-bm-primary text-white dark:text-[#0D1813] px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                            Primary
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-bm-text leading-snug">
                        {goal.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-bm-text-muted">
                        {goal.subtitle}
                      </p>
                    </button>

                    {selected && !isPrimary && (
                      <div className="mt-3 pt-2.5 border-t border-bm-border/80">
                        <button
                          type="button"
                          onClick={() => setPrimaryGoal(goal.id)}
                          className="text-xs font-medium text-bm-primary hover:underline"
                        >
                          Set Primary
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {errors.goals && (
              <p role="alert" className="mt-3 text-xs text-bm-emergency dark:text-[#F27474]">
                {errors.goals}
              </p>
            )}
          </section>

          {/* Card D — Dietary Preferences & Local Food Focus */}
          <section className="bm-card rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <p className="text-xs font-medium tabular-nums tracking-widest text-bm-text-muted">
                04
              </p>
              <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-bm-text">
                Dietary Preferences & Local Food Focus
              </h2>
            </div>

            {/* Diet Type */}
            <div id="field-dietType">
              <span className="block text-sm font-medium text-bm-text mb-2.5">
                Diet type
              </span>
              <div className="flex flex-wrap gap-2">
                {DIET_TYPE_OPTIONS.map((diet) => {
                  const selected = profile.dietType === diet;
                  return (
                    <button
                      key={diet}
                      type="button"
                      onClick={() => {
                        clearFieldError('dietType');
                        setProfile((prev) => ({
                          ...prev,
                          dietType: diet as DietType,
                          dietTypeOther:
                            diet === 'Other' ? prev.dietTypeOther : '',
                        }));
                      }}
                      aria-pressed={selected}
                      className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-bm-tint border-bm-primary/40 text-bm-primary'
                          : 'bg-bm-bg border-bm-border text-bm-text-muted hover:text-bm-text'
                      }`}
                    >
                      {diet}
                    </button>
                  );
                })}
              </div>

              {profile.dietType === 'Other' && (
                <input
                  type="text"
                  aria-label="Describe your diet preference"
                  placeholder="e.g., Halal, low-dairy, home-cooked traditional"
                  value={profile.dietTypeOther}
                  onChange={(e) => {
                    clearFieldError('dietType');
                    setProfile((prev) => ({
                      ...prev,
                      dietTypeOther: e.target.value,
                    }));
                  }}
                  className="mt-3 w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70"
                />
              )}

              {errors.dietType && (
                <p role="alert" className="mt-2 text-xs text-bm-emergency dark:text-[#F27474]">
                  {errors.dietType}
                </p>
              )}
            </div>

            {/* Food Budget */}
            <div id="field-budget">
              <span className="block text-sm font-medium text-bm-text mb-2.5">
                Food budget
              </span>
              <div className="flex flex-wrap gap-2">
                {BUDGET_TIER_OPTIONS.map((tier) => {
                  const selected = profile.budget === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => {
                        clearFieldError('budget');
                        setProfile((prev) => ({
                          ...prev,
                          budget: tier as BudgetTier,
                        }));
                      }}
                      aria-pressed={selected}
                      className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-bm-tint border-bm-primary/40 text-bm-primary'
                          : 'bg-bm-bg border-bm-border text-bm-text-muted hover:text-bm-text'
                      }`}
                    >
                      {tier}
                    </button>
                  );
                })}
              </div>
              {errors.budget && (
                <p role="alert" className="mt-2 text-xs text-bm-emergency dark:text-[#F27474]">
                  {errors.budget}
                </p>
              )}
            </div>

            {/* Optional food notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="input-food-restrictions"
                  className="block text-sm font-medium text-bm-text mb-1.5"
                >
                  Food allergies or restrictions{' '}
                  <span className="font-normal text-bm-text-muted">(Optional)</span>
                </label>
                <input
                  id="input-food-restrictions"
                  type="text"
                  placeholder="e.g., Lactose-free, no spicy food"
                  value={profile.foodRestrictions}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      foodRestrictions: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70"
                />
              </div>

              <div>
                <label
                  htmlFor="input-preferred-foods"
                  className="block text-sm font-medium text-bm-text mb-1.5"
                >
                  Preferred everyday foods{' '}
                  <span className="font-normal text-bm-text-muted">(Optional)</span>
                </label>
                <input
                  id="input-preferred-foods"
                  type="text"
                  placeholder="e.g., Rice, lentils, eggs, seasonal greens"
                  value={profile.preferredFoods}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      preferredFoods: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-bm-border bg-bm-bg px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted/70"
                />
              </div>
            </div>
          </section>

          {/* Submit Section */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            <button
              type="submit"
              className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-7 py-3 text-sm font-semibold transition-colors duration-150 whitespace-nowrap"
            >
              Generate My Health Plan
            </button>

            {hasExistingPlan && onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="text-sm font-medium text-bm-text-muted hover:text-bm-text transition-colors whitespace-nowrap"
              >
                Cancel and return to current plan
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

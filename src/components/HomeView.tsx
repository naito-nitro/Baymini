import {
  Activity,
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  Leaf,
  MapPin,
  Stethoscope,
  SunMedium,
} from 'lucide-react';
import { useBaymini } from '../context/BayminiContext';
import type { ActiveView } from '../types/baymini';

const PREVIEW_ROWS = [
  {
    icon: SunMedium,
    title: 'Morning Routine',
    description: '15-min stretch, hydration & balanced local breakfast',
  },
  {
    icon: Stethoscope,
    title: 'Symptom Guidance',
    description: 'Adaptive triage with clear urgency & specialist match',
  },
  {
    icon: CalendarCheck,
    title: 'Care & Schedule',
    description: 'Live nearby clinics synced straight to Google Calendar',
  },
] as const;

const CORE_FEATURES: ReadonlyArray<{
  step: string;
  title: string;
  description: string;
  cta: string;
  view: Exclude<ActiveView, 'home'>;
  icon: typeof ClipboardList;
}> = [
  {
    step: '01',
    title: 'Your Customized Health Plan',
    description:
      'Build a realistic daily routine with beginner-friendly workouts and budget-aware local meals tailored to your body and region.',
    cta: 'Build your plan',
    view: 'health-plan',
    icon: ClipboardList,
  },
  {
    step: '02',
    title: 'Symptoms Checker',
    description:
      'Answer adaptive AI follow-up questions with instant emergency safety checks to understand urgency and the right specialist to see.',
    cta: 'Check symptoms',
    view: 'symptoms',
    icon: Activity,
  },
  {
    step: '03',
    title: "Take Doc's Advice",
    description:
      'Discover real nearby doctors and clinics on live Google Maps and confirm appointments directly to your Google Calendar.',
    cta: 'Find nearby doctors',
    view: 'doctors',
    icon: MapPin,
  },
];

export function HomeView() {
  const { navigateTo } = useBaymini();

  return (
    <div className="w-full">
      {/* Section A — Hero */}
      <section className="pt-28 sm:pt-32 pb-12 sm:pb-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase text-bm-text-muted mb-5">
                <Leaf
                  className="w-3.5 h-3.5 text-bm-primary shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span>AI-Powered Personal Wellness</span>
              </div>

              <h1 className="text-[2.35rem] sm:text-5xl lg:text-[3.5rem] font-semibold tracking-tight leading-[1.08] text-bm-text text-balance">
                Your health. Your journey. Your Baymini.
              </h1>

              <p className="mt-6 text-base sm:text-lg leading-relaxed text-bm-text-muted max-w-xl">
                Personalized daily routines, safety-first symptom guidance, and
                live nearby doctor booking—all in one calm space.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => navigateTo('health-plan')}
                  className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-6 py-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0"
                >
                  <span>Create Health Plan</span>
                  <ArrowRight
                    className="w-4 h-4"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('symptoms')}
                  className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-6 py-3 text-sm font-medium inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0"
                >
                  <span>Check Symptoms</span>
                </button>
              </div>
            </div>

            {/* Right Column — Restrained Frosted-Glass Preview Card */}
            <div className="lg:col-span-5">
              <aside
                aria-label="Today with Baymini overview"
                className="bm-glass border border-bm-border rounded-2xl p-6 sm:p-7 shadow-[0_10px_34px_rgba(19,34,27,0.04)] dark:shadow-[0_10px_34px_rgba(0,0,0,0.32)]"
              >
                <div className="flex items-center justify-between pb-4 border-b border-bm-border">
                  <h2 className="text-sm font-semibold tracking-tight text-bm-text">
                    Today with Baymini
                  </h2>
                  <span className="text-xs text-bm-text-muted">
                    Daily rhythm
                  </span>
                </div>

                <ul className="divide-y divide-bm-border">
                  {PREVIEW_ROWS.map((row) => {
                    const Icon = row.icon;
                    return (
                      <li
                        key={row.title}
                        className="py-4 first:pt-5 last:pb-1 flex items-start gap-3.5"
                      >
                        <div className="w-9 h-9 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Icon
                            className="w-[18px] h-[18px]"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-bm-text leading-snug">
                            {row.title}
                          </p>
                          <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-bm-text-muted">
                            {row.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* Section B — Three Core Features */}
      <section aria-label="Core wellness tools" className="pb-24 sm:pb-32">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CORE_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.step}
                  className="bm-card rounded-2xl p-7 flex flex-col justify-between transition-colors duration-150 hover:border-bm-sage dark:hover:border-bm-primary/45"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-xs font-medium tabular-nums tracking-widest text-bm-text-muted">
                        {feature.step}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center">
                        <Icon
                          className="w-[18px] h-[18px]"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    <h2 className="text-lg font-semibold tracking-tight text-bm-text">
                      {feature.title}
                    </h2>

                    <p className="mt-3 text-sm leading-relaxed text-bm-text-muted">
                      {feature.description}
                    </p>
                  </div>

                  <div className="mt-8 pt-5 border-t border-bm-border">
                    <button
                      type="button"
                      onClick={() => navigateTo(feature.view)}
                      className="group inline-flex items-center gap-2 text-sm font-medium text-bm-primary hover:text-bm-secondary dark:hover:text-bm-primary-hover transition-colors duration-150 whitespace-nowrap"
                    >
                      <span>{feature.cta}</span>
                      <ArrowRight
                        className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

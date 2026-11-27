import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Crosshair,
  ExternalLink,
  Globe,
  List,
  Loader2,
  Map as MapIcon,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { useBaymini } from '../../context/BayminiContext';
import type { DoctorProfile, UserLocation } from '../../types/baymini';
import {
  RADIUS_OPTIONS,
  SPECIALTY_OPTIONS,
  buildGoogleMapsDirectionsUrl,
  describeGeolocationFailure,
  formatDistanceKm,
  normalizeSpecialtyHint,
  type GeolocationErrorLike,
  type RadiusKm,
  type SpecialtyOption,
} from '../../utils/doctors';
import {
  fetchApproximateIpLocation,
  fetchMapsConfig,
  geocodeLocationQuery,
  reverseGeocodeCoordinates,
  searchNearbyDoctors,
} from '../../services/mapsApi';
import { DoctorsMap } from './DoctorsMap';
import { BookingDrawer } from './BookingDrawer';

export function DoctorsView() {
  const {
    theme,
    healthProfile,
    symptomAssessment,
    doctorSpecialtyHint,
    setDoctorSpecialtyHint,
    userLocation,
    setUserLocation,
    selectedDoctor,
    setSelectedDoctor,
    upcomingBookingsCount,
    openBookingsDrawer,
    showToast,
  } = useBaymini();

  const initialSpecialty = useMemo<SpecialtyOption>(() => {
    if (doctorSpecialtyHint) {
      return normalizeSpecialtyHint(doctorSpecialtyHint);
    }
    if (symptomAssessment?.recommendedSpecialty) {
      return normalizeSpecialtyHint(symptomAssessment.recommendedSpecialty);
    }
    return 'All Clinics';
  }, [doctorSpecialtyHint, symptomAssessment?.recommendedSpecialty]);

  const [activeSpecialty, setActiveSpecialty] =
    useState<SpecialtyOption>(initialSpecialty);
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(5);
  const [locationInput, setLocationInput] = useState(userLocation?.label || '');
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');

  // Maps API key config
  const [mapsApiKey, setMapsApiKey] = useState('');
  const [mapsConfigLoaded, setMapsConfigLoaded] = useState(false);

  // Search & Location loading/error states
  const [locatingGps, setLocatingGps] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [broadened, setBroadened] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Active map highlight & booking drawer state
  const [activeDoctorId, setActiveDoctorId] = useState<string | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<DoctorProfile | null>(null);
  const [triageBannerDismissed, setTriageBannerDismissed] = useState(false);

  const searchRequestSeqRef = useRef(0);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  // Keep specialty synced if user arrives from Symptoms Checker or Chatbot action chip
  useEffect(() => {
    if (doctorSpecialtyHint) {
      const normalized = normalizeSpecialtyHint(doctorSpecialtyHint);
      setActiveSpecialty(normalized);
      setTriageBannerDismissed(false);
    }
  }, [doctorSpecialtyHint]);

  // Keep input synced when persisted userLocation changes
  useEffect(() => {
    if (userLocation?.label) {
      setLocationInput(userLocation.label);
    }
  }, [userLocation?.label]);

  // Load Maps API key config once
  useEffect(() => {
    let mounted = true;
    fetchMapsConfig()
      .then((cfg) => {
        if (mounted) {
          setMapsApiKey(cfg.apiKey);
          setMapsConfigLoaded(true);
        }
      })
      .catch(() => {
        if (mounted) setMapsConfigLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const runSearch = useCallback(
    async (
      targetLocation: UserLocation,
      specialty: SpecialtyOption,
      radius: RadiusKm
    ) => {
      const seq = ++searchRequestSeqRef.current;
      setSearching(true);
      setSearchError(null);
      setBroadened(false);

      try {
        const result = await searchNearbyDoctors({
          lat: targetLocation.lat,
          lng: targetLocation.lng,
          specialty,
          radiusKm: radius,
        });
        if (seq !== searchRequestSeqRef.current) return;

        setDoctors(result.doctors);
        setBroadened(result.broadened);
        setHasSearched(true);
        setActiveDoctorId(null);
        setSelectedDoctor(null);
      } catch (err) {
        if (seq !== searchRequestSeqRef.current) return;
        setDoctors([]);
        setHasSearched(true);
        setSearchError(
          err instanceof Error
            ? err.message
            : 'Unable to load nearby clinics right now. Please try again.'
        );
      } finally {
        if (seq === searchRequestSeqRef.current) {
          setSearching(false);
        }
      }
    },
    [setSelectedDoctor]
  );

  // Trigger search automatically whenever userLocation, activeSpecialty, or radiusKm changes
  useEffect(() => {
    if (!userLocation) return;
    void runSearch(userLocation, activeSpecialty, radiusKm);
  }, [userLocation, activeSpecialty, radiusKm, runSearch]);

  const handleApproximateIpFallback = useCallback(
    async (gpsError: GeolocationErrorLike | null) => {
      try {
        const approxLocation = await fetchApproximateIpLocation(4000);
        if (approxLocation) {
          setUserLocation(approxLocation);
          setLocationInput(approxLocation.label);
          setLocationNotice(
            'Using approximate network location. For exact results, enable browser location or type your neighborhood above.'
          );
          showToast(`Using ${approxLocation.label}.`);
          return;
        }
      } catch {
        // Fall through to concise error guidance below
      }

      setLocationNotice(describeGeolocationFailure(gpsError));
      locationInputRef.current?.focus();
    },
    [setUserLocation, showToast]
  );

  const handleUseLiveLocation = () => {
    setLocationNotice(null);
    setLocatingGps(true);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      void handleApproximateIpFallback(null).finally(() => {
        setLocatingGps(false);
      });
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          try {
            const label = await reverseGeocodeCoordinates(lat, lng);
            const nextLoc: UserLocation = { lat, lng, label };
            setUserLocation(nextLoc);
            setLocationInput(label);
            showToast(`Location set to ${label}.`);
          } catch {
            const nextLoc: UserLocation = { lat, lng, label: 'Current Location' };
            setUserLocation(nextLoc);
            setLocationInput('Current Location');
          } finally {
            setLocatingGps(false);
          }
        },
        (err) => {
          void handleApproximateIpFallback({
            code: err.code,
            message: err.message,
          }).finally(() => {
            setLocatingGps(false);
          });
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    } catch (syncErr) {
      void handleApproximateIpFallback({
        message: syncErr instanceof Error ? syncErr.message : String(syncErr),
      }).finally(() => {
        setLocatingGps(false);
      });
    }
  };

  const handleManualLocationSearch = async (queryOverride?: string) => {
    const query = (queryOverride ?? locationInput).trim();
    if (query.length < 2) {
      setLocationNotice(
        'Please enter a neighborhood, area, or city name (for example, Dhanmondi, Dhaka).'
      );
      return;
    }

    setGeocoding(true);
    setLocationNotice(null);
    try {
      const result = await geocodeLocationQuery(query);
      if (!result.found || !result.location) {
        setLocationNotice(
          `No matching area found for "${query}". Try adding your city or country name.`
        );
        return;
      }
      setUserLocation(result.location);
      setLocationInput(result.location.label);
      showToast(`Searching near ${result.location.label}.`);
    } catch (err) {
      setLocationNotice(
        err instanceof Error
          ? err.message
          : 'Could not look up that location right now. Please try again.'
      );
    } finally {
      setGeocoding(false);
    }
  };

  const handleClearTriageFilter = () => {
    setDoctorSpecialtyHint(null);
    setActiveSpecialty('All Clinics');
    setTriageBannerDismissed(true);
  };

  const handleSelectDoctor = (doctor: DoctorProfile | null) => {
    const key = doctor ? doctor.id || doctor.name : null;
    setActiveDoctorId(key);
    setSelectedDoctor(doctor);
  };

  const handleOpenBooking = (doctor: DoctorProfile) => {
    setSelectedDoctor(doctor);
    setBookingDoctor(doctor);
  };

  const recommendedSpecialty = useMemo(() => {
    if (doctorSpecialtyHint) return normalizeSpecialtyHint(doctorSpecialtyHint);
    if (symptomAssessment?.recommendedSpecialty) {
      return normalizeSpecialtyHint(symptomAssessment.recommendedSpecialty);
    }
    return null;
  }, [doctorSpecialtyHint, symptomAssessment?.recommendedSpecialty]);

  const isEmergencyContext =
    activeSpecialty === 'Emergency Hospital' ||
    symptomAssessment?.urgencyLevel === 'emergency';

  const showTriageBanner =
    activeSpecialty === 'Emergency Hospital' ||
    (!triageBannerDismissed &&
      recommendedSpecialty !== null &&
      recommendedSpecialty !== 'All Clinics' &&
      activeSpecialty === recommendedSpecialty);

  return (
    <div className="pt-26 pb-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-bm-tint text-bm-primary px-3 py-1 text-xs font-semibold tracking-wide">
              Take Doc&apos;s Advice
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-bm-text">
              Find Nearby Doctors &amp; Clinics
            </h1>
            <p className="text-sm sm:text-base text-bm-text-muted leading-relaxed">
              Discover real nearby specialists, clinics, and hospitals on Google Maps, then schedule your visit with optional Google Calendar sync.
            </p>
          </div>

          <button
            type="button"
            onClick={openBookingsDrawer}
            className="self-start sm:self-auto rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition-colors shrink-0"
          >
            <Calendar className="w-4 h-4 text-bm-primary" strokeWidth={1.75} aria-hidden="true" />
            <span>
              My Bookings
              {upcomingBookingsCount > 0 ? ` (${upcomingBookingsCount})` : ''}
            </span>
          </button>
        </div>

        {/* Smart Triage / Emergency Context Banner */}
        {showTriageBanner && (
          <div
            role={isEmergencyContext ? 'alert' : 'status'}
            className={`rounded-2xl border px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isEmergencyContext
                ? 'border-bm-emergency/45 bg-bm-emergency/10'
                : 'border-bm-primary/25 bg-bm-tint/65'
            }`}
          >
            <div className="flex items-start gap-3">
              {isEmergencyContext ? (
                <ShieldAlert
                  className="w-5 h-5 text-bm-emergency dark:text-[#F27474] shrink-0 mt-0.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              ) : (
                <Sparkles
                  className="w-5 h-5 text-bm-primary shrink-0 mt-0.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )}
              <div className="text-sm leading-relaxed">
                {isEmergencyContext ? (
                  <p className="text-bm-text">
                    <span className="font-semibold text-bm-emergency dark:text-[#F27474]">
                      Urgent care priority:
                    </span>{' '}
                    Showing nearby emergency hospitals first. If symptoms are severe or worsening right now, call your local emergency number immediately.
                  </p>
                ) : (
                  <p className="text-bm-text">
                    Filtered for{' '}
                    <span className="font-semibold text-bm-primary">
                      {recommendedSpecialty}
                    </span>{' '}
                    based on your recent Baymini check.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearTriageFilter}
              className="self-start sm:self-auto rounded-full border border-bm-border bg-bm-surface hover:bg-bm-surface-subtle text-bm-text px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        {/* Dual-Mode Location & Filter Control Card */}
        <section
          aria-label="Location and specialty filters"
          className="rounded-2xl border border-bm-border bg-bm-surface p-4 sm:p-5 space-y-4"
        >
          {/* Location Bar */}
          <div className="flex flex-col md:flex-row gap-2.5">
            <button
              type="button"
              onClick={handleUseLiveLocation}
              disabled={locatingGps || geocoding}
              className="rounded-full bg-bm-primary hover:bg-bm-primary-hover disabled:opacity-60 text-white dark:text-[#0D1813] px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shrink-0"
            >
              {locatingGps ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Crosshair className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              <span>
                {locatingGps ? 'Detecting Location...' : 'Use My Live Location'}
              </span>
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleManualLocationSearch();
              }}
              className="flex-1 flex gap-2"
            >
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-bm-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <input
                  ref={locationInputRef}
                  type="text"
                  value={locationInput}
                  onChange={(e) => {
                    setLocationInput(e.target.value);
                    if (locationNotice) setLocationNotice(null);
                  }}
                  placeholder="Search area or city (e.g., Dhanmondi, Dhaka)"
                  aria-label="Search area or city"
                  className="w-full rounded-full border border-bm-border bg-bm-surface-subtle pl-10 pr-4 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted focus:border-bm-primary transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={geocoding || locatingGps}
                className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-60"
              >
                {geocoding ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                ) : null}
                <span>Search</span>
              </button>
            </form>
          </div>

          {/* Saved Profile Region quick helper when no location yet */}
          {!userLocation && healthProfile?.region && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-bm-text-muted">
              <span>Quick start from your Health Profile:</span>
              <button
                type="button"
                onClick={() => void handleManualLocationSearch(healthProfile.region)}
                className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-primary font-semibold px-3 py-1 transition-colors"
              >
                Search {healthProfile.region}
              </button>
            </div>
          )}

          {/* Calm Location Notice (Approximate network fallback, GPS error, or geocode miss) */}
          {locationNotice && (
            <div
              role="status"
              className="rounded-xl border border-bm-prompt/35 bg-bm-surface-subtle px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-bm-text leading-relaxed"
            >
              <AlertCircle
                className="w-4 h-4 text-bm-prompt dark:text-[#E8A559] shrink-0 mt-0.5"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>{locationNotice}</span>
            </div>
          )}

          {/* Specialty Pill Strip + Radius Selector */}
          <div className="pt-3 border-t border-bm-border flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div
              className="min-w-0 flex-1 flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 pr-2"
              role="group"
              aria-label="Medical specialty filter"
            >
              {SPECIALTY_OPTIONS.map((spec) => {
                const isActive = activeSpecialty === spec;
                const isEmergencyPill = spec === 'Emergency Hospital';
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => {
                      setActiveSpecialty(spec);
                      if (spec === 'All Clinics') {
                        setDoctorSpecialtyHint(null);
                      }
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                      isActive
                        ? isEmergencyPill
                          ? 'border-bm-emergency bg-bm-emergency text-white'
                          : 'border-bm-primary bg-bm-primary text-white dark:text-[#0D1813]'
                        : isEmergencyPill
                          ? 'border-bm-emergency/35 bg-bm-surface text-bm-emergency dark:text-[#F27474] hover:bg-bm-emergency/10'
                          : 'border-bm-border bg-bm-surface text-bm-text-muted hover:text-bm-text hover:bg-bm-tint'
                    }`}
                  >
                    {spec}
                  </button>
                );
              })}
            </div>

            {/* Radius Selector */}
            <div className="flex items-center gap-2 shrink-0 lg:border-l lg:border-bm-border lg:pl-3.5">
              <span className="text-xs font-medium text-bm-text-muted">Radius:</span>
              <div className="inline-flex rounded-full border border-bm-border bg-bm-surface-subtle p-0.5">
                {RADIUS_OPTIONS.map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => setRadiusKm(km)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      radiusKm === km
                        ? 'bg-bm-surface text-bm-primary shadow-xs'
                        : 'text-bm-text-muted hover:text-bm-text'
                    }`}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Broadening Fallback Notice */}
        {broadened && !searching && doctors.length > 0 && (
          <div className="rounded-xl border border-bm-border bg-bm-surface px-4 py-2.5 text-xs text-bm-text-muted flex items-center gap-2">
            <AlertCircle
              className="w-4 h-4 text-bm-primary shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span>
              Limited <strong className="text-bm-text">{activeSpecialty}</strong> listings found nearby — showing nearby general clinics and hospitals as well.
            </span>
          </div>
        )}

        {/* Mobile Segmented Toggle (List View | Map View) */}
        {userLocation && (
          <div className="lg:hidden">
            <div className="grid grid-cols-2 gap-1.5 rounded-full border border-bm-border bg-bm-surface p-1">
              <button
                type="button"
                onClick={() => setMobileTab('list')}
                className={`rounded-full py-2 px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  mobileTab === 'list'
                    ? 'bg-bm-tint text-bm-primary'
                    : 'text-bm-text-muted hover:text-bm-text'
                }`}
              >
                <List className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>List View ({doctors.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('map')}
                className={`rounded-full py-2 px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  mobileTab === 'map'
                    ? 'bg-bm-tint text-bm-primary'
                    : 'text-bm-text-muted hover:text-bm-text'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Map View</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content: Empty Pre-Location State OR Split List + Interactive Map */}
        {!userLocation ? (
          <div className="rounded-2xl border border-bm-border bg-bm-surface p-8 sm:p-12 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-bm-tint text-bm-primary flex items-center justify-center">
              <MapPin className="w-6 h-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-bm-text">
                Choose a location to explore real clinics nearby
              </h2>
              <p className="text-sm text-bm-text-muted leading-relaxed">
                Click <strong className="text-bm-text">Use My Live Location</strong> or enter any neighborhood or city above to see verified clinics, distance estimates, and map pins.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              {['Dhanmondi, Dhaka', 'Gulshan, Dhaka', 'London, UK', 'New York, NY'].map(
                (sampleArea) => (
                  <button
                    key={sampleArea}
                    type="button"
                    onClick={() => void handleManualLocationSearch(sampleArea)}
                    className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-text text-xs font-medium px-3.5 py-1.5 transition-colors"
                  >
                    Try {sampleArea}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column (~45% -> 5/12): Scrollable Clinic List */}
            <div
              className={`lg:col-span-5 space-y-3 ${
                mobileTab === 'map' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="flex items-center justify-between px-1 text-xs text-bm-text-muted">
                <span>
                  {searching
                    ? 'Searching nearby places...'
                    : `${doctors.length} ${doctors.length === 1 ? 'place' : 'places'} near ${userLocation.label}`}
                </span>
                {selectedDoctor && (
                  <span className="truncate max-w-[180px] text-bm-primary font-medium">
                    Selected: {selectedDoctor.name}
                  </span>
                )}
              </div>

              {searching ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="rounded-2xl border border-bm-border bg-bm-surface p-4 space-y-3 animate-pulse"
                    >
                      <div className="h-4 w-24 rounded-full bg-bm-surface-subtle" />
                      <div className="h-5 w-3/4 rounded-lg bg-bm-surface-subtle" />
                      <div className="h-3.5 w-full rounded-lg bg-bm-surface-subtle" />
                      <div className="h-9 w-full rounded-full bg-bm-surface-subtle" />
                    </div>
                  ))}
                </div>
              ) : searchError ? (
                <div className="rounded-2xl border border-bm-border bg-bm-surface p-6 text-center space-y-3">
                  <AlertCircle
                    className="w-7 h-7 text-bm-prompt mx-auto"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-semibold text-bm-text">
                    Could not load nearby clinics
                  </h3>
                  <p className="text-sm text-bm-text-muted leading-relaxed">
                    {searchError}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void runSearch(userLocation, activeSpecialty, radiusKm)
                    }
                    className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] text-xs font-semibold px-4 py-2 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>Retry Search</span>
                  </button>
                </div>
              ) : hasSearched && doctors.length === 0 ? (
                <div className="rounded-2xl border border-bm-border bg-bm-surface p-6 text-center space-y-3">
                  <MapPin
                    className="w-7 h-7 text-bm-text-muted mx-auto"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-semibold text-bm-text">
                    No matching clinics found within {radiusKm} km
                  </h3>
                  <p className="text-sm text-bm-text-muted leading-relaxed">
                    Try expanding your search radius or switching to All Clinics to see nearby medical centers.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {radiusKm < 10 && (
                      <button
                        type="button"
                        onClick={() => setRadiusKm(10)}
                        className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] text-xs font-semibold px-4 py-2 transition-colors"
                      >
                        Expand Radius to 10 km
                      </button>
                    )}
                    {activeSpecialty !== 'All Clinics' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSpecialty('All Clinics');
                          setDoctorSpecialtyHint(null);
                        }}
                        className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-text text-xs font-semibold px-4 py-2 transition-colors"
                      >
                        Show All Clinics
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
                  {doctors.map((doctor) => {
                    const docKey = doctor.id || doctor.name;
                    const isHighlighted = activeDoctorId === docKey;
                    const isRecommendedMatch =
                      Boolean(recommendedSpecialty) &&
                      recommendedSpecialty !== 'All Clinics' &&
                      doctor.specialty.toLowerCase() ===
                        recommendedSpecialty?.toLowerCase();

                    return (
                      <article
                        key={docKey}
                        onClick={() => handleSelectDoctor(doctor)}
                        className={`rounded-2xl border p-4 space-y-3 cursor-pointer transition-colors ${
                          isHighlighted
                            ? 'border-bm-primary bg-bm-tint/40'
                            : 'border-bm-border bg-bm-surface hover:border-bm-primary/45'
                        }`}
                      >
                        {/* Badges */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center rounded-full bg-bm-tint text-bm-primary px-2.5 py-0.5 text-[11px] font-semibold">
                              {doctor.specialty}
                            </span>
                            {isRecommendedMatch && (
                              <span className="inline-flex items-center rounded-full border border-bm-primary/30 bg-bm-surface px-2.5 py-0.5 text-[11px] font-semibold text-bm-primary">
                                Recommended match
                              </span>
                            )}
                          </div>

                          {typeof doctor.isOpen === 'boolean' && (
                            <span
                              className={`text-[11px] font-semibold ${
                                doctor.isOpen
                                  ? 'text-bm-primary'
                                  : 'text-bm-text-muted'
                              }`}
                            >
                              {doctor.isOpen ? 'Open now' : 'Closed'}
                            </span>
                          )}
                        </div>

                        {/* Name & Address */}
                        <div>
                          <h3 className="text-base font-semibold text-bm-text leading-snug">
                            {doctor.name}
                          </h3>
                          <p className="text-xs text-bm-text-muted mt-1 leading-relaxed flex items-start gap-1.5">
                            <MapPin
                              className="w-3.5 h-3.5 shrink-0 mt-0.5"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <span>{doctor.address}</span>
                          </p>
                        </div>

                        {/* Metadata Row: Distance, Real Rating, Real Phone/Website */}
                        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-bm-text-muted">
                          {typeof doctor.distanceKm === 'number' && (
                            <span className="font-semibold text-bm-text tabular-nums">
                              {formatDistanceKm(doctor.distanceKm)}
                            </span>
                          )}

                          {typeof doctor.rating === 'number' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-bm-text tabular-nums">
                              <Star
                                className="w-3.5 h-3.5 fill-bm-prompt text-bm-prompt"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              <span>{doctor.rating.toFixed(1)}</span>
                              {typeof doctor.reviewCount === 'number' && (
                                <span className="font-normal text-bm-text-muted">
                                  ({doctor.reviewCount})
                                </span>
                              )}
                            </span>
                          )}

                          {doctor.phone && (
                            <a
                              href={`tel:${doctor.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 hover:text-bm-primary transition-colors"
                            >
                              <Phone className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                              <span>{doctor.phone}</span>
                            </a>
                          )}

                          {doctor.website && (
                            <a
                              href={doctor.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 hover:text-bm-primary transition-colors"
                            >
                              <Globe className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                              <span>Website</span>
                            </a>
                          )}
                        </div>

                        {/* Card CTA Row */}
                        <div className="pt-2 border-t border-bm-border flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBooking(doctor);
                            }}
                            className="flex-1 rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] text-xs sm:text-sm font-semibold py-2 px-4 transition-colors"
                          >
                            Book Appointment
                          </button>

                          <a
                            href={buildGoogleMapsDirectionsUrl(doctor)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-text text-xs sm:text-sm font-medium py-2 px-3.5 inline-flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            <span>Directions</span>
                            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column (~55% -> 7/12): Sticky Interactive Google Map */}
            <div
              className={`lg:col-span-7 lg:sticky lg:top-24 ${
                mobileTab === 'list' ? 'hidden lg:block' : 'block'
              }`}
            >
              {mapsConfigLoaded ? (
                <DoctorsMap
                  apiKey={mapsApiKey}
                  theme={theme}
                  userLocation={userLocation}
                  doctors={doctors}
                  activeDoctorId={activeDoctorId}
                  isEmergencyMode={isEmergencyContext}
                  onSelectDoctor={handleSelectDoctor}
                  onBookDoctor={handleOpenBooking}
                />
              ) : (
                <div className="w-full h-[420px] lg:h-[600px] rounded-2xl border border-bm-border bg-bm-surface flex items-center justify-center">
                  <Loader2
                    className="w-6 h-6 animate-spin text-bm-primary"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Booking Slide-Over Drawer */}
      <BookingDrawer
        doctor={bookingDoctor}
        onClose={() => setBookingDoctor(null)}
      />
    </div>
  );
}

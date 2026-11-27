import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ActiveView,
  AppointmentBooking,
  ChatMessage,
  DoctorProfile,
  HealthPlan,
  HealthProfile,
  PersistedBayminiState,
  SymptomAssessment,
  ThemeMode,
  ToastItem,
  UserLocation,
} from '../types/baymini';
import {
  clearSessionState,
  countUpcomingBookings,
  createInitialSessionState,
  loadSessionState,
  resolveInitialTheme,
  saveSessionState,
  saveThemePreference,
} from '../utils/storage';

interface BayminiContextValue {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  navigateTo: (view: ActiveView) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  healthProfile: HealthProfile | null;
  setHealthProfile: (profile: HealthProfile | null) => void;
  healthPlan: HealthPlan | null;
  setHealthPlan: (plan: HealthPlan | null) => void;
  symptomAssessment: SymptomAssessment | null;
  setSymptomAssessment: (assessment: SymptomAssessment | null) => void;
  doctorSpecialtyHint: string | null;
  setDoctorSpecialtyHint: (specialty: string | null) => void;
  navigateToDoctorsWithSpecialty: (specialty: string) => void;
  userLocation: UserLocation | null;
  setUserLocation: (location: UserLocation | null) => void;
  selectedDoctor: DoctorProfile | null;
  setSelectedDoctor: (doctor: DoctorProfile | null) => void;
  bookings: AppointmentBooking[];
  upcomingBookingsCount: number;
  addBooking: (booking: AppointmentBooking) => void;
  updateBooking: (
    id: string,
    updates: Partial<AppointmentBooking>
  ) => void;
  cancelBooking: (id: string) => void;
  isBookingsDrawerOpen: boolean;
  openBookingsDrawer: () => void;
  closeBookingsDrawer: () => void;
  mapsQuotaExceeded: boolean;
  dismissMapsQuotaBanner: () => void;
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  clearChatMessages: () => void;
  clearAllSessionData: () => void;
  toasts: ToastItem[];
  showToast: (message: string) => void;
  dismissToast: (id: string) => void;
}

const BayminiContext = createContext<BayminiContextValue | undefined>(undefined);

export function BayminiProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [theme, setThemeState] = useState<ThemeMode>(() => resolveInitialTheme());
  const [session, setSession] = useState<PersistedBayminiState>(() =>
    loadSessionState()
  );
  const [isBookingsDrawerOpen, setIsBookingsDrawerOpen] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    saveSessionState(session);
  }, [session]);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const navigateTo = useCallback((view: ActiveView) => {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setHealthProfile = useCallback((healthProfile: HealthProfile | null) => {
    setSession((prev) => ({ ...prev, healthProfile }));
  }, []);

  const setHealthPlan = useCallback((healthPlan: HealthPlan | null) => {
    setSession((prev) => ({ ...prev, healthPlan }));
  }, []);

  const setSymptomAssessment = useCallback(
    (symptomAssessment: SymptomAssessment | null) => {
      setSession((prev) => ({ ...prev, symptomAssessment }));
    },
    []
  );

  const setDoctorSpecialtyHint = useCallback((doctorSpecialtyHint: string | null) => {
    const cleaned = doctorSpecialtyHint?.trim() || null;
    setSession((prev) => ({ ...prev, doctorSpecialtyHint: cleaned }));
  }, []);

  const navigateToDoctorsWithSpecialty = useCallback(
    (specialty: string) => {
      const cleaned = specialty.trim();
      if (cleaned) {
        setSession((prev) => ({ ...prev, doctorSpecialtyHint: cleaned }));
      }
      navigateTo('doctors');
    },
    [navigateTo]
  );

  const setUserLocation = useCallback((userLocation: UserLocation | null) => {
    setSession((prev) => ({ ...prev, userLocation }));
  }, []);

  const setSelectedDoctor = useCallback(
    (selectedDoctor: DoctorProfile | null) => {
      setSession((prev) => ({ ...prev, selectedDoctor }));
    },
    []
  );

  const addBooking = useCallback((booking: AppointmentBooking) => {
    setSession((prev) => ({
      ...prev,
      bookings: [booking, ...prev.bookings],
    }));
  }, []);

  const updateBooking = useCallback(
    (id: string, updates: Partial<AppointmentBooking>) => {
      setSession((prev) => ({
        ...prev,
        bookings: prev.bookings.map((booking) =>
          booking.id === id ? { ...booking, ...updates } : booking
        ),
      }));
    },
    []
  );

  const cancelBooking = useCallback((id: string) => {
    setSession((prev) => ({
      ...prev,
      bookings: prev.bookings.map((booking) =>
        booking.id === id ? { ...booking, status: 'cancelled' } : booking
      ),
    }));
  }, []);

  const addChatMessage = useCallback((message: ChatMessage) => {
    setSession((prev) => ({
      ...prev,
      chatMessages: [...prev.chatMessages, message],
    }));
  }, []);

  const setChatMessages = useCallback((chatMessages: ChatMessage[]) => {
    setSession((prev) => ({ ...prev, chatMessages }));
  }, []);

  const clearChatMessages = useCallback(() => {
    setSession((prev) => ({ ...prev, chatMessages: [] }));
  }, []);

  const openBookingsDrawer = useCallback(() => {
    setIsBookingsDrawerOpen(true);
  }, []);

  const closeBookingsDrawer = useCallback(() => {
    setIsBookingsDrawerOpen(false);
  }, []);

  const dismissMapsQuotaBanner = useCallback(() => {
    setMapsQuotaExceeded(false);
  }, []);

  const clearAllSessionData = useCallback(() => {
    clearSessionState();
    setSession(createInitialSessionState());
    setIsBookingsDrawerOpen(false);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message }]);
      const timer = setTimeout(() => {
        dismissToast(id);
      }, 3600);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  const upcomingBookingsCount = useMemo(
    () => countUpcomingBookings(session.bookings),
    [session.bookings]
  );

  const value = useMemo<BayminiContextValue>(
    () => ({
      activeView,
      setActiveView,
      navigateTo,
      theme,
      setTheme,
      toggleTheme,
      healthProfile: session.healthProfile,
      setHealthProfile,
      healthPlan: session.healthPlan,
      setHealthPlan,
      symptomAssessment: session.symptomAssessment,
      setSymptomAssessment,
      doctorSpecialtyHint: session.doctorSpecialtyHint,
      setDoctorSpecialtyHint,
      navigateToDoctorsWithSpecialty,
      userLocation: session.userLocation,
      setUserLocation,
      selectedDoctor: session.selectedDoctor,
      setSelectedDoctor,
      bookings: session.bookings,
      upcomingBookingsCount,
      addBooking,
      updateBooking,
      cancelBooking,
      isBookingsDrawerOpen,
      openBookingsDrawer,
      closeBookingsDrawer,
      mapsQuotaExceeded,
      dismissMapsQuotaBanner,
      chatMessages: session.chatMessages,
      addChatMessage,
      setChatMessages,
      clearChatMessages,
      clearAllSessionData,
      toasts,
      showToast,
      dismissToast,
    }),
    [
      activeView,
      navigateTo,
      theme,
      setTheme,
      toggleTheme,
      session,
      setHealthProfile,
      setHealthPlan,
      setSymptomAssessment,
      setDoctorSpecialtyHint,
      navigateToDoctorsWithSpecialty,
      setUserLocation,
      setSelectedDoctor,
      upcomingBookingsCount,
      addBooking,
      updateBooking,
      cancelBooking,
      isBookingsDrawerOpen,
      openBookingsDrawer,
      closeBookingsDrawer,
      mapsQuotaExceeded,
      dismissMapsQuotaBanner,
      addChatMessage,
      setChatMessages,
      clearChatMessages,
      clearAllSessionData,
      toasts,
      showToast,
      dismissToast,
    ]
  );

  return (
    <BayminiContext.Provider value={value}>{children}</BayminiContext.Provider>
  );
}

export function useBaymini(): BayminiContextValue {
  const ctx = useContext(BayminiContext);
  if (!ctx) {
    throw new Error('useBaymini must be used within a BayminiProvider');
  }
  return ctx;
}

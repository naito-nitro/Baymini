import type { DoctorProfile, UserLocation } from '../types/baymini';

export interface MapsConfigResponse {
  configured: boolean;
  apiKey: string;
}

export interface SearchPlacesResponse {
  doctors: DoctorProfile[];
  broadened: boolean;
  specialtySearched: string;
}

function notifyQuotaExceeded() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

export async function fetchMapsConfig(): Promise<MapsConfigResponse> {
  const clientEnvKey =
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env?.VITE_GOOGLE_MAPS_API_KEY || '';

  try {
    const response = await fetch('/api/maps/config');
    if (response.ok) {
      const data = (await response.json()) as Partial<MapsConfigResponse>;
      const resolvedKey = (data.apiKey || clientEnvKey || '').trim();
      return {
        configured: Boolean(resolvedKey),
        apiKey: resolvedKey,
      };
    }
  } catch {
    // Fall back to client env var if available
  }

  const trimmed = clientEnvKey.trim();
  return {
    configured: Boolean(trimmed),
    apiKey: trimmed,
  };
}

export async function geocodeLocationQuery(
  query: string
): Promise<{ found: boolean; location: UserLocation | null }> {
  const response = await fetch('/api/maps/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    found?: boolean;
    location?: UserLocation | null;
    error?: string;
    quotaExceeded?: boolean;
  };

  if (response.status === 429 || data.quotaExceeded) {
    notifyQuotaExceeded();
    throw new Error(
      data.error || 'Google Maps daily quota limit reached. Please try again later.'
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error || 'Could not locate that area. Please try a nearby city or neighborhood.'
    );
  }

  return {
    found: Boolean(data.found && data.location),
    location: data.location || null,
  };
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<string> {
  const response = await fetch('/api/maps/reverse-geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    label?: string;
    error?: string;
    quotaExceeded?: boolean;
  };

  if (response.status === 429 || data.quotaExceeded) {
    notifyQuotaExceeded();
    return 'Current Location';
  }

  return data.label || 'Current Location';
}

export async function searchNearbyDoctors(params: {
  lat: number;
  lng: number;
  specialty: string;
  radiusKm: number;
}): Promise<SearchPlacesResponse> {
  const response = await fetch('/api/maps/search-places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as {
    doctors?: DoctorProfile[];
    broadened?: boolean;
    specialtySearched?: string;
    error?: string;
    quotaExceeded?: boolean;
  };

  if (response.status === 429 || data.quotaExceeded) {
    notifyQuotaExceeded();
    throw new Error(
      data.error || 'Google Maps daily quota limit reached. Please try again later.'
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error || 'Could not load nearby clinics right now. Please try again.'
    );
  }

  return {
    doctors: Array.isArray(data.doctors) ? data.doctors : [],
    broadened: Boolean(data.broadened),
    specialtySearched: data.specialtySearched || params.specialty,
  };
}

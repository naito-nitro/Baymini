import { useEffect } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Navigation, Star } from 'lucide-react';
import { GOOGLE_MAPS_ATTRIBUTION_ID } from '../../config/integrations';
import type { DoctorProfile, ThemeMode, UserLocation } from '../../types/baymini';
import {
  buildGoogleMapsDirectionsUrl,
  formatDistanceKm,
} from '../../utils/doctors';

interface DoctorsMapProps {
  apiKey: string;
  theme: ThemeMode;
  userLocation: UserLocation | null;
  doctors: DoctorProfile[];
  activeDoctorId: string | null;
  isEmergencyMode: boolean;
  onSelectDoctor: (doctor: DoctorProfile | null) => void;
  onBookDoctor: (doctor: DoctorProfile) => void;
}

const DEFAULT_CENTER = { lat: 23.7461, lng: 90.3742 };

function MapCameraSync({
  userLocation,
  doctors,
  activeDoctor,
}: {
  userLocation: UserLocation | null;
  doctors: DoctorProfile[];
  activeDoctor: DoctorProfile | null;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');

  useEffect(() => {
    if (!map) return;

    if (
      activeDoctor &&
      typeof activeDoctor.lat === 'number' &&
      typeof activeDoctor.lng === 'number'
    ) {
      map.panTo({ lat: activeDoctor.lat, lng: activeDoctor.lng });
      const currentZoom = map.getZoom();
      if (typeof currentZoom === 'number' && currentZoom < 14) {
        map.setZoom(14);
      }
      return;
    }

    if (doctors.length > 0 && coreLib) {
      const bounds = new coreLib.LatLngBounds();
      if (userLocation) {
        bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
      }
      let validCount = 0;
      for (const doc of doctors) {
        if (typeof doc.lat === 'number' && typeof doc.lng === 'number') {
          bounds.extend({ lat: doc.lat, lng: doc.lng });
          validCount++;
        }
      }
      if (validCount > 0) {
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      }
      return;
    }

    if (userLocation) {
      map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
      map.setZoom(13);
    }
  }, [map, coreLib, userLocation, doctors, activeDoctor]);

  return null;
}

function ClinicMarkerWithInfoWindow({
  doctor,
  isSelected,
  isEmergency,
  onSelect,
  onClose,
  onBook,
}: {
  doctor: DoctorProfile;
  isSelected: boolean;
  isEmergency: boolean;
  onSelect: () => void;
  onClose: () => void;
  onBook: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  if (typeof doctor.lat !== 'number' || typeof doctor.lng !== 'number') {
    return null;
  }

  const pinBg = isEmergency
    ? '#C93B3B'
    : isSelected
      ? '#1B4332'
      : '#2D6A4F';
  const pinBorder = isEmergency
    ? '#8F2424'
    : isSelected
      ? '#0D1813'
      : '#1B4332';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: doctor.lat, lng: doctor.lng }}
        title={doctor.name}
        zIndex={isSelected ? 30 : 10}
        onClick={onSelect}
      >
        <Pin
          background={pinBg}
          borderColor={pinBorder}
          glyphColor="#FFFFFF"
          scale={isSelected ? 1.25 : 1}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={270}
          onCloseClick={onClose}
        >
          <div className="p-1 text-[#13221B] space-y-2 font-sans">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#2D6A4F]">
                {doctor.specialty}
              </p>
              <h4 className="text-sm font-semibold leading-snug text-[#13221B] mt-0.5">
                {doctor.name}
              </h4>
            </div>

            <p className="text-xs text-[#4F6158] leading-relaxed">
              {doctor.address}
            </p>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#4F6158]">
              {typeof doctor.distanceKm === 'number' && (
                <span className="font-medium text-[#13221B]">
                  {formatDistanceKm(doctor.distanceKm)}
                </span>
              )}
              {typeof doctor.rating === 'number' && (
                <span className="inline-flex items-center gap-1 font-medium text-[#13221B]">
                  <Star
                    className="w-3 h-3 fill-[#C27803] text-[#C27803]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>{doctor.rating.toFixed(1)}</span>
                  {typeof doctor.reviewCount === 'number' && (
                    <span className="text-[#4F6158] font-normal">
                      ({doctor.reviewCount})
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={onBook}
                className="flex-1 rounded-full bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-semibold px-3 py-1.5 transition-colors"
              >
                Book Appointment
              </button>
              <a
                href={buildGoogleMapsDirectionsUrl(doctor)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[#DDE5DF] bg-[#F6F8F5] hover:bg-[#EAF3EE] text-[#13221B] text-xs font-medium px-2.5 py-1.5 inline-flex items-center gap-1 transition-colors"
              >
                <span>Directions</span>
                <ExternalLink className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function DoctorsMap({
  apiKey,
  theme,
  userLocation,
  doctors,
  activeDoctorId,
  isEmergencyMode,
  onSelectDoctor,
  onBookDoctor,
}: DoctorsMapProps) {
  const activeDoctor =
    doctors.find((d) => (d.id || d.name) === activeDoctorId) || null;
  const center = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : DEFAULT_CENTER;

  if (!apiKey) {
    return (
      <div className="w-full h-[420px] lg:h-[600px] rounded-2xl border border-bm-border bg-bm-surface flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-bm-tint text-bm-primary flex items-center justify-center mb-4">
          <MapPin className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-bm-text">
          Interactive Map Unavailable
        </h3>
        <p className="text-sm text-bm-text-muted max-w-sm mt-2 leading-relaxed">
          Google Maps is still loading or not configured for this environment. You can continue using the clinic list and external Directions links.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[420px] lg:h-[600px] rounded-2xl overflow-hidden border border-bm-border bg-bm-surface">
      <APIProvider apiKey={apiKey} libraries={['marker']}>
        <GoogleMap
          key={`baymini-map-${theme}`}
          mapId="DEMO_MAP_ID"
          colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
          defaultCenter={center}
          defaultZoom={userLocation ? 13 : 12}
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
          internalUsageAttributionIds={[GOOGLE_MAPS_ATTRIBUTION_ID]}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCameraSync
            userLocation={userLocation}
            doctors={doctors}
            activeDoctor={activeDoctor}
          />

          {/* Distinct User Location Marker */}
          {userLocation && (
            <AdvancedMarker
              position={{ lat: userLocation.lat, lng: userLocation.lng }}
              title={`Your search area: ${userLocation.label}`}
              zIndex={40}
            >
              <div className="relative flex items-center justify-center">
                <span className="w-7 h-7 rounded-full bg-bm-primary/20 border border-bm-primary/40 flex items-center justify-center">
                  <span className="w-3.5 h-3.5 rounded-full bg-bm-primary border-2 border-white shadow-sm" />
                </span>
              </div>
            </AdvancedMarker>
          )}

          {/* Real Clinic & Hospital Markers */}
          {doctors.map((doctor) => {
            const docKey = doctor.id || doctor.name;
            return (
              <ClinicMarkerWithInfoWindow
                key={docKey}
                doctor={doctor}
                isSelected={activeDoctorId === docKey}
                isEmergency={
                  isEmergencyMode ||
                  doctor.specialty.toLowerCase().includes('emergency')
                }
                onSelect={() => onSelectDoctor(doctor)}
                onClose={() => onSelectDoctor(null)}
                onBook={() => onBookDoctor(doctor)}
              />
            );
          })}
        </GoogleMap>
      </APIProvider>

      {/* Subtle floating area badge on map */}
      {userLocation && (
        <div className="pointer-events-none absolute top-3 left-3 max-w-[85%] rounded-full border border-bm-border bg-white/90 dark:bg-[#101E17]/90 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-bm-text inline-flex items-center gap-1.5 shadow-sm">
          <Navigation
            className="w-3.5 h-3.5 text-bm-primary shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">{userLocation.label}</span>
        </div>
      )}
    </div>
  );
}

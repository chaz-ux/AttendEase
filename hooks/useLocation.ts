import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { haversineDistance } from '../lib/geofence';

export interface LocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

export interface GeofenceCheck {
  inside: boolean;
  distanceMeters: number;
  accuracy: number | null;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    loading: false,
    error: null,
  });

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  };

  const getCurrentLocation = useCallback(async (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));

    const granted = await requestPermission();
    if (!granted) {
      const err = 'Location permission denied';
      setLocation(prev => ({ ...prev, loading: false, error: err }));
      throw new Error(err);
    }

    const result = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    const { latitude: lat, longitude: lng, accuracy } = result.coords;

    setLocation({
      lat,
      lng,
      accuracy: accuracy ?? null,
      loading: false,
      error: null,
    });

    return { lat, lng, accuracy: accuracy ?? 999 };
  }, []);

  const checkInsideGeofence = useCallback(async (
    centerLat: number,
    centerLng: number,
    radiusMeters: number
  ): Promise<GeofenceCheck> => {
    const { lat, lng, accuracy } = await getCurrentLocation();
    const distanceMeters = haversineDistance(lat, lng, centerLat, centerLng);
    const inside = distanceMeters <= radiusMeters + 10; // 10m GPS drift buffer
    return { inside, distanceMeters, accuracy };
  }, [getCurrentLocation]);

  return {
    location,
    getCurrentLocation,
    checkInsideGeofence,
  };
}
import * as Location from 'expo-location';

export interface GeofenceResult {
  inside: boolean;
  distanceMeters: number;
  accuracy: number | null;
  coords: { lat: number; lng: number };
}

// Haversine formula — gives straight-line distance between two GPS points
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function checkGeofence(
  classroomLat: number,
  classroomLng: number,
  radiusMeters: number
): Promise<GeofenceResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied');
  }

  // High accuracy mode — important for indoor/campus use
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });

  const { latitude: lat, longitude: lng, accuracy } = location.coords;

  const distanceMeters = haversineDistance(lat, lng, classroomLat, classroomLng);

  // Client-side pre-check (server will re-verify before logging)
  // We add a 10m buffer for GPS drift — server is stricter
  const inside = distanceMeters <= radiusMeters + 10;

  return { inside, distanceMeters, accuracy, coords: { lat, lng } };
}
// Get lecturer's current position to use as geofence center when starting a session
export async function getCurrentPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });

  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 999,
  };
}
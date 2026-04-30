// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'lecturer' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  reg_number?: string;   // students only
  device_id?: string;
}

// ─── Units & Classrooms ───────────────────────────────────────────────────────

export interface Classroom {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  lecturer_id: string;
  classroom_id: string | null;
  classrooms: Classroom | null;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  unit_id: string;
  classroom_id: string | null;
  lecturer_id: string;
  started_at: string;
  ended_at: string | null;
  attendance_open: boolean;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  // joined
  units?: { code: string; name: string };
  classrooms?: { name: string };
  profiles?: { full_name: string };
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface AttendanceLog {
  id: string;
  session_id: string;
  student_id: string;
  checked_in_at: string;
  is_verified: boolean;
  distance_meters: number;
  device_id?: string;
  // joined
  profiles?: { full_name: string; reg_number: string };
  sessions?: Partial<Session>;
}

// ─── Geofence ─────────────────────────────────────────────────────────────────

export interface GeofenceResult {
  inside: boolean;
  distanceMeters: number;
  accuracy: number | null;
  coords: { lat: number; lng: number };
}
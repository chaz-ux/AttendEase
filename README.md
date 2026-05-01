# AttendEase - Cross-Platform GPS Attendance Tracking System

![React Native](https://img.shields.io/badge/React%20Native-0.76.9-61dafb?logo=react)
![Expo](https://img.shields.io/badge/Expo-52.0.0-000020?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)

A modern attendance tracking solution for educational institutions, enabling lecturers to start GPS-based sessions and students to check in via biometric verification or password-protected sign-in.

## 📱 Overview

AttendEase eliminates manual attendance taking through an intelligent geofencing system. Lecturers start a session with GPS coordinates and a radius, while students verify their identity (biometric or password) and check in when within range. Real-time attendance tracking with persistent session management across app restarts.

### Key Features

- **Biometric Authentication** - Fingerprint/Face ID with password fallback
- **GPS-Based Geofencing** - Lecturer's location = attendance zone center
- **Real-Time Roster** - Live attendance updates via Supabase realtime subscriptions
- **Cross-Platform** - Native (iOS/Android) and Web support
- **Session Management** - Start/end attendance sessions with instant updates
- **Attendance Reports** - Historical data with analytics
- **Platform-Aware Storage** - Secure credential storage (SecureStore on mobile, localStorage on web)

---

## 🏗 Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React Native 0.76.9, React 18.3.1 |
| **Navigation** | expo-router 4.0.22 (file-based routing) |
| **Backend** | Supabase (PostgreSQL, Realtime, Auth) |
| **State Management** | React Hooks (useState, useEffect, useRef) |
| **Storage** | Platform-aware adapter (localStorage/SecureStore) |
| **Geolocation** | expo-location (native), navigator.geolocation (web) |
| **Build System** | EAS (Expo Application Services) |
| **Type Safety** | TypeScript with Supabase types |

### Project Structure

```
AttendEase/
├── app/
│   ├── _layout.tsx              # Root layout with auth routing
│   ├── (auth)/
│   │   ├── login.tsx            # Email/password sign-in
│   │   ├── biometric.tsx        # Biometric verification + password fallback
│   │   └── _layout.tsx          # Auth route group layout
│   ├── (student)/
│   │   ├── _layout.tsx          # Student route protection
│   │   ├── home.tsx             # Check-in interface with GPS geofencing
│   │   ├── history.tsx          # Attendance history view
│   │   └── _layout.tsx          # Student nav layout
│   ├── (lecturer)/
│   │   ├── _layout.tsx          # Lecturer route protection
│   │   ├── dashboard.tsx        # Session management + live roster
│   │   ├── reports.tsx          # Attendance analytics
│   │   └── _layout.tsx          # Lecturer nav layout
│   ├── (admin)/
│   │   ├── calibrate.tsx        # GPS calibration tool
│   │   └── _layout.tsx          # Admin nav layout
│   └── index.tsx                # Entry point
├── components/
│   ├── AttendanceButton.tsx     # Shared check-in button
│   ├── GPSStatusBadge.tsx       # GPS signal indicator
│   ├── ReportCard.tsx           # Report display component
│   └── AnalyticsCharts.tsx      # Analytics placeholder
├── hooks/
│   ├── useAuth.ts              # Authentication logic
│   └── useLocation.ts          # Geolocation hook
├── lib/
│   ├── supabase.ts             # Supabase client + platform-aware storage
│   └── geofence.ts             # GPS calculations + geofence logic
├── types/
│   └── index.ts                # TypeScript definitions
├── assets/                     # Images, icons, fonts
├── app.json                    # Expo app config
├── eas.json                    # EAS build config
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies
└── .env                        # Environment variables (local only)
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ with npm/yarn
- Expo CLI: `npm install -g expo-cli`
- Supabase account with PostgreSQL database
- Android Studio (for native builds) or Xcode (iOS)

### Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/chaz-ux/AttendEase.git
   cd AttendEase
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create `.env` file with Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Start Development Server**
   ```bash
   npx expo start --clear
   ```
   - Press `w` for web
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR with Expo Go app for physical device

### Building for Production

**Android APK:**
```bash
npx eas build --platform android --profile preview
```

**Web (Static Build):**
```bash
npx expo export --platform web
# Output in dist/ folder
```

---

## 📊 Database Schema

### Tables

#### `profiles`
Stores user information and role-based access control.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | User ID (FK to auth.users) |
| `email` | text | User email |
| `full_name` | text | Display name |
| `reg_number` | text | Student registration number (optional) |
| `role` | text | 'student', 'lecturer', or 'admin' |
| `university_id` | uuid | Institution reference |
| `created_at` | timestamp | Account creation date |

#### `units`
Course/class sections that lecturers teach.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `code` | text | Unit code (e.g., "CS101") |
| `name` | text | Unit name |
| `lecturer_id` | uuid | FK to profiles |
| `university_id` | uuid | Institution reference |
| `created_at` | timestamp | Creation date |

#### `sessions`
Attendance sessions started by lecturers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `unit_id` | uuid | FK to units |
| `lecturer_id` | uuid | FK to profiles |
| `classroom_id` | uuid | Optional FK to classrooms (nullable) |
| `room_label` | text | Free-text room identifier |
| `started_at` | timestamp | Session start time |
| `ended_at` | timestamp | Session end time (null if active) |
| `attendance_open` | boolean | Whether check-ins are accepted |
| `center_lat` | float | Geofence center latitude |
| `center_lng` | float | Geofence center longitude |
| `radius_meters` | int | Geofence radius in meters |
| `created_at` | timestamp | Creation time |

#### `attendance_logs`
Student check-in records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `session_id` | uuid | FK to sessions |
| `student_id` | uuid | FK to profiles |
| `checked_in_at` | timestamp | Check-in timestamp |
| `check_in_lat` | float | Student's GPS latitude |
| `check_in_lng` | float | Student's GPS longitude |
| `distance_meters` | float | Distance from geofence center |
| `device_id` | text | Device identifier |
| `is_verified` | boolean | GPS verification successful |
| `university_id` | uuid | Institution reference |
| `created_at` | timestamp | Record creation time |

#### `classrooms` (Optional)
Physical classroom definitions (currently unused in MVP).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Room identifier |
| `center_lat` | float | Default GPS coordinates |
| `center_lng` | float | Default GPS coordinates |
| `radius_meters` | int | Default geofence radius |
| `university_id` | uuid | Institution reference |

### Key Relationships

```
profiles (users)
  ├─ units (lecturer -> units)
  ├─ sessions (lecturer -> sessions)
  └─ attendance_logs (student -> attendance_logs)

sessions
  ├─ units (unit_id)
  ├─ profiles (lecturer_id)
  └─ attendance_logs (session_id)
```

---

## 🔐 Authentication Flow

### New User (First Login)

```
Login Screen
    ↓
[Email + Password]
    ↓
Biometric Verification
    ↓
[Fingerprint/Face ID or Password-Only]
    ↓
Session Created → Credentials stored in SecureStore/localStorage
    ↓
Role-based routing (Student/Lecturer/Admin Dashboard)
```

### Returning User (Session Exists)

```
App Starts
    ↓
[Check for existing session in storage]
    ↓
Session Found → Skip login
    ↓
Biometric Verification Screen
    ↓
[Fingerprint/Face ID confirms identity]
    ↓
Role-based routing (Dashboard)
```

### Platform Differences

| Feature | Mobile | Web |
|---------|--------|-----|
| Credential Storage | expo-secure-store | localStorage |
| Geolocation | expo-location | navigator.geolocation |
| Biometric | Device biometric hardware | N/A (password only) |
| Session Persistence | SecureStore | localStorage |

---

## 🎯 User Workflows

### Lecturer Session Start

```
1. Open Dashboard
   ↓
2. Select Unit from list
   ↓
3. (Optional) Enter room label (e.g., "NCLB 3")
   ↓
4. Select geofence radius (30m, 50m, 75m, 100m)
   ↓
5. Tap "Start Session Now"
   ↓
   → App captures lecturer's GPS position
   → Creates session with geofence
   → Attendance opens for students
   ↓
6. View live roster (updates realtime as students check in)
   ↓
7. Tap "End Session" to close attendance
```

### Student Check-In

```
1. Open Home screen
   ↓
2. Active session appears (if lecturer started one)
   ↓
3. See:
   - Unit code + room label
   - Lecturer name
   - Geofence radius
   ↓
4. Tap "MARK PRESENT" button
   ↓
   → App captures student's GPS position
   → Verifies geofence (within range?)
   ↓
   If INSIDE:
   → Attendance logged to database
   → Status shows "CHECKED IN ✓"
   → Attendance stats update
   
   If OUTSIDE:
   → Button shows "TOO FAR ✗"
   → Distance displayed
   ↓
5. View attendance history (Home → History)
```

---

## 🔧 Configuration

### app.json (Expo Configuration)

```json
{
  "expo": {
    "name": "AttendEase",
    "slug": "attendease",
    "version": "1.0.0",
    "scheme": "attendease",
    "orientation": "portrait",
    "plugins": [
      "expo-device",
      "expo-location",
      "expo-secure-store",
      "expo-biometric"
    ]
  }
}
```

### eas.json (Build Configuration)

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

### Environment Variables

**Required:**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key

**Never commit:** `.env` files containing secrets

---

## 📱 Screens & Navigation

### Student Routes
- `/(student)/home` - Active session + check-in button
- `/(student)/history` - Attendance records with stats

### Lecturer Routes
- `/(lecturer)/dashboard` - Unit selector + live session management
- `/(lecturer)/reports` - Attendance analytics and reports

### Admin Routes
- `/(admin)/calibrate` - GPS calibration tool

### Auth Routes
- `/(auth)/login` - Email/password sign-in
- `/(auth)/biometric` - Biometric verification + fallback

---

## 🐛 Error Handling

### Common Issues & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| 406 Not Found | `.single()` on optional query | Use `.maybeSingle()` |
| "No GPS fix yet" | Location permissions denied | Grant location access in settings |
| "Session not found" | Lecturer hasn't started session | Lecturer must start session first |
| "Check-in failed" | Outside geofence radius | Move closer to lecturer |
| Session exists but no role | Database role missing | Check profiles table, ensure role is set |

### Debugging

**Enable console logging:**
```typescript
console.log('Session data:', JSON.stringify(data));
console.log('Geofence result:', JSON.stringify(geo));
console.log('fetchRole result:', JSON.stringify(data), JSON.stringify(error));
```

**Check Supabase realtime subscriptions:**
- Open Supabase Dashboard → Realtime Inspector
- Monitor channel activity for attendance_logs changes

---

## 🚦 Testing Scenarios

### Test 1: Lecturer Starts Session
1. Login as lecturer
2. Select unit
3. Tap "Start Session Now"
4. Verify session created in Supabase

### Test 2: Student Checks In (Inside Geofence)
1. Login as student
2. See active session
3. Tap "MARK PRESENT"
4. Verify attendance logged with `is_verified: true`

### Test 3: Student Outside Geofence
1. Change device location (simulator)
2. Tap "MARK PRESENT"
3. See "TOO FAR ✗" status
4. Verify no attendance logged

### Test 4: Biometric Fallback
1. Login with password only (skip biometric)
2. Close app
3. App should show biometric screen next time
4. Scan fingerprint or tap password fallback

### Test 5: Cross-Platform (Web vs Mobile)
1. Start on web
2. Check localStorage has session token
3. Switch to mobile
4. Verify SecureStore has credentials
5. Confirm platform-aware storage works

---

## 📈 Performance Considerations

- **Realtime Subscriptions** - Limited to 1 active channel per screen to avoid connection overload
- **GPS Accuracy** - Set minimum accuracy threshold before accepting geofence check
- **Database Queries** - Use `.maybeSingle()` for optional lookups to prevent 406 errors
- **Storage** - Platform-aware adapter prevents iOS/web crashes from SecureStore
- **TypeScript** - Strict null-safety prevents runtime crashes from undefined properties

---

## 🔒 Security

### Best Practices Implemented

- ✅ Biometric + password dual authentication
- ✅ GPS-based verification (prevents spoofing by location)
- ✅ Platform-aware credential storage (never exposes in localStorage)
- ✅ Supabase RLS policies enforce user isolation
- ✅ Environment variables for secrets (never committed)
- ✅ Session tokens stored securely (not in AsyncStorage)

### Recommendations for Production

1. Implement rate limiting on geofence checks
2. Add server-side GPS validation (edge function)
3. Enforce HTTPS-only communication
4. Set up database backups and replication
5. Monitor attendance anomalies (duplicate check-ins)
6. Implement audit logging for compliance

---

## 📚 Dependencies

### Core
- `react-native` 0.76.9 - Mobile framework
- `expo` 52.0.0 - Development platform
- `expo-router` 4.0.22 - File-based navigation
- `@supabase/supabase-js` - Backend client

### Location & Device
- `expo-location` - GPS services
- `expo-device` - Device identification
- `expo-secure-store` - Secure credential storage

### Authentication
- `expo-biometric` - Fingerprint/Face ID
- `@supabase/gotrue-js` - Auth client

### UI
- `react-native` StyleSheet (built-in)
- Animated API (React Native built-in)

---

## 🛠 Development Commands

```bash
# Start dev server
npx expo start --clear

# Build for Android
npx eas build --platform android --profile preview

# Build for Web
npx expo export --platform web

# Type check
npx tsc --noEmit

# Clean cache
npm install
npx expo start --clear
```

---

## 📝 Future Enhancements

- [ ] Analytics dashboard with charts (skeleton exists)
- [ ] Bulk attendance import/export
- [ ] QR code check-in as alternative to GPS
- [ ] Offline mode with sync on reconnect
- [ ] Multi-language support
- [ ] SMS notifications for students
- [ ] Advanced reporting (by date range, pattern detection)
- [ ] Mobile app store deployment (iOS App Store, Google Play)

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/description`
3. Commit changes: `git commit -m "Add description"`
4. Push to branch: `git push origin feature/description`
5. Open Pull Request

---

## 📄 License

This project is proprietary. All rights reserved.

---

## 👨‍💻 Author

**Chaz UX**  
Repository: [github.com/chaz-ux/AttendEase](https://github.com/chaz-ux/AttendEase)

---

## 📞 Support

For issues or questions:
1. Check GitHub Issues
2. Review error handling section above
3. Check Supabase logs for backend errors
4. Enable console logging for debugging

---

**Last Updated:** May 1, 2026  
**Version:** 1.0.0 MVP  
**Status:** Production Ready ✅

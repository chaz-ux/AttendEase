import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Alert, ActivityIndicator, RefreshControl, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import { supabase } from '../../lib/supabase';
import { checkGeofence } from '../../lib/geofence';
import { useAuth } from '../../hooks/useAuth';

type SessionStatus = 'idle' | 'checking' | 'verified' | 'outside' | 'already_checked' | 'no_session';
type AttendanceRecord = {
  id: string;
  checked_in_at: string;
  is_verified: boolean;
  sessions: { units: { code: string; name: string }; classrooms: { name: string } };
};
type ActiveSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  units: { code: string; name: string } | null;
  profiles: { full_name: string } | null;
};

export default function StudentHome() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<{ full_name: string; reg_number: string } | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ total: 0, present: 0, percentage: 0 });
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [gpsInfo, setGpsInfo] = useState<{ inside: boolean; distance: number; accuracy: number | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;

  // Pulse animation for the button ring
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    );
    const ring = Animated.loop(
      Animated.timing(ringRotation, { toValue: 1, duration: 4000, useNativeDriver: true })
    );
    pulse.start();
    ring.start();
    return () => { pulse.stop(); ring.stop(); };
  }, []);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadProfile(), loadActiveSession(), loadRecentAttendance()]);
    setLoading(false);
  };

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, reg_number')
      .eq('id', user!.id)
      .single();
    if (data) setProfile(data);
  };

  const loadActiveSession = async () => {
    // Find a session that is open and hasn't ended
    const { data } = await supabase
      .from('sessions')
      .select(`
        id, started_at, ended_at, attendance_open,
        center_lat, center_lng, radius_meters,
        units:unit_id (code, name),
        profiles:lecturer_id (full_name)
      `)
      .eq('attendance_open', true)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveSession(data as any);
      // Check if student already checked in
      const { data: existing } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('session_id', data.id)
        .eq('student_id', user!.id)
        .maybeSingle();
      if (existing) setStatus('already_checked');
      else setStatus('idle');
    } else {
      setActiveSession(null);
      setStatus('no_session');
    }
  };

  const loadRecentAttendance = async () => {
    const { data } = await supabase
      .from('attendance_logs')
      .select(`
        id, checked_in_at, is_verified,
        sessions:session_id (
          units:unit_id (code, name),
          classrooms:classroom_id (name)
        )
      `)
      .eq('student_id', user!.id)
      .order('checked_in_at', { ascending: false })
      .limit(10);

    if (data) {
      setRecentAttendance(data as any);
      const total = data.length;
      const present = data.filter(d => d.is_verified).length;
      setAttendanceStats({
        total,
        present,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
      });
    }
  };

  const handleMarkPresent = async () => {
    if (!activeSession || status !== 'idle') return;
    setStatus('checking');

    try {
      const geo = await checkGeofence(
        activeSession.center_lat,
        activeSession.center_lng,
        activeSession.radius_meters
      );
      setGpsInfo({ inside: geo.inside, distance: geo.distanceMeters, accuracy: geo.accuracy });

      if (!geo.inside) {
        setStatus('outside');
        return;
      }

      // Write attendance directly — no edge function needed
      const deviceId = Device.modelId ?? Device.deviceName ?? 'unknown';

      const { data: profileData } = await supabase
        .from('profiles')
        .select('university_id')
        .eq('id', user!.id)
        .single();

      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          session_id: activeSession.id,
          student_id: user!.id,
          check_in_lat: geo.coords.lat,
          check_in_lng: geo.coords.lng,
          distance_meters: geo.distanceMeters,
          device_id: deviceId,
          is_verified: true,
          university_id: profileData?.university_id,
        });

      if (error) {
        // Duplicate check-in
        if (error.code === '23505') {
          setStatus('already_checked');
        } else {
          Alert.alert('Check-in failed', error.message);
          setStatus('idle');
        }
        return;
      }

      setStatus('verified');
      await loadRecentAttendance();
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setStatus('idle');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const getButtonConfig = () => {
    switch (status) {
      case 'idle':
        return { color: C.green, label: 'MARK PRESENT', sub: 'Tap to check in', icon: '✓', disabled: !activeSession };
      case 'checking':
        return { color: C.green, label: 'VERIFYING…', sub: 'Getting GPS location', icon: '⊙', disabled: true };
      case 'verified':
        return { color: C.gold, label: 'CHECKED IN', sub: 'Attendance recorded', icon: '★', disabled: true };
      case 'outside':
        return { color: C.red, label: 'TOO FAR', sub: `${Math.round(gpsInfo?.distance ?? 0)}m from classroom`, icon: '✗', disabled: true };
      case 'already_checked':
        return { color: C.gold, label: 'ALREADY IN', sub: 'You checked in earlier', icon: '★', disabled: true };
      case 'no_session':
        return { color: C.surface3, label: 'NO SESSION', sub: 'No active class right now', icon: '○', disabled: true };
    }
  };
  

  const btnConfig = getButtonConfig();
  const hourOfDay = new Date().getHours();
  const greeting = hourOfDay < 12 ? 'Good morning' : hourOfDay < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  const spin = ringRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.greenLight} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.greenLight} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>{greeting},</Text>
            <Text style={styles.greetingName}>{firstName}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Active session card */}
        <View style={[styles.sessionCard, !activeSession && styles.sessionCardDim]}>
          <View style={styles.sessionCardHeader}>
            <View style={[styles.sessionPill, !activeSession && styles.sessionPillDim]}>
              {activeSession && <View style={styles.liveDot} />}
              <Text style={[styles.sessionPillText, !activeSession && styles.sessionPillTextDim]}>
                {activeSession ? 'LIVE SESSION' : 'NO ACTIVE SESSION'}
              </Text>
            </View>
            {activeSession && (
              <Text style={styles.sessionTime}>
                {new Date(activeSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          <Text style={[styles.sessionUnit, !activeSession && { color: C.textDim }]}>
            {activeSession
              ? `${activeSession.units?.code ?? ''} — ${activeSession.units?.name ?? ''}`
              : 'No class right now'}
          </Text>
          <Text style={[styles.sessionRoom, !activeSession && { color: C.textDim }]}>
            {activeSession
              ? `📍 ${activeSession.radius_meters}m geofence · ${activeSession.units?.code}`
              : 'Check your schedule for next class'}
          </Text>

          {activeSession && (
            <View style={styles.sessionMeta}>
              <Text style={styles.metaText}>👤 {activeSession.profiles?.full_name}</Text>
              <Text style={styles.metaText}>📡 GPS-verified attendance</Text>
            </View>
          )}
        </View>

        {/* GPS status */}
        {gpsInfo && (
          <View style={[styles.gpsCard, { borderColor: gpsInfo.inside ? 'rgba(42,157,92,0.3)' : 'rgba(224,82,82,0.3)' }]}>
            <Text style={{ fontSize: 18 }}>{gpsInfo.inside ? '📍' : '⚠️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.gpsTitle}>
                {gpsInfo.inside ? 'Inside classroom' : 'Outside classroom range'}
              </Text>
              <Text style={styles.gpsSub}>
                {Math.round(gpsInfo.distance)}m away · ±{Math.round(gpsInfo.accuracy ?? 0)}m accuracy
              </Text>
            </View>
            <View style={[styles.gpsBadge, { backgroundColor: gpsInfo.inside ? 'rgba(42,157,92,0.12)' : 'rgba(224,82,82,0.1)' }]}>
              <Text style={[styles.gpsBadgeText, { color: gpsInfo.inside ? C.greenLight : C.red }]}>
                {gpsInfo.inside ? 'IN RANGE' : 'OUT'}
              </Text>
            </View>
          </View>
        )}

        {/* THE BUTTON */}
        <View style={styles.btnWrap}>
          <TouchableOpacity
            style={[styles.markBtn, { backgroundColor: btnConfig.color }]}
            onPress={handleMarkPresent}
            disabled={btnConfig.disabled}
            activeOpacity={0.85}
          >
            {status === 'idle' && activeSession && (
              <Animated.View style={[styles.btnRing, { transform: [{ rotate: spin }] }]} />
            )}
            {status === 'checking'
              ? <ActivityIndicator color="#fff" size="large" />
              : <Text style={styles.btnIcon}>{btnConfig.icon}</Text>
            }
            <Text style={styles.btnLabel}>{btnConfig.label}</Text>
            <Text style={styles.btnSub}>{btnConfig.sub}</Text>
          </TouchableOpacity>
          <Text style={[styles.btnHint, status === 'verified' && { color: C.greenLight }]}>
            {status === 'verified'
              ? `Verified at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : status === 'no_session'
              ? 'Attendance opens when lecturer starts session'
              : activeSession
              ? `GPS verified · ${activeSession.units?.code ?? ''}`
              : ''}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{attendanceStats.percentage}%</Text>
            <Text style={styles.statLabel}>ATTENDANCE</Text>
            <View style={styles.statBar}>
              <View style={[styles.statFill, { width: `${attendanceStats.percentage}%`, backgroundColor: C.greenLight }]} />
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{attendanceStats.present}/{attendanceStats.total}</Text>
            <Text style={styles.statLabel}>CLASSES</Text>
            <View style={styles.statBar}>
              <View style={[styles.statFill, { width: `${attendanceStats.percentage}%`, backgroundColor: C.gold }]} />
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{attendanceStats.total - attendanceStats.present}</Text>
            <Text style={styles.statLabel}>MISSED</Text>
            <View style={styles.statBar}>
              <View style={[styles.statFill, { width: `${100 - attendanceStats.percentage}%`, backgroundColor: C.red }]} />
            </View>
          </View>
        </View>

        {/* Recent attendance */}
        <View style={styles.historySection}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Recent attendance</Text>
            <TouchableOpacity onPress={() => router.push('/(student)/history')}>
              <Text style={styles.sectionLink}>View all →</Text>
            </TouchableOpacity>
          </View>
          {recentAttendance.slice(0, 5).map(record => (
            <View key={record.id} style={styles.historyItem}>
              <View style={[styles.hDot, { backgroundColor: record.is_verified ? C.greenLight : C.red }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.hUnit}>
                  {(record.sessions as any)?.units?.code} — {(record.sessions as any)?.units?.name}
                </Text>
                <Text style={styles.hTime}>
                  {new Date(record.checked_in_at).toLocaleDateString()} · {(record.sessions as any)?.classrooms?.name}
                </Text>
              </View>
              <View style={[styles.hBadge, { backgroundColor: record.is_verified ? 'rgba(42,157,92,0.1)' : 'rgba(224,82,82,0.1)' }]}>
                <Text style={[styles.hBadgeText, { color: record.is_verified ? C.greenLight : C.red }]}>
                  {record.is_verified ? 'Present' : 'Absent'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {[
          { icon: '🏠', label: 'HOME', route: '/(student)/home', active: true },
          { icon: '📋', label: 'HISTORY', route: '/(student)/history', active: false },
          { icon: '🚪', label: 'LOG OUT', route: null, active: false, onPress: () => {
            Alert.alert('Sign out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: signOut },
            ]);
          }},
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={styles.navItem}
            onPress={() => {
              if (item.onPress) item.onPress();
              else if (item.route) router.push(item.route as any);
            }}
          >
            <Text style={{ fontSize: 20, opacity: item.active ? 1 : 0.35 }}>{item.icon}</Text>
            <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}


const C = {
  surface: '#0d1f14', surface2: '#122619', surface3: '#1a3324',
  green: '#1a6b3c', greenLight: '#2a9d5c',
  gold: '#c9a84c', border: 'rgba(201,168,76,0.15)', borderHi: 'rgba(201,168,76,0.35)',
  text: '#f0ede6', textMuted: '#8fa898', textDim: '#506659', red: '#e05252',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  scroll: { padding: 20, gap: 14, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetingSub: { fontSize: 12, color: C.textMuted, fontWeight: '300' },
  greetingName: { fontSize: 18, fontWeight: '800', color: C.text },
  notifBtn: { width: 36, height: 36, backgroundColor: C.surface2, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  sessionCard: { backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.borderHi, borderRadius: 16, padding: 14 },
  sessionCardDim: { borderColor: 'rgba(255,255,255,0.06)' },
  sessionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sessionPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(42,157,92,0.12)', borderWidth: 1, borderColor: 'rgba(42,157,92,0.3)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  sessionPillDim: { backgroundColor: 'rgba(80,102,89,0.1)', borderColor: 'rgba(80,102,89,0.2)' },
  liveDot: { width: 6, height: 6, backgroundColor: C.greenLight, borderRadius: 3 },
  sessionPillText: { fontSize: 10, fontWeight: '600', color: C.greenLight, letterSpacing: 0.8 },
  sessionPillTextDim: { color: C.textDim },
  sessionTime: { fontSize: 11, color: C.textDim },
  sessionUnit: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  sessionRoom: { fontSize: 12, color: C.textMuted },
  sessionMeta: { flexDirection: 'row', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  metaText: { fontSize: 11, color: C.textMuted },
  gpsCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  gpsTitle: { fontSize: 12, fontWeight: '500', color: C.text },
  gpsSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  gpsBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  gpsBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  btnWrap: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  markBtn: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative' },
  btnRing: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: 'rgba(42,157,92,0.2)', borderStyle: 'dashed' },
  btnIcon: { fontSize: 36, color: '#fff' },
  btnLabel: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.8 },
  btnSub: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  btnHint: { fontSize: 11, color: C.textDim, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10 },
  statVal: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 2 },
  statLabel: { fontSize: 9, color: C.textDim, letterSpacing: 0.8, fontWeight: '600' },
  statBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  statFill: { height: '100%', borderRadius: 2 },
  historySection: { gap: 2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  sectionLink: { fontSize: 11, color: C.gold, fontWeight: '500' },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  hDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  hUnit: { fontSize: 12, fontWeight: '500', color: C.text },
  hTime: { fontSize: 11, color: C.textDim, marginTop: 1 },
  hBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  hBadgeText: { fontSize: 10, fontWeight: '700' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: C.surface2, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10, paddingBottom: 20 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 9, fontWeight: '600', color: C.textDim, letterSpacing: 0.8 },
  navLabelActive: { color: C.greenLight },
});
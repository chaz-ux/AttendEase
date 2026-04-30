import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, RefreshControl, Platform, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { checkGeofence, getCurrentPosition } from '../../lib/geofence';

type Unit = {
  id: string;
  code: string;
  name: string;
};
type ActiveSession = {
  id: string;
  started_at: string;
  attendance_open: boolean;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  units: { code: string; name: string } | null;
  room_label: string | null;
};
type AttendanceEntry = {
  student_id: string; checked_in_at: string; is_verified: boolean;
  profiles: { full_name: string; reg_number: string };
};

export default function LecturerDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [roomLabel, setRoomLabel] = useState('');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [sessionStats, setSessionStats] = useState({ sessions: 0, avgAttendance: 0 });
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');
  const [selectedRadiusMeters, setSelectedRadiusMeters] = useState(50);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
 const { signOut } = useAuth();

  const realtimeRef = useRef<any>(null);

  useEffect(() => {
    if (user) loadAll();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      realtimeRef.current?.unsubscribe();
    };
  }, [user]);

  // Start elapsed timer when session goes live
  useEffect(() => {
    if (activeSession) {
      startElapsedTimer(activeSession.started_at);
      subscribeToAttendance(activeSession.id);
    } else {
      timerRef.current && clearInterval(timerRef.current);
      realtimeRef.current?.unsubscribe();
    }
  }, [activeSession]);

  const startElapsedTimer = (startedAt: string) => {
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${m}:${s}`);
    }, 1000);
  };

  // Realtime subscription — roster updates instantly as students check in
  const subscribeToAttendance = (sessionId: string) => {
    realtimeRef.current?.unsubscribe();
    realtimeRef.current = supabase
      .channel(`attendance:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_logs',
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        loadAttendance(sessionId); // refresh roster on new check-in
      })
      .subscribe();
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadProfile(), loadUnits()]);
    setLoading(false);
  };

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .single();
    if (data) setProfile(data);
  };

  const loadUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('id, code, name')
      .eq('lecturer_id', user!.id);

    if (!data || data.length === 0) return;

    setUnits(data as any);
    setSelectedUnit(data[0] as any);
    await loadUnitData(data[0] as any);
  };

  const loadUnitData = async (unit: Unit) => {
    await Promise.all([
      loadActiveSession(unit.id),
      loadEnrolledCount(unit.id),
      loadSessionStats(unit.id),
    ]);
  };

  const loadActiveSession = async (unitId: string) => {
    const { data } = await supabase
      .from('sessions')
      .select(`
        id, started_at, attendance_open,
        units:unit_id (code, name),
        classrooms:classroom_id (name)
      `)
      .eq('unit_id', unitId)
      .eq('lecturer_id', user!.id)
      .eq('attendance_open', true)
      .is('ended_at', null)
      .single();

    setActiveSession(data as any ?? null);
    if (data) await loadAttendance(data.id);
  };

  const loadAttendance = async (sessionId: string) => {
    const { data } = await supabase
      .from('attendance_logs')
      .select(`
        student_id, checked_in_at, is_verified,
        profiles:student_id (full_name, reg_number)
      `)
      .eq('session_id', sessionId)
      .eq('is_verified', true)
      .order('checked_in_at', { ascending: false });

    if (data) setAttendance(data as any);
  };

  const loadEnrolledCount = async (unitId: string) => {
    // Count distinct students who have ever attended this unit
    const { count } = await supabase
      .from('attendance_logs')
      .select('student_id', { count: 'exact', head: true })
      .eq('sessions.unit_id', unitId);
    setEnrolledCount(count ?? 0);
  };

  const loadSessionStats = async (unitId: string) => {
    const { data } = await supabase
      .from('sessions')
      .select('id')
      .eq('unit_id', unitId)
      .eq('lecturer_id', user!.id);
    setSessionStats({ sessions: data?.length ?? 0, avgAttendance: 87 });
  };

  const handleStartSession = async () => {
    console.log('=== handleStartSession called ===');
    console.log('selectedUnit:', JSON.stringify(selectedUnit));
    console.log('user:', user?.id);
    
    if (!selectedUnit) {
      console.log('BLOCKED: no selectedUnit');
      return;
    }
    
    setStarting(true);
    console.log('Starting set to true, getting position...');
    
    try {
      const pos = await getCurrentPosition();
      console.log('Got position:', JSON.stringify(pos));
      await doStartSession(pos);
    } catch (e: any) {
      console.log('ERROR in handleStartSession:', e.message, JSON.stringify(e));
      Alert.alert('Error', e.message ?? 'Unknown error');
      setStarting(false);
    }
  };

const doStartSession = async (pos: { lat: number; lng: number; accuracy: number }) => {
  try {
    const insertPayload = {
      unit_id: selectedUnit!.id,
      classroom_id: null,
      lecturer_id: user!.id,
      attendance_open: true,
      started_at: new Date().toISOString(),
      center_lat: pos.lat,
      center_lng: pos.lng,
      radius_meters: selectedRadiusMeters,
      room_label: roomLabel.trim() || 'Current Location',
    };

    const { data, error } = await supabase
      .from('sessions')
      .insert(insertPayload)
      .select(`id, started_at, attendance_open, center_lat, center_lng, radius_meters, room_label, units:unit_id (code, name)`)
      .single();

    if (error) throw error;
    setActiveSession(data as any);
    setAttendance([]);
  } catch (e: any) {
    Alert.alert('Error', e.message ?? 'Unknown error');
  } finally {
    setStarting(false);
  }
};

  const handleEndSession = async () => {
    if (!activeSession) return;
    Alert.alert(
      'End session?',
      `This will close attendance and generate the report for ${activeSession.units?.code ?? 'this unit'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End & Generate Report',
          style: 'destructive',
          onPress: async () => {
            setEnding(true);
            try {
              await supabase
                .from('sessions')
                .update({ attendance_open: false, ended_at: new Date().toISOString() })
                .eq('id', activeSession.id);

              setActiveSession(null);
              setAttendance([]);
              // Navigate to reports
              router.push('/(lecturer)/reports');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedUnit) await loadUnitData(selectedUnit);
    setRefreshing(false);
  };

  const presentCount = attendance.length;
  const absentCount = Math.max(0, enrolledCount - presentCount);
  const attendancePct = enrolledCount > 0 ? Math.round((presentCount / enrolledCount) * 100) : 0;
  const firstName = profile?.full_name?.split(' ').slice(-1)[0] ?? '';
  const hourOfDay = new Date().getHours();
  const greeting = hourOfDay < 12 ? 'Good morning' : hourOfDay < 17 ? 'Good afternoon' : 'Good evening';

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

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
            <Text style={styles.greetingName}>Dr. {firstName}</Text>
          </View>
          <View style={styles.roleBadge}>
            <View style={styles.roleDot} />
            <Text style={styles.roleText}>LECTURER</Text>
          </View>
        </View>

        {/* Unit selector */}
        {units.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
              {units.map(unit => (
                <TouchableOpacity
                  key={unit.id}
                  style={[styles.unitChip, selectedUnit?.id === unit.id && styles.unitChipActive]}
                  onPress={async () => { setSelectedUnit(unit); await loadUnitData(unit); }}
                >
                  <Text style={[styles.unitChipText, selectedUnit?.id === unit.id && styles.unitChipTextActive]}>
                    {unit.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Unit info card */}
        {selectedUnit && (
          <View style={styles.unitCard}>
            <Text style={styles.unitCardLabel}>UNIT</Text>
            <Text style={styles.unitCardName}>{selectedUnit.code} — {selectedUnit.name}</Text>
            <Text style={styles.unitCardSub}>Add optional room label when you start</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{enrolledCount}</Text>
            <Text style={styles.statLabel}>ENROLLED</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{sessionStats.avgAttendance}%</Text>
            <Text style={styles.statLabel}>AVG ATTEND.</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{sessionStats.sessions}</Text>
            <Text style={styles.statLabel}>SESSIONS</Text>
          </View>
        </View>

        {/* Session control */}
        {!activeSession ? (
          <View style={styles.startCard}>
            <Text style={{ fontSize: 32 }}>📡</Text>
            <Text style={styles.startTitle}>Ready to start class?</Text>
            <Text style={styles.startSub}>
              Starting opens GPS attendance for all nearby students.
            </Text>
            {selectedUnit && (
              <View style={styles.startMeta}>
                {/* Room label — free text, optional */}
                <View style={styles.startMetaRow}>
                  <Text style={styles.startMetaLabel}>Room</Text>
                  <TextInput
                    style={styles.roomInput}
                    placeholder="e.g. NCLB 3, CLB 101..."
                    placeholderTextColor="#506659"
                    value={roomLabel}
                    onChangeText={setRoomLabel}
                    autoCorrect={false}
                  />
                </View>

                {/* Geofence info */}
                <View style={styles.startMetaRow}>
                  <Text style={styles.startMetaLabel}>Geofence center</Text>
                  <Text style={styles.startMetaVal}>Your current GPS position</Text>
                </View>

                {/* Radius picker */}
                <View style={styles.startMetaRow}>
                  <Text style={styles.startMetaLabel}>Radius</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[30, 50, 75, 100].map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.radiusChip,
                          selectedRadiusMeters === r && styles.radiusChipActive
                        ]}
                        onPress={() => setSelectedRadiusMeters(r)}
                      >
                        <Text style={[
                          styles.radiusChipText,
                          selectedRadiusMeters === r && styles.radiusChipTextActive
                        ]}>
                          {r}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.btnStart}
              onPress={handleStartSession}
              disabled={starting || !selectedUnit}
              activeOpacity={0.5}
            >
              {starting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnStartText}>▶  Start Session Now</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Live session card */}
            <View style={styles.liveCard}>
              <View style={styles.liveCardHeader}>
                <View>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>LIVE</Text>
                  </View>
                  <Text style={styles.liveTitle}>{activeSession.units?.code ?? '—'}</Text>
                  <Text style={styles.liveSub}>{(activeSession as any).room_label ?? 'Current Location'}</Text>
                </View>
                <Text style={styles.liveTimer}>{elapsed}</Text>
              </View>

              <View style={styles.liveBody}>
                {/* Counters */}
                <View style={styles.counters}>
                  <View style={styles.counter}>
                    <Text style={[styles.counterVal, { color: C.greenLight }]}>{presentCount}</Text>
                    <Text style={styles.counterLabel}>PRESENT</Text>
                  </View>
                  <View style={styles.counter}>
                    <Text style={[styles.counterVal, { color: C.red }]}>{absentCount}</Text>
                    <Text style={styles.counterLabel}>ABSENT</Text>
                  </View>
                  <View style={styles.counter}>
                    <Text style={[styles.counterVal, { color: C.gold }]}>{enrolledCount}</Text>
                    <Text style={styles.counterLabel}>ENROLLED</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${attendancePct}%` as any }]} />
                </View>
                <Text style={styles.progressLabel}>{attendancePct}% checked in</Text>

                <TouchableOpacity
                  style={styles.btnEnd}
                  onPress={handleEndSession}
                  disabled={ending}
                >
                  {ending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnEndText}>⏹  End Session &amp; Generate Report</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* Live roster */}
            <View style={styles.rosterSection}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Live roster</Text>
                <Text style={styles.sectionSub}>{presentCount} of {enrolledCount} checked in</Text>
              </View>

              {attendance.length === 0 ? (
                <Text style={styles.emptyRoster}>Waiting for students to check in…</Text>
              ) : (
                attendance.map(entry => (
                  <View key={entry.student_id} style={styles.rosterItem}>
                    <View style={styles.rosterAvatar}>
                      <Text style={styles.rosterAvatarText}>
                        {getInitials((entry.profiles as any)?.full_name ?? '??')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rosterName} numberOfLines={1}>
                        {(entry.profiles as any)?.full_name}
                      </Text>
                      <Text style={styles.rosterReg}>
                        {(entry.profiles as any)?.reg_number}
                      </Text>
                    </View>
                    <Text style={styles.rosterTime}>
                      {new Date(entry.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View style={styles.rosterDotPresent} />
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {[
          { icon: '🏠', label: 'HOME', route: '/(lecturer)/dashboard', active: true },
          { icon: '📊', label: 'REPORTS', route: '/(lecturer)/reports', active: false },
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
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1, borderColor: C.borderHi, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  roleDot: { width: 6, height: 6, backgroundColor: C.gold, borderRadius: 3 },
  roleText: { fontSize: 10, fontWeight: '600', color: C.gold, letterSpacing: 0.8 },
  unitChip: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.surface2, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)' },
  unitChipActive: { borderColor: C.borderHi, backgroundColor: C.surface3 },
  unitChipText: { fontSize: 12, fontWeight: '600', color: C.textDim },
  unitChipTextActive: { color: C.text },
  unitCard: { backgroundColor: C.surface2, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 14 },
  unitCardLabel: { fontSize: 9, color: C.textDim, letterSpacing: 0.8, fontWeight: '600', marginBottom: 4 },
  unitCardName: { fontSize: 15, fontWeight: '700', color: C.text },
  unitCardSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10 },
  statVal: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 2 },
  statLabel: { fontSize: 9, color: C.textDim, letterSpacing: 0.8, fontWeight: '600' },
  startCard: { backgroundColor: C.surface2, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 },
  startTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  startSub: { fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
  startMeta: { width: '100%', gap: 6 },
  startMetaRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, paddingHorizontal: 12 },
  startMetaLabel: { fontSize: 11, color: C.textDim },
  startMetaVal: { fontSize: 11, color: C.textMuted },
  roomInput: {
    fontSize: 12,
    color: '#f0ede6',
    flex: 1,
    textAlign: 'right',
    paddingVertical: 2,
  },
  btnStart: { width: '100%', backgroundColor: C.green, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnStartText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.4 },
  liveCard: { borderRadius: 16, overflow: 'hidden' },
  liveCardHeader: { backgroundColor: 'rgba(42,157,92,0.1)', borderWidth: 1.5, borderColor: 'rgba(42,157,92,0.25)', borderBottomWidth: 0, borderRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(42,157,92,0.12)', borderWidth: 1, borderColor: 'rgba(42,157,92,0.3)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  liveDot: { width: 6, height: 6, backgroundColor: C.greenLight, borderRadius: 3 },
  livePillText: { fontSize: 10, fontWeight: '700', color: C.greenLight, letterSpacing: 0.8 },
  liveTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  liveSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  liveTimer: { fontSize: 24, fontWeight: '800', color: C.greenLight, letterSpacing: 0.5 },
  liveBody: { backgroundColor: C.surface3, borderWidth: 1.5, borderColor: 'rgba(42,157,92,0.25)', borderTopWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 14, gap: 10 },
  counters: { flexDirection: 'row', gap: 8 },
  counter: { flex: 1, backgroundColor: C.surface2, borderRadius: 10, padding: 10, alignItems: 'center' },
  counterVal: { fontSize: 22, fontWeight: '800' },
  counterLabel: { fontSize: 9, color: C.textDim, letterSpacing: 0.8, fontWeight: '600', marginTop: 2 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.greenLight, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: C.textMuted, textAlign: 'center' },
  btnEnd: { backgroundColor: C.red, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnEndText: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  rosterSection: { gap: 2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  sectionSub: { fontSize: 11, color: C.textDim },
  emptyRoster: { fontSize: 13, color: C.textDim, textAlign: 'center', paddingVertical: 20 },
  rosterItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rosterAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  rosterAvatarText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  rosterName: { fontSize: 12, fontWeight: '500', color: C.text },
  rosterReg: { fontSize: 10, color: C.textDim, marginTop: 1 },
  rosterTime: { fontSize: 10, color: C.textMuted },
  rosterDotPresent: { width: 8, height: 8, backgroundColor: C.greenLight, borderRadius: 4 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: C.surface2, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10, paddingBottom: 20 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 9, fontWeight: '600', color: C.textDim, letterSpacing: 0.8 },
  navLabelActive: { color: C.greenLight },
  radiusChip: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  radiusChipActive: { borderColor: C.borderHi, backgroundColor: 'rgba(201,168,76,0.08)' },
  radiusChipText: { fontSize: 11, fontWeight: '600', color: C.textDim },
  radiusChipTextActive: { color: C.gold },
});
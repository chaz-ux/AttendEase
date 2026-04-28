import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function SessionScreen() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const [session, setSession] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (session_id) load(); }, [session_id]);

  const load = async () => {
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from('sessions').select(`
        id, started_at, ended_at, attendance_open, center_lat, center_lng, radius_meters,
        units:unit_id (code, name),
        classrooms:classroom_id (name),
        profiles:lecturer_id (full_name)
      `).eq('id', session_id).single(),
      supabase.from('attendance_logs').select(`
        id, checked_in_at, is_verified, distance_meters,
        profiles:student_id (full_name, reg_number)
      `).eq('session_id', session_id).order('checked_in_at', { ascending: true }),
    ]);
    if (s) setSession(s);
    if (a) setAttendance(a);
    setLoading(false);
  };

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleAttendance = async () => {
    if (!session) return;
    const newVal = !session.attendance_open;
    await supabase.from('sessions').update({
      attendance_open: newVal,
      ended_at: newVal ? null : new Date().toISOString(),
    }).eq('id', session_id);
    setSession({ ...session, attendance_open: newVal });
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#2a9d5c" size="large" /></View>;
  if (!session) return <View style={s.center}><Text style={{ color: '#506659' }}>Session not found</Text></View>;

  const present = attendance.filter(a => a.is_verified).length;
  const duration = session.ended_at
    ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000)
    : Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);

  const getInitials = (name: string) => name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? '??';

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2a9d5c" />}
      >
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.title}>Session Details</Text>
        </View>

        {/* Session info */}
        <View style={s.infoCard}>
          <View style={[s.statusPill, { backgroundColor: session.attendance_open ? 'rgba(42,157,92,0.12)' : 'rgba(201,168,76,0.1)' }]}>
            <View style={[s.statusDot, { backgroundColor: session.attendance_open ? '#2a9d5c' : '#c9a84c' }]} />
            <Text style={[s.statusText, { color: session.attendance_open ? '#2a9d5c' : '#c9a84c' }]}>
              {session.attendance_open ? 'LIVE' : 'ENDED'}
            </Text>
          </View>
          <Text style={s.infoUnit}>{session.units?.code} — {session.units?.name}</Text>
          <Text style={s.infoSub}>{session.classrooms?.name ?? 'Location-based geofence'}</Text>
          <View style={s.infoMeta}>
            {[
              { label: 'Started', value: new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
              { label: 'Duration', value: `${duration} min` },
              { label: 'Radius', value: `${session.radius_meters}m` },
            ].map(item => (
              <View key={item.label} style={s.metaRow}>
                <Text style={s.metaLabel}>{item.label}</Text>
                <Text style={s.metaVal}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#2a9d5c' }]}>{present}</Text>
            <Text style={s.statLabel}>PRESENT</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#e05252' }]}>{attendance.length - present}</Text>
            <Text style={s.statLabel}>ABSENT</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#c9a84c' }]}>
              {attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0}%
            </Text>
            <Text style={s.statLabel}>RATE</Text>
          </View>
        </View>

        {/* Toggle attendance button */}
        {session.attendance_open && (
          <TouchableOpacity style={s.btnEnd} onPress={toggleAttendance}>
            <Text style={s.btnEndText}>⏹ End Session & Close Attendance</Text>
          </TouchableOpacity>
        )}

        {/* Attendance roster */}
        <Text style={s.rosterTitle}>Attendance Roster</Text>
        {attendance.length === 0 ? (
          <Text style={s.empty}>No check-ins yet</Text>
        ) : (
          attendance.map(entry => (
            <View key={entry.id} style={s.rosterCard}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{getInitials(entry.profiles?.full_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rosterName}>{entry.profiles?.full_name}</Text>
                <Text style={s.rosterReg}>{entry.profiles?.reg_number}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={s.rosterTime}>
                  {new Date(entry.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={s.rosterDist}>{Math.round(entry.distance_meters)}m</Text>
              </View>
              <View style={[s.dot, { backgroundColor: entry.is_verified ? '#2a9d5c' : '#e05252' }]} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f14' },
  center: { flex: 1, backgroundColor: '#0d1f14', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: { width: 36, height: 36, backgroundColor: '#122619', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)' },
  backArrow: { fontSize: 22, color: '#8fa898', lineHeight: 26 },
  title: { fontSize: 18, fontWeight: '800', color: '#f0ede6' },
  infoCard: { backgroundColor: '#122619', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.2)', gap: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  infoUnit: { fontSize: 16, fontWeight: '800', color: '#f0ede6' },
  infoSub: { fontSize: 12, color: '#8fa898' },
  infoMeta: { gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 11, color: '#506659' },
  metaVal: { fontSize: 11, color: '#8fa898' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#122619', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)' },
  statVal: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 9, color: '#506659', letterSpacing: 0.8, fontWeight: '600' },
  btnEnd: { backgroundColor: '#e05252', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnEndText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  rosterTitle: { fontSize: 13, fontWeight: '700', color: '#f0ede6', marginTop: 4 },
  empty: { textAlign: 'center', color: '#506659', fontSize: 13, paddingVertical: 20 },
  rosterCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#122619', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#1a6b3c', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  rosterName: { fontSize: 13, fontWeight: '600', color: '#f0ede6' },
  rosterReg: { fontSize: 10, color: '#506659', marginTop: 1 },
  rosterTime: { fontSize: 11, color: '#8fa898' },
  rosterDist: { fontSize: 10, color: '#506659' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
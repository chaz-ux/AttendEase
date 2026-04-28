import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Share
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [units, setUnits] = useState<any[]>([]);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const [{ data: u }, { data: s }] = await Promise.all([
      supabase.from('units').select('id, code, name').eq('lecturer_id', user!.id),
      supabase.from('sessions').select(`
        id, started_at, ended_at, attendance_open, radius_meters,
        units:unit_id (id, code, name),
        classrooms:classroom_id (name),
        attendance_logs (id, is_verified)
      `)
        .eq('lecturer_id', user!.id)
        .order('started_at', { ascending: false }),
    ]);
    if (u) setUnits(u);
    if (s) setSessions(s);
    setLoading(false);
  };

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const exportSession = async (session: any) => {
    const logs = session.attendance_logs ?? [];
    const present = logs.filter((l: any) => l.is_verified).length;
    const total = logs.length;
    const date = new Date(session.started_at).toLocaleDateString('en-KE');
    const time = new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Fetch full roster for export
    const { data: fullLogs } = await supabase
      .from('attendance_logs')
      .select('is_verified, checked_in_at, distance_meters, profiles:student_id (full_name, reg_number)')
      .eq('session_id', session.id)
      .order('checked_in_at', { ascending: true });

    let csv = `AttendEase Report\n`;
    csv += `Unit: ${session.units?.code} — ${session.units?.name}\n`;
    csv += `Date: ${date} ${time}\n`;
    csv += `Present: ${present}/${total}\n\n`;
    csv += `Reg Number,Full Name,Status,Check-in Time,Distance(m)\n`;

    fullLogs?.forEach(log => {
      const p = log.profiles as any;
      csv += `${p?.reg_number},${p?.full_name},${log.is_verified ? 'Present' : 'Absent'},`;
      csv += `${new Date(log.checked_in_at).toLocaleTimeString()},${Math.round(log.distance_meters)}\n`;
    });

    await Share.share({
      message: csv,
      title: `Attendance Report — ${session.units?.code} ${date}`,
    });
  };

  const filtered = selectedUnit === 'all'
    ? sessions
    : sessions.filter(s => (s.units as any)?.id === selectedUnit);

  const totalSessions = filtered.length;
  const avgAttendance = totalSessions > 0
    ? Math.round(filtered.reduce((acc, s) => {
        const logs = s.attendance_logs ?? [];
        const p = logs.filter((l: any) => l.is_verified).length;
        return acc + (logs.length > 0 ? (p / logs.length) * 100 : 0);
      }, 0) / totalSessions)
    : 0;

  if (loading) return <View style={s.center}><ActivityIndicator color="#2a9d5c" size="large" /></View>;

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
          <Text style={s.title}>Reports</Text>
        </View>

        {/* Summary stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#2a9d5c' }]}>{totalSessions}</Text>
            <Text style={s.statLabel}>SESSIONS</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#c9a84c' }]}>{avgAttendance}%</Text>
            <Text style={s.statLabel}>AVG ATTEND.</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#4a9eda' }]}>{units.length}</Text>
            <Text style={s.statLabel}>UNITS</Text>
          </View>
        </View>

        {/* Unit filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[s.filterChip, selectedUnit === 'all' && s.filterChipActive]}
              onPress={() => setSelectedUnit('all')}
            >
              <Text style={[s.filterChipText, selectedUnit === 'all' && s.filterChipTextActive]}>All units</Text>
            </TouchableOpacity>
            {units.map(u => (
              <TouchableOpacity
                key={u.id}
                style={[s.filterChip, selectedUnit === u.id && s.filterChipActive]}
                onPress={() => setSelectedUnit(u.id)}
              >
                <Text style={[s.filterChipText, selectedUnit === u.id && s.filterChipTextActive]}>{u.code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Session list */}
        {filtered.length === 0 ? (
          <Text style={s.empty}>No sessions yet</Text>
        ) : (
          filtered.map(session => {
            const logs = session.attendance_logs ?? [];
            const present = logs.filter((l: any) => l.is_verified).length;
            const pct = logs.length > 0 ? Math.round((present / logs.length) * 100) : 0;
            const date = new Date(session.started_at);
            return (
              <View key={session.id} style={s.sessionCard}>
                <View style={s.sessionCardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={[s.statusDot, { backgroundColor: session.attendance_open ? '#2a9d5c' : '#506659' }]} />
                      <Text style={s.sessionUnit}>{session.units?.code} — {session.units?.name}</Text>
                    </View>
                    <Text style={s.sessionDate}>
                      {date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={s.sessionRoom}>{session.classrooms?.name ?? 'GPS-based location'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[s.sessionPct, { color: pct >= 70 ? '#2a9d5c' : pct >= 50 ? '#c9a84c' : '#e05252' }]}>
                      {pct}%
                    </Text>
                    <Text style={s.sessionCount}>{present}/{logs.length}</Text>
                  </View>
                </View>

                {/* Progress */}
                <View style={s.progressBg}>
                  <View style={[s.progressFill, {
                    width: `${pct}%` as any,
                    backgroundColor: pct >= 70 ? '#2a9d5c' : pct >= 50 ? '#c9a84c' : '#e05252'
                  }]} />
                </View>

                {/* Actions */}
                <View style={s.sessionActions}>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => router.push({ pathname: '/(lecturer)/session', params: { session_id: session.id } })}
                  >
                    <Text style={s.actionBtnText}>View roster</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnExport]}
                    onPress={() => exportSession(session)}
                  >
                    <Text style={[s.actionBtnText, { color: '#c9a84c' }]}>Export CSV</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
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
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#122619', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)' },
  statVal: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 9, color: '#506659', letterSpacing: 0.8, fontWeight: '600' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#122619', borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)' },
  filterChipActive: { borderColor: 'rgba(201,168,76,0.35)', backgroundColor: '#1a3324' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#506659' },
  filterChipTextActive: { color: '#f0ede6' },
  empty: { textAlign: 'center', color: '#506659', fontSize: 13, paddingVertical: 40 },
  sessionCard: { backgroundColor: '#122619', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)', gap: 10 },
  sessionCardTop: { flexDirection: 'row', gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  sessionUnit: { fontSize: 13, fontWeight: '700', color: '#f0ede6' },
  sessionDate: { fontSize: 11, color: '#8fa898', marginLeft: 16 },
  sessionRoom: { fontSize: 10, color: '#506659', marginLeft: 16, marginTop: 1 },
  sessionPct: { fontSize: 20, fontWeight: '800' },
  sessionCount: { fontSize: 11, color: '#8fa898' },
  progressBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  sessionActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, backgroundColor: '#1a3324', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  actionBtnExport: { borderColor: 'rgba(201,168,76,0.25)' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#8fa898' },
});
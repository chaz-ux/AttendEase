import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all');

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from('attendance_logs')
      .select(`
        id, checked_in_at, is_verified, distance_meters,
        sessions:session_id (
          started_at, ended_at,
          units:unit_id (code, name),
          classrooms:classroom_id (name)
        )
      `)
      .eq('student_id', user!.id)
      .order('checked_in_at', { ascending: false });

    if (data) {
      setLogs(data);
      setStats({
        total: data.length,
        present: data.filter(d => d.is_verified).length,
        absent: data.filter(d => !d.is_verified).length,
        late: 0,
      });
    }
    setLoading(false);
  };

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = filter === 'all' ? logs : filter === 'present' ? logs.filter(l => l.is_verified) : logs.filter(l => !l.is_verified);
  const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  if (loading) return <View style={s.center}><ActivityIndicator color="#2a9d5c" size="large" /></View>;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2a9d5c" />}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.title}>Attendance History</Text>
        </View>

        {/* Stats cards */}
        <View style={s.statsRow}>
          {[
            { label: 'TOTAL', val: stats.total, color: '#8fa898' },
            { label: 'PRESENT', val: stats.present, color: '#2a9d5c' },
            { label: 'ABSENT', val: stats.absent, color: '#e05252' },
            { label: 'RATE', val: `${pct}%`, color: '#c9a84c' },
          ].map(item => (
            <View key={item.label} style={s.statCard}>
              <Text style={[s.statVal, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar */}
        <View style={s.progressWrap}>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={s.progressLabel}>{pct}% overall attendance</Text>
        </View>

        {/* Filter tabs */}
        <View style={s.filterBar}>
          {(['all', 'present', 'absent'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, filter === f && s.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterTabText, filter === f && s.filterTabTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Log list */}
        {filtered.length === 0 ? (
          <Text style={s.empty}>No records found</Text>
        ) : (
          filtered.map(log => {
            const session = log.sessions as any;
            const unit = session?.units;
            const room = session?.classrooms;
            const date = new Date(log.checked_in_at);
            return (
              <View key={log.id} style={s.logCard}>
                <View style={[s.logDot, { backgroundColor: log.is_verified ? '#2a9d5c' : '#e05252' }]} />
                <View style={s.logInfo}>
                  <Text style={s.logUnit}>{unit?.code} — {unit?.name}</Text>
                  <Text style={s.logMeta}>
                    {date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {room ? ` · ${room.name}` : ''}
                  </Text>
                  {log.is_verified && (
                    <Text style={s.logDistance}>{Math.round(log.distance_meters)}m from classroom center</Text>
                  )}
                </View>
                <View style={[s.logBadge, { backgroundColor: log.is_verified ? 'rgba(42,157,92,0.1)' : 'rgba(224,82,82,0.1)' }]}>
                  <Text style={[s.logBadgeText, { color: log.is_verified ? '#2a9d5c' : '#e05252' }]}>
                    {log.is_verified ? 'Present' : 'Absent'}
                  </Text>
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
  statVal: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 9, color: '#506659', letterSpacing: 0.8, fontWeight: '600' },
  progressWrap: { gap: 6 },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2a9d5c', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: '#8fa898', textAlign: 'center' },
  filterBar: { flexDirection: 'row', backgroundColor: '#1a3324', borderRadius: 10, padding: 4, gap: 4 },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center' },
  filterTabActive: { backgroundColor: '#122619' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#506659' },
  filterTabTextActive: { color: '#f0ede6' },
  empty: { textAlign: 'center', color: '#506659', fontSize: 13, paddingVertical: 40 },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#122619', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)' },
  logDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  logInfo: { flex: 1, gap: 3 },
  logUnit: { fontSize: 13, fontWeight: '600', color: '#f0ede6' },
  logMeta: { fontSize: 11, color: '#8fa898' },
  logDistance: { fontSize: 10, color: '#506659' },
  logBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  logBadgeText: { fontSize: 10, fontWeight: '700' },
});
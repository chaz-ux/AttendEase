import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function AdminDashboard() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [stats, setStats] = useState({ students: 0, lecturers: 0, sessions: 0, checkins: 0 });
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'overview' | 'users' | 'sessions'>('overview');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [
      { count: students },
      { count: lecturers },
      { count: sessions },
      { count: checkins },
      { data: recentS },
      { data: allUsers },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'lecturer'),
      supabase.from('sessions').select('id', { count: 'exact', head: true }),
      supabase.from('attendance_logs').select('id', { count: 'exact', head: true }).eq('is_verified', true),
      supabase.from('sessions').select(`
        id, started_at, ended_at, attendance_open,
        units:unit_id (code, name),
        profiles:lecturer_id (full_name),
        attendance_logs (id, is_verified)
      `).order('started_at', { ascending: false }).limit(10),
      supabase.from('profiles').select('id, full_name, role, reg_number, created_at').order('created_at', { ascending: false }).limit(50),
    ]);

    setStats({
      students: students ?? 0,
      lecturers: lecturers ?? 0,
      sessions: sessions ?? 0,
      checkins: checkins ?? 0,
    });
    if (recentS) setRecentSessions(recentS);
    if (allUsers) setUsers(allUsers);
    setLoading(false);
  };

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const deleteUser = (userId: string, name: string) => {
    Alert.alert(`Remove ${name}?`, 'This will delete their profile and all attendance records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('profiles').delete().eq('id', userId);
          await load();
        }
      }
    ]);
  };

  const getRoleColor = (role: string) => role === 'lecturer' ? '#c9a84c' : role === 'admin' ? '#4a9eda' : '#2a9d5c';

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
          <View>
            <Text style={s.headerSub}>Admin Panel</Text>
            <Text style={s.headerTitle}>AttendEase</Text>
          </View>
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Text style={s.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          {[
            { label: 'STUDENTS', val: stats.students, color: '#2a9d5c' },
            { label: 'LECTURERS', val: stats.lecturers, color: '#c9a84c' },
            { label: 'SESSIONS', val: stats.sessions, color: '#4a9eda' },
            { label: 'CHECK-INS', val: stats.checkins, color: '#f0ede6' },
          ].map(item => (
            <View key={item.label} style={s.statCard}>
              <Text style={[s.statVal, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={s.tabBar}>
          {(['overview', 'users', 'sessions'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview tab */}
        {tab === 'overview' && (
          <View style={{ gap: 10 }}>
            <Text style={s.sectionTitle}>Platform health</Text>
            {[
              { label: 'Total attendance rate', value: stats.sessions > 0 ? `${Math.round((stats.checkins / (stats.sessions * Math.max(stats.students, 1))) * 100)}%` : '—' },
              { label: 'Avg check-ins per session', value: stats.sessions > 0 ? Math.round(stats.checkins / stats.sessions) : 0 },
              { label: 'Active users', value: stats.students + stats.lecturers },
            ].map(item => (
              <View key={item.label} style={s.metaRow}>
                <Text style={s.metaLabel}>{item.label}</Text>
                <Text style={s.metaVal}>{item.value}</Text>
              </View>
            ))}

            <Text style={[s.sectionTitle, { marginTop: 8 }]}>Recent sessions</Text>
            {recentSessions.slice(0, 5).map(session => {
              const logs = session.attendance_logs ?? [];
              const present = logs.filter((l: any) => l.is_verified).length;
              return (
                <View key={session.id} style={s.sessionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionUnit}>{session.units?.code}</Text>
                    <Text style={s.sessionMeta}>{session.profiles?.full_name} · {new Date(session.started_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: session.attendance_open ? 'rgba(42,157,92,0.1)' : 'rgba(80,102,89,0.1)' }]}>
                    <Text style={[s.statusBadgeText, { color: session.attendance_open ? '#2a9d5c' : '#506659' }]}>
                      {session.attendance_open ? 'Live' : 'Ended'}
                    </Text>
                  </View>
                  <Text style={s.sessionCount}>{present}/{logs.length}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <View style={{ gap: 8 }}>
            <Text style={s.sectionTitle}>{users.length} registered users</Text>
            {users.map(user => (
              <View key={user.id} style={s.userRow}>
                <View style={[s.avatar, { backgroundColor: user.role === 'lecturer' ? '#1a3a1a' : '#0d1f14' }]}>
                  <Text style={s.avatarText}>
                    {user.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{user.full_name}</Text>
                  <Text style={s.userReg}>{user.reg_number}</Text>
                </View>
                <View style={[s.roleBadge, { backgroundColor: `${getRoleColor(user.role)}18` }]}>
                  <Text style={[s.roleText, { color: getRoleColor(user.role) }]}>{user.role}</Text>
                </View>
                {user.role !== 'admin' && (
                  <TouchableOpacity onPress={() => deleteUser(user.id, user.full_name)}>
                    <Text style={s.deleteBtn}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Sessions tab */}
        {tab === 'sessions' && (
          <View style={{ gap: 8 }}>
            <Text style={s.sectionTitle}>All sessions</Text>
            {recentSessions.map(session => {
              const logs = session.attendance_logs ?? [];
              const present = logs.filter((l: any) => l.is_verified).length;
              const pct = logs.length > 0 ? Math.round((present / logs.length) * 100) : 0;
              return (
                <View key={session.id} style={s.sessionCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={s.sessionUnit}>{session.units?.code} — {session.units?.name}</Text>
                    <Text style={[s.sessionPct, { color: pct >= 70 ? '#2a9d5c' : pct >= 50 ? '#c9a84c' : '#e05252' }]}>{pct}%</Text>
                  </View>
                  <Text style={s.sessionMeta}>{session.profiles?.full_name} · {new Date(session.started_at).toLocaleString()}</Text>
                  <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 70 ? '#2a9d5c' : '#c9a84c' }]} />
                  </View>
                  <Text style={s.sessionCount}>{present} of {logs.length} checked in</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f14' },
  center: { flex: 1, backgroundColor: '#0d1f14', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSub: { fontSize: 11, color: '#506659', fontWeight: '300' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#f0ede6' },
  signOutBtn: { backgroundColor: '#1a3324', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(224,82,82,0.3)' },
  signOutText: { fontSize: 12, fontWeight: '600', color: '#e05252' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48%', backgroundColor: '#122619', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)' },
  statVal: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 9, color: '#506659', letterSpacing: 0.8, fontWeight: '600' },
  tabBar: { flexDirection: 'row', backgroundColor: '#1a3324', borderRadius: 10, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center' },
  tabActive: { backgroundColor: '#122619' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#506659' },
  tabTextActive: { color: '#f0ede6' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#f0ede6' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#122619', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  metaLabel: { fontSize: 12, color: '#506659' },
  metaVal: { fontSize: 12, fontWeight: '600', color: '#8fa898' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#122619', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sessionUnit: { fontSize: 13, fontWeight: '700', color: '#f0ede6' },
  sessionMeta: { fontSize: 10, color: '#506659', marginTop: 2 },
  sessionCount: { fontSize: 11, color: '#8fa898' },
  sessionPct: { fontSize: 16, fontWeight: '800' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#122619', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#1a6b3c', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 13, fontWeight: '600', color: '#f0ede6' },
  userReg: { fontSize: 10, color: '#506659', marginTop: 1 },
  roleBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 10, fontWeight: '700' },
  deleteBtn: { fontSize: 14, color: '#e05252', paddingHorizontal: 4 },
  sessionCard: { backgroundColor: '#122619', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 6 },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});

import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        fetchRole(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes — login, logout, token refresh
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    setRole(data?.role ?? 'student');
    setLoading(false);
  };

  useEffect(() => {
    if (loading) return;

    const inAuth     = segments[0] === '(auth)';
    const inStudent  = segments[0] === '(student)';
    const inLecturer = segments[0] === '(lecturer)';
    const inAdmin    = segments[0] === '(admin)';

    if (!session) {
      // Not logged in — always go to login
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    // Logged in — route by role
    if (role === 'lecturer') {
      if (!inLecturer) router.replace('/(lecturer)/dashboard');
    } else if (role === 'admin') {
      if (!inAdmin) router.replace('/(admin)/dashboard');
    } else {
      // Default: student
      if (!inStudent) router.replace('/(student)/home');
    }
  }, [session, role, loading]);

  // Splash screen while checking auth
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d1f14', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2a9d5c" size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#0d1f14' },
      }}
    />
  );
}
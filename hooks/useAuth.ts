import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import type { Session, User } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await registerDevice();
  };

  const signInWithBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!compatible || !enrolled) {
      throw new Error('Biometric not available on this device');
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity to mark attendance',
      cancelLabel: 'Use password instead',
      fallbackLabel: 'Use password',
    });

    if (!result.success) throw new Error('Biometric authentication failed');
    return result;
  };

  const registerDevice = async () => {
    const deviceId = Device.modelId ?? Device.deviceName ?? 'unknown';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ device_id: deviceId })
      .eq('id', user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    session,
    user,
    loading,
    signInWithPassword,
    signInWithBiometric,
    signOut,
  };
}

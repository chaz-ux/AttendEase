import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Alert, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

export default function BiometricScreen() {
  const router = useRouter();
  const { email, password } = useLocalSearchParams<{ email: string; password: string }>();
  const { signInWithPassword, signInWithBiometric } = useAuth();

  const [state, setState] = useState<ScanState>('idle');
  const barAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleScan = async () => {
    if (state !== 'idle') return;
    setState('scanning');

    Animated.timing(barAnim, {
      toValue: 1, duration: 1800, useNativeDriver: false,
    }).start();

    try {
      // Verify biometric (proves it's physically the same person)
      await signInWithBiometric();

      // If email/password params exist, complete the sign in
      if (email && password) {
        await signInWithPassword(email, password);
      }
      // If no params, session already exists in storage
      // _layout.tsx will handle routing once verified

      setState('success');
      // _layout.tsx detects session and routes automatically
    } catch (e: any) {
      setState('error');
      Alert.alert('Verification failed', e.message);
      setTimeout(() => {
        // Fall back to password login
        router.replace('/(auth)/login');
      }, 2000);
    }
  };

  const stateContent = {
    idle:     { title: 'Verify your identity',  sub: 'Place your finger on the sensor' },
    scanning: { title: 'Hold still…',           sub: 'Reading fingerprint' },
    success:  { title: 'Identity confirmed',    sub: 'Signing you in…' },
    error:    { title: 'Try again',             sub: 'Fingerprint not recognised' },
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backArrow}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.stepText}>IDENTITY VERIFICATION</Text>

      <View style={styles.fpSection}>
        <Animated.View style={[styles.fpRing, { transform: [{ scale: pulseAnim }] }]} />
        <View style={[
          styles.fpCircle,
          state === 'scanning' && styles.fpCircleScanning,
          state === 'success'  && styles.fpCircleSuccess,
          state === 'error'    && styles.fpCircleError,
        ]}>
          {state === 'scanning'
            ? <ActivityIndicator size="large" color="#2a9d5c" />
            : <Text style={styles.fpEmoji}>
                {state === 'success' ? '✓' : state === 'error' ? '✗' : '👆'}
              </Text>
          }
        </View>
      </View>

      <View style={styles.barWrap}>
        <Animated.View style={[styles.bar, {
          width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: state === 'success' ? '#c9a84c' : state === 'error' ? '#e05252' : '#2a9d5c',
        }]} />
      </View>

      <Text style={styles.title}>{stateContent[state].title}</Text>
      <Text style={styles.sub}>{stateContent[state].sub}</Text>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnScan, state !== 'idle' && { opacity: 0.5 }]}
          onPress={handleScan}
          disabled={state !== 'idle'}
        >
          <Text style={styles.btnScanText}>
            {state === 'idle' ? 'Touch Sensor to Verify'
              : state === 'scanning' ? 'Scanning…'
              : state === 'success' ? '✓ Verified'
              : 'Try Again'}
          </Text>
        </TouchableOpacity>

        {/* Skip biometric — complete sign in with password only */}
        <TouchableOpacity
          style={styles.btnGhost}
          onPress={async () => {
            if (!email || !password) { router.back(); return; }
            try {
              await signInWithPassword(email as string, password as string);
              // _layout.tsx handles routing after session is set
            } catch (e: any) {
              Alert.alert('Sign in failed', e.message);
              router.back();
            }
          }}
        >
          <Text style={styles.btnGhostText}>Skip — Sign In with Password Only</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const C = {
  surface: '#0d1f14', surface2: '#122619',
  green: '#1a6b3c', greenLight: '#2a9d5c',
  gold: '#c9a84c', borderHi: 'rgba(201,168,76,0.35)',
  text: '#f0ede6', textMuted: '#8fa898', textDim: '#506659',
  red: '#e05252',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface, padding: 28, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', width: 36, height: 36, backgroundColor: C.surface2, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)' },
  backArrow: { fontSize: 22, color: '#8fa898', lineHeight: 26 },
  stepText: { fontSize: 11, fontWeight: '600', color: '#506659', letterSpacing: 1.2, marginTop: 32, marginBottom: 40 },
  fpSection: { alignItems: 'center', justifyContent: 'center', height: 160, marginBottom: 24 },
  fpRing: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(26,107,60,0.3)' },
  fpCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.surface2, borderWidth: 2, borderColor: C.borderHi, alignItems: 'center', justifyContent: 'center' },
  fpCircleScanning: { borderColor: C.greenLight },
  fpCircleSuccess:  { borderColor: C.gold },
  fpCircleError:    { borderColor: C.red },
  fpEmoji: { fontSize: 36 },
  barWrap: { height: 3, backgroundColor: C.surface2, borderRadius: 2, overflow: 'hidden', marginBottom: 24, width: '60%' },
  bar: { height: '100%', borderRadius: 2 },
  title: { fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 13, color: '#8fa898', textAlign: 'center', fontWeight: '300', lineHeight: 20, marginBottom: 'auto' },
  footer: { width: '100%', gap: 10, paddingBottom: 8 },
  btnScan: { backgroundColor: C.green, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnScanText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  btnGhost: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  btnGhostText: { fontSize: 13, fontWeight: '500', color: '#8fa898' },
});
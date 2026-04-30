import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator, View,
} from 'react-native';

export type AttendanceStatus =
  | 'idle'
  | 'checking'
  | 'verified'
  | 'outside'
  | 'already_checked'
  | 'no_session';

interface Props {
  status: AttendanceStatus;
  distanceMeters?: number;
  onPress: () => void;
}

const CONFIG: Record<AttendanceStatus, {
  color: string; label: string; sub: string; icon: string; disabled: boolean;
}> = {
  idle:           { color: '#1a6b3c', label: 'MARK PRESENT',  sub: 'Tap to check in',             icon: '✓', disabled: false },
  checking:       { color: '#1a6b3c', label: 'VERIFYING…',    sub: 'Getting GPS location',         icon: '⊙', disabled: true  },
  verified:       { color: '#c9a84c', label: 'CHECKED IN',    sub: 'Attendance recorded',          icon: '★', disabled: true  },
  outside:        { color: '#e05252', label: 'TOO FAR',       sub: 'Move closer to classroom',     icon: '✗', disabled: true  },
  already_checked:{ color: '#c9a84c', label: 'ALREADY IN',   sub: 'You checked in earlier',       icon: '★', disabled: true  },
  no_session:     { color: '#1a3324', label: 'NO SESSION',    sub: 'No active class right now',    icon: '○', disabled: true  },
};

export default function AttendanceButton({ status, distanceMeters, onPress }: Props) {
  const config = CONFIG[status];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1400, useNativeDriver: true }),
      ])
    );
    const ring = Animated.loop(
      Animated.timing(ringRotation, { toValue: 1, duration: 4000, useNativeDriver: true })
    );
    if (status === 'idle') { pulse.start(); ring.start(); }
    return () => { pulse.stop(); ring.stop(); };
  }, [status]);

  const spin = ringRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const sub = status === 'outside' && distanceMeters != null
    ? `${Math.round(distanceMeters)}m from classroom`
    : config.sub;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.scaleWrap, status === 'idle' && { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: config.color }]}
          onPress={onPress}
          disabled={config.disabled}
          activeOpacity={0.85}
        >
          {status === 'idle' && (
            <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />
          )}
          {status === 'checking'
            ? <ActivityIndicator color="#fff" size="large" />
            : <Text style={styles.icon}>{config.icon}</Text>
          }
          <Text style={styles.label}>{config.label}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:       { alignItems: 'center' },
  scaleWrap:  { alignItems: 'center' },
  btn: {
    width: 160, height: 160, borderRadius: 80,
    alignItems: 'center', justifyContent: 'center',
    gap: 4, position: 'relative',
  },
  ring: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 1.5, borderColor: 'rgba(42,157,92,0.2)', borderStyle: 'dashed',
  },
  icon:  { fontSize: 36, color: '#fff' },
  label: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.8 },
  sub:   { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
});
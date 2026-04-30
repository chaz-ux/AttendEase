import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  inside: boolean;
  distanceMeters: number;
  accuracy: number | null;
}

export default function GPSStatusBadge({ inside, distanceMeters, accuracy }: Props) {
  const color = inside ? '#2a9d5c' : '#e05252';
  const borderColor = inside ? 'rgba(42,157,92,0.3)' : 'rgba(224,82,82,0.3)';
  const badgeBg = inside ? 'rgba(42,157,92,0.12)' : 'rgba(224,82,82,0.1)';

  return (
    <View style={[styles.card, { borderColor }]}>
      <Text style={styles.icon}>{inside ? '📍' : '⚠️'}</Text>
      <View style={styles.info}>
        <Text style={styles.title}>
          {inside ? 'Inside classroom' : 'Outside classroom range'}
        </Text>
        <Text style={styles.sub}>
          {Math.round(distanceMeters)}m away
          {accuracy != null ? ` · ±${Math.round(accuracy)}m accuracy` : ''}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badgeBg }]}>
        <Text style={[styles.badgeText, { color }]}>
          {inside ? 'IN RANGE' : 'OUT'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#122619', borderWidth: 1.5, borderRadius: 14, padding: 12,
  },
  icon:  { fontSize: 18 },
  info:  { flex: 1 },
  title: { fontSize: 12, fontWeight: '500', color: '#f0ede6' },
  sub:   { fontSize: 11, color: '#8fa898', marginTop: 1 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
});
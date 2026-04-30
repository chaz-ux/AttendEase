import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  unitCode: string;
  unitName: string;
  date: Date;
  roomName: string | null;
  present: number;
  total: number;
  isLive?: boolean;
  onViewRoster: () => void;
  onExport: () => void;
}

export default function ReportCard({
  unitCode, unitName, date, roomName,
  present, total, isLive,
  onViewRoster, onExport,
}: Props) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const pctColor = pct >= 70 ? '#2a9d5c' : pct >= 50 ? '#c9a84c' : '#e05252';

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: isLive ? '#2a9d5c' : '#506659' }]} />
            <Text style={styles.unit}>{unitCode} — {unitName}</Text>
          </View>
          <Text style={styles.date}>
            {date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' · '}
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.room}>{roomName ?? 'GPS-based location'}</Text>
        </View>
        <View style={styles.pctBlock}>
          <Text style={[styles.pct, { color: pctColor }]}>{pct}%</Text>
          <Text style={styles.count}>{present}/{total}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pctColor }]} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={onViewRoster}>
          <Text style={styles.btnText}>View roster</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnExport]} onPress={onExport}>
          <Text style={[styles.btnText, { color: '#c9a84c' }]}>Export CSV</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#122619', borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)', gap: 10,
  },
  top:      { flexDirection: 'row', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot:      { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  unit:     { fontSize: 13, fontWeight: '700', color: '#f0ede6' },
  date:     { fontSize: 11, color: '#8fa898', marginLeft: 16 },
  room:     { fontSize: 10, color: '#506659', marginLeft: 16, marginTop: 1 },
  pctBlock: { alignItems: 'flex-end', gap: 4 },
  pct:      { fontSize: 20, fontWeight: '800' },
  count:    { fontSize: 11, color: '#8fa898' },
  progressBg:   { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  actions:  { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, backgroundColor: '#1a3324', borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  btnExport: { borderColor: 'rgba(201,168,76,0.25)' },
  btnText:   { fontSize: 12, fontWeight: '600', color: '#8fa898' },
});
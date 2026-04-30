import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface SessionData {
  started_at: string;
  attendance_logs: { is_verified: boolean }[];
  units?: { code: string; name: string };
}

interface Props {
  sessions: SessionData[];
}

const C = {
  surface2: '#122619',
  surface3: '#1a3324',
  green: '#2a9d5c',
  gold: '#c9a84c',
  red: '#e05252',
  blue: '#4a9eda',
  text: '#f0ede6',
  textMuted: '#8fa898',
  textDim: '#506659',
  border: 'rgba(255,255,255,0.05)',
};

// ── Bar Chart ────────────────────────────────────────────────────────────────
function AttendanceBarChart({ sessions }: { sessions: SessionData[] }) {
  const data = useMemo(() => {
    return sessions.slice(0, 8).reverse().map((s, i) => {
      const logs = s.attendance_logs ?? [];
      const present = logs.filter(l => l.is_verified).length;
      const pct = logs.length > 0 ? Math.round((present / logs.length) * 100) : 0;
      const date = new Date(s.started_at);
      return {
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        pct,
        present,
        total: logs.length,
        unit: s.units?.code ?? '—',
        color: pct >= 70 ? C.green : pct >= 50 ? C.gold : C.red,
      };
    });
  }, [sessions]);

  const maxPct = Math.max(...data.map(d => d.pct), 1);
  const BAR_HEIGHT = 100;

  if (data.length === 0) return null;

  return (
    <View style={chart.card}>
      <Text style={chart.title}>Attendance Per Session</Text>
      <Text style={chart.sub}>Last {data.length} sessions</Text>

      <View style={chart.barArea}>
        {/* Y-axis labels */}
        <View style={chart.yAxis}>
          {[100, 75, 50, 25, 0].map(v => (
            <Text key={v} style={chart.yLabel}>{v}%</Text>
          ))}
        </View>

        {/* Bars */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={chart.barsRow}>
            {data.map((d, i) => (
              <View key={i} style={chart.barGroup}>
                {/* Value label on top */}
                <Text style={[chart.barVal, { color: d.color }]}>{d.pct}%</Text>
                {/* Bar container */}
                <View style={[chart.barBg, { height: BAR_HEIGHT }]}>
                  <View style={[
                    chart.barFill,
                    {
                      height: `${(d.pct / maxPct) * 100}%` as any,
                      backgroundColor: d.color,
                      opacity: 0.85,
                    }
                  ]} />
                </View>
                {/* X label */}
                <Text style={chart.xLabel}>{d.label}</Text>
                <Text style={chart.xUnit}>{d.unit}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={chart.legend}>
        {[
          { color: C.green, label: '≥70% Good' },
          { color: C.gold,  label: '50–69% OK' },
          { color: C.red,   label: '<50% Low' },
        ].map(item => (
          <View key={item.label} style={chart.legendItem}>
            <View style={[chart.legendDot, { backgroundColor: item.color }]} />
            <Text style={chart.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Trend Line (simple dots + line) ─────────────────────────────────────────
function TrendLine({ sessions }: { sessions: SessionData[] }) {
  const data = useMemo(() => {
    return sessions.slice(0, 10).reverse().map(s => {
      const logs = s.attendance_logs ?? [];
      const present = logs.filter(l => l.is_verified).length;
      return logs.length > 0 ? Math.round((present / logs.length) * 100) : 0;
    });
  }, [sessions]);

  if (data.length < 2) return null;

  const W = 280;
  const H = 60;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (v / max) * H,
    v,
  }));

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  ).join(' ');

  // Trend direction
  const first = data[0];
  const last = data[data.length - 1];
  const trend = last > first ? '↑' : last < first ? '↓' : '→';
  const trendColor = last > first ? C.green : last < first ? C.red : C.gold;

  return (
    <View style={chart.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={chart.title}>Attendance Trend</Text>
          <Text style={chart.sub}>Over last {data.length} sessions</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[chart.trendArrow, { color: trendColor }]}>{trend}</Text>
          <Text style={[chart.trendVal, { color: trendColor }]}>
            {last > first ? '+' : ''}{last - first}%
          </Text>
        </View>
      </View>

      {/* SVG-like using Views since RN doesn't support SVG without a lib */}
      <View style={[chart.lineArea, { height: H + 20 }]}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => (
          <View
            key={v}
            style={[
              chart.gridLine,
              { bottom: ((v / max) * H) + 10 }
            ]}
          />
        ))}

        {/* Dot connectors — simple approach using absolute positioned dots */}
        {points.map((p, i) => (
          <React.Fragment key={i}>
            {/* Connector line to next point */}
            {i < points.length - 1 && (() => {
              const next = points[i + 1];
              const dx = next.x - p.x;
              const dy = next.y - p.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View style={[
                  chart.connector,
                  {
                    left: p.x,
                    bottom: H - p.y + 10,
                    width: len,
                    transform: [{ rotate: `${angle}deg` }],
                    transformOrigin: '0 0',
                  }
                ]} />
              );
            })()}
            {/* Dot */}
            <View style={[
              chart.dot,
              {
                left: p.x - 4,
                bottom: H - p.y + 6,
                backgroundColor: p.v >= 70 ? C.green : p.v >= 50 ? C.gold : C.red,
              }
            ]}>
              <View style={chart.dotInner} />
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={chart.xLabel}>Session 1</Text>
        <Text style={chart.xLabel}>Latest</Text>
      </View>
    </View>
  );
}

// ── Donut / Summary Ring ─────────────────────────────────────────────────────
function SummaryRing({ sessions }: { sessions: SessionData[] }) {
  const stats = useMemo(() => {
    const good = sessions.filter(s => {
      const logs = s.attendance_logs ?? [];
      const pct = logs.length > 0 ? (logs.filter(l => l.is_verified).length / logs.length) * 100 : 0;
      return pct >= 70;
    }).length;
    const ok = sessions.filter(s => {
      const logs = s.attendance_logs ?? [];
      const pct = logs.length > 0 ? (logs.filter(l => l.is_verified).length / logs.length) * 100 : 0;
      return pct >= 50 && pct < 70;
    }).length;
    const low = sessions.length - good - ok;
    const totalPresent = sessions.reduce((acc, s) => acc + (s.attendance_logs ?? []).filter(l => l.is_verified).length, 0);
    const totalLogs = sessions.reduce((acc, s) => acc + (s.attendance_logs ?? []).length, 0);
    const avgPct = totalLogs > 0 ? Math.round((totalPresent / totalLogs) * 100) : 0;
    return { good, ok, low, avgPct, total: sessions.length };
  }, [sessions]);

  const SIZE = 100;
  const STROKE = 10;
  const R = (SIZE / 2) - STROKE;
  const CIRC = 2 * Math.PI * R;

  const goodDash = (stats.good / Math.max(stats.total, 1)) * CIRC;
  const okDash   = (stats.ok   / Math.max(stats.total, 1)) * CIRC;
  const lowDash  = (stats.low  / Math.max(stats.total, 1)) * CIRC;

  return (
    <View style={chart.card}>
      <Text style={chart.title}>Session Quality</Text>
      <Text style={chart.sub}>{stats.total} total sessions</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
        {/* Ring — using nested border-radius Views as fake donut */}
        <View style={chart.ringWrap}>
          <View style={chart.ringOuter}>
            <View style={chart.ringInner}>
              <Text style={chart.ringVal}>{stats.avgPct}%</Text>
              <Text style={chart.ringLabel}>avg</Text>
            </View>
          </View>
          {/* Color arc segments as thin colored borders */}
          <View style={[chart.ringArc, { borderColor: C.green, opacity: stats.good / Math.max(stats.total, 1) + 0.2 }]} />
        </View>

        {/* Breakdown */}
        <View style={{ flex: 1, gap: 8 }}>
          {[
            { label: 'High (≥70%)',   count: stats.good, color: C.green },
            { label: 'Medium (50%+)', count: stats.ok,   color: C.gold  },
            { label: 'Low (<50%)',    count: stats.low,  color: C.red   },
          ].map(item => (
            <View key={item.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={[chart.legendText, { color: item.color }]}>{item.label}</Text>
                <Text style={[chart.legendText, { color: item.color }]}>{item.count}</Text>
              </View>
              <View style={chart.miniBarBg}>
                <View style={[
                  chart.miniBarFill,
                  {
                    width: `${(item.count / Math.max(stats.total, 1)) * 100}%` as any,
                    backgroundColor: item.color,
                  }
                ]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Main Analytics Component ─────────────────────────────────────────────────
export default function AnalyticsCharts({ sessions }: Props) {
  if (!sessions || sessions.length === 0) {
    return (
      <View style={chart.empty}>
        <Text style={chart.emptyText}>No session data yet</Text>
        <Text style={chart.emptySub}>Charts will appear after sessions are completed</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <SummaryRing sessions={sessions} />
      <AttendanceBarChart sessions={sessions} />
      <TrendLine sessions={sessions} />
    </View>
  );
}

const chart = StyleSheet.create({
  card: {
    backgroundColor: C.surface2, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: C.border, gap: 4,
  },
  title:    { fontSize: 13, fontWeight: '700', color: C.text },
  sub:      { fontSize: 10, color: C.textDim, marginBottom: 8 },
  trendArrow: { fontSize: 20, fontWeight: '800' },
  trendVal:   { fontSize: 11, fontWeight: '600' },

  // Bar chart
  barArea:  { flexDirection: 'row', gap: 8, marginTop: 8 },
  yAxis:    { justifyContent: 'space-between', paddingVertical: 4, width: 28 },
  yLabel:   { fontSize: 8, color: C.textDim, textAlign: 'right' },
  barsRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 4 },
  barGroup: { alignItems: 'center', width: 36 },
  barVal:   { fontSize: 9, fontWeight: '700', marginBottom: 3 },
  barBg:    { width: 24, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill:  { width: '100%', borderRadius: 4 },
  xLabel:   { fontSize: 8, color: C.textDim, marginTop: 4, textAlign: 'center' },
  xUnit:    { fontSize: 7, color: '#333f38', textAlign: 'center' },

  // Legend
  legend:     { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 10, color: C.textDim },

  // Trend line
  lineArea:   { position: 'relative', width: '100%', marginTop: 8 },
  gridLine:   { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  connector:  { position: 'absolute', height: 1.5, backgroundColor: C.green, opacity: 0.6 },
  dot:        { position: 'absolute', width: 8, height: 8, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  dotInner:   { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff', opacity: 0.8 },

  // Ring
  ringWrap:   { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  ringOuter:  { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center', borderWidth: 8, borderColor: C.green },
  ringInner:  { alignItems: 'center' },
  ringArc:    { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 8, borderColor: 'transparent' },
  ringVal:    { fontSize: 16, fontWeight: '800', color: C.text },
  ringLabel:  { fontSize: 9, color: C.textDim },

  // Mini bar
  miniBarBg:   { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },

  // Empty
  empty:    { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 13, color: C.textDim, fontWeight: '600' },
  emptySub:  { fontSize: 11, color: '#333f38', marginTop: 4, textAlign: 'center' },
});
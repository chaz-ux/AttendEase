import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';

export default function CalibrateScreen() {
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [watching, setWatching] = useState(false);
  let watcher: any = null;

  useEffect(() => {
    loadClassrooms();
    return () => watcher?.remove();
  }, []);

  const loadClassrooms = async () => {
    const { data } = await supabase
      .from('classrooms')
      .select('id, name, center_lat, center_lng, radius_meters, buildings(name)')
      .order('name');
    if (data) setClassrooms(data);
  };

  const startWatching = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    setWatching(true);
    watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000 },
      loc => setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? 0,
      })
    );
  };

  const updateClassroomCoords = async (id: string, name: string) => {
    if (!location) { Alert.alert('No GPS fix yet'); return; }
    Alert.alert(
      `Update ${name}?`,
      `Set center to:\n${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}\n±${Math.round(location.accuracy)}m accuracy`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update', onPress: async () => {
            await supabase.from('classrooms').update({
              center_lat: location.lat,
              center_lng: location.lng,
            }).eq('id', id);
            await loadClassrooms();
            Alert.alert('Updated!', `${name} coordinates saved.`);
          }
        }
      ]
    );
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>GPS Calibration Tool</Text>
      <Text style={s.sub}>Walk to each room, stand in the center, tap Update</Text>

      <View style={s.gpsBox}>
        {location ? (
          <>
            <Text style={s.coords}>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</Text>
            <Text style={s.accuracy}>±{Math.round(location.accuracy)}m accuracy</Text>
          </>
        ) : (
          <Text style={s.waiting}>GPS not active</Text>
        )}
      </View>

      {!watching && (
        <TouchableOpacity style={s.btnStart} onPress={startWatching}>
          <Text style={s.btnStartText}>Start GPS Tracking</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1 }}>
        {classrooms.map(room => (
          <View key={room.id} style={s.roomRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.roomName}>{room.name}</Text>
              <Text style={s.roomCoords}>
                {room.center_lat.toFixed(6)}, {room.center_lng.toFixed(6)} · r={room.radius_meters}m
              </Text>
              <Text style={s.roomBuilding}>{room.buildings?.name}</Text>
            </View>
            <TouchableOpacity
              style={[s.updateBtn, !location && { opacity: 0.4 }]}
              onPress={() => updateClassroomCoords(room.id, room.name)}
              disabled={!location}
            >
              <Text style={s.updateBtnText}>Update</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f14', padding: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#f0ede6', marginBottom: 4 },
  sub: { fontSize: 12, color: '#8fa898', marginBottom: 16 },
  gpsBox: { backgroundColor: '#122619', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: 'rgba(42,157,92,0.3)' },
  coords: { fontSize: 16, fontWeight: '700', color: '#2a9d5c', fontVariant: ['tabular-nums'] },
  accuracy: { fontSize: 12, color: '#8fa898', marginTop: 4 },
  waiting: { fontSize: 13, color: '#506659' },
  btnStart: { backgroundColor: '#1a6b3c', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
  btnStartText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  roomRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 10 },
  roomName: { fontSize: 13, fontWeight: '600', color: '#f0ede6' },
  roomCoords: { fontSize: 10, color: '#506659', marginTop: 2, fontVariant: ['tabular-nums'] },
  roomBuilding: { fontSize: 10, color: '#8fa898', marginTop: 1 },
  updateBtn: { backgroundColor: '#1a3324', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  updateBtnText: { fontSize: 12, fontWeight: '700', color: '#c9a84c' },
});

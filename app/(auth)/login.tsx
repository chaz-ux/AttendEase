import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';

type Role = 'student' | 'lecturer' | 'admin';

export default function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const toEmail = (id: string, r: Role): string => {
    if (r === 'student') {
      return id.toLowerCase().replace(/\//g, '-').replace(/\s/g, '') + '@jkuat.ac.ke';
    }
    return id.toLowerCase().includes('@') ? id : id + '@jkuat.ac.ke';
  };

  const handleSignIn = () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    router.push({
      pathname: '/(auth)/biometric',
      params: {
        email: toEmail(identifier, role),
        password: password,
      },
    });
  };

  const handleBiometric = () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Enter credentials first', 'Please fill in your registration number and password before using biometric.');
      return;
    }
    router.push({
      pathname: '/(auth)/biometric',
      params: {
        email: toEmail(identifier, role),
        password: password,
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoBlock}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>A</Text>
          </View>
          <Text style={styles.appName}>AttendEase</Text>
          <Text style={styles.appSub}>GPS Attendance System</Text>
          <View style={styles.uniBadge}>
            <View style={styles.uniDot} />
            <Text style={styles.uniBadgeText}>JKUAT</Text>
          </View>
        </View>

        {/* Role tabs */}
        <View style={styles.tabBar}>
          {(['student', 'lecturer', 'admin'] as Role[]).map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.tab, role === r && styles.tabActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.tabText, role === r && styles.tabTextActive]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Identifier field */}
        <View style={styles.field}>
          <Text style={styles.label}>
            {role === 'student' ? 'Registration Number' : 'Staff Email / ID'}
          </Text>
          <View style={styles.fieldWrap}>
            <TextInput
              style={styles.input}
              placeholder={role === 'student' ? 'e.g. SCM211-0631/2022' : 'Staff email'}
              placeholderTextColor="#506659"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Password field */}
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.fieldWrap}>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#506659"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
        </View>

        {/* Sign in button */}
        <TouchableOpacity style={styles.btnPrimary} onPress={handleSignIn}>
          <Text style={styles.btnPrimaryText}>Sign In </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Biometric button */}
        <TouchableOpacity style={styles.btnBio} onPress={handleBiometric}>
          <Text style={styles.btnBioText}>👆  Biometric / Fingerprint</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          New student? Contact your department office
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const C = {
  surface: '#0d1f14', surface2: '#122619', surface3: '#1a3324',
  green: '#1a6b3c', greenLight: '#2a9d5c',
  gold: '#c9a84c', border: 'rgba(201,168,76,0.15)', borderHi: 'rgba(201,168,76,0.35)',
  text: '#f0ede6', textMuted: '#8fa898', textDim: '#506659',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  inner: { padding: 28, paddingTop: 60, gap: 14, paddingBottom: 40 },
  logoBlock: { alignItems: 'center', gap: 6, marginBottom: 8 },
  logoMark: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.borderHi },
  logoLetter: { fontSize: 28, fontWeight: '800', color: '#fff' },
  appName: { fontSize: 22, fontWeight: '800', color: C.text },
  appSub: { fontSize: 12, color: C.textMuted, fontWeight: '300' },
  uniBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1, borderColor: C.borderHi, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  uniDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold },
  uniBadgeText: { fontSize: 11, fontWeight: '600', color: C.gold, letterSpacing: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: C.surface3, borderRadius: 10, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center' },
  tabActive: { backgroundColor: C.surface2 },
  tabText: { fontSize: 12, fontWeight: '600', color: C.textDim },
  tabTextActive: { color: C.text },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '600', color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  fieldWrap: { backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14 },
  input: { fontSize: 14, color: C.text, paddingVertical: 13 },
  btnPrimary: { backgroundColor: C.green, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 11, color: C.textDim, fontWeight: '500' },
  btnBio: { backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnBioText: { fontSize: 14, color: C.textMuted, fontWeight: '500' },
  helpText: { fontSize: 12, color: C.textDim, textAlign: 'center', fontWeight: '300' },
});
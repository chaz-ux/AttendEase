import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  // _layout.tsx handles all routing decisions
  // This screen just shows a spinner while that runs
  return (
    <View style={{ flex: 1, backgroundColor: '#0d1f14', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2a9d5c" size="large" />
    </View>
  );
}
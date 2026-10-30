import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme/tokens';

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.blue,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }, tabBarStyle: { height: 62, paddingBottom: 7, paddingTop: 5 } }}>
    <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{color}}>⌂</Text> }} />
    <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: ({ color }) => <Text style={{color}}>▥</Text> }} />
    <Tabs.Screen name="assistant" options={{ title: 'AI Assistant', tabBarIcon: ({ color }) => <Text style={{color}}>✦</Text> }} />
    <Tabs.Screen name="tools" options={{ title: 'Tools', tabBarIcon: ({ color }) => <Text style={{color}}>▦</Text> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{color}}>○</Text> }} />
  </Tabs>;
}

import React, { useState } from 'react';
import { StatusBar, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DashboardScreen from './src/screens/DashboardScreen';
import LoginScreen from './src/screens/LoginScreen';

type ScreenState = 'Login' | 'Dashboard';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('Login');
  const handleLogin = () => setScreen('Dashboard');
  const handleLogout = () => setScreen('Login');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <Text style={styles.title}>Al Arsh App</Text>
        <Text style={styles.subtitle}>{screen === 'Login' ? 'Login to continue' : 'Dashboard'}</Text>
      </View>
      {screen === 'Login' ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <DashboardScreen onLogout={handleLogout} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 20,
    backgroundColor: '#2563eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    marginTop: 6,
    color: '#dbeafe',
  },
});
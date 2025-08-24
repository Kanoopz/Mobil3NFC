import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import NFCScreen from './NFCScreen';
import AuthScreen from './AuthScreen';
import AuthService from './AuthService';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'auth' | 'base' | 'nfc'>('auth');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const authService = AuthService.getInstance();

  // Check authentication status on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    const authenticated = authService.isAuthenticated();
    const email = authService.getEmail();
    
    setIsAuthenticated(authenticated);
    setUserEmail(email);
    
    if (authenticated) {
      setCurrentScreen('base');
    } else {
      setCurrentScreen('auth');
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setUserEmail(authService.getEmail());
    setCurrentScreen('base');
  };

  const handleNFCClick = () => {
    setCurrentScreen('nfc');
  };

  const handleBack = () => {
    setCurrentScreen('base');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            authService.logout();
            setIsAuthenticated(false);
            setUserEmail(null);
            setCurrentScreen('auth');
          },
        },
      ]
    );
  };

  // Show authentication screen if not authenticated
  if (currentScreen === 'auth') {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // Show NFC screen if navigating to NFC
  if (currentScreen === 'nfc') {
    return <NFCScreen onBack={handleBack} />;
  }

  // Show main app screen (after authentication)
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome, {userEmail ? userEmail.split('@')[0] : 'User'}!
        </Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Mobil3 NFC App</Text>
        <Text style={styles.subtitle}>Welcome to the NFC Reader & Emulator</Text>
        
        <TouchableOpacity 
          style={styles.nfcButton}
          onPress={handleNFCClick}
        >
          <Text style={styles.nfcButtonText}>NFC</Text>
        </TouchableOpacity>
        
        <Text style={styles.description}>
          Tap the NFC button to access the full NFC functionality including reading and emulating NFC tags.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  welcomeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  nfcButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 60,
    paddingVertical: 20,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 30,
  },
  nfcButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
});

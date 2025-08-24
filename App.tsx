import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import NFCScreen from './NFCScreen';
import AuthScreen from './AuthScreen';
import AuthService from './AuthService';
import BalanceService from './services/BalanceService';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'auth' | 'base' | 'nfc'>('auth');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [monBalance, setMonBalance] = useState<string>('Loading...');
  const [tokenBalances, setTokenBalances] = useState<{[key: string]: string}>({});
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const authService = AuthService.getInstance();
  const balanceService = BalanceService.getInstance();

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
      // Log user address and check balance
      logUserAddressAndCheckBalance();
    } else {
      setCurrentScreen('auth');
    }
  };

  const logUserAddressAndCheckBalance = async () => {
    const ethereumAddress = authService.getEthereumAddress();
    if (ethereumAddress && ethereumAddress !== 'Invalid Address') {
      console.log('👤 User Address:', ethereumAddress);
      console.log('🔗 Short Address:', authService.getShortEthereumAddress());
      
      // Check MON balance
      await checkMonBalance(ethereumAddress);
      
      // Check all token balances
      await checkAllTokenBalances(ethereumAddress);
    } else {
      console.log('❌ No valid Ethereum address found for user');
      setMonBalance('No address available');
    }
  };

  const checkMonBalance = async (address: string) => {
    try {
      setIsLoadingBalance(true);
      setMonBalance('Checking...');
      
      const balance = await balanceService.getFormattedBalance(address);
      setMonBalance(balance);
      
      console.log(`💰 MON Balance for ${authService.getShortEthereumAddress()}: ${balance}`);
    } catch (error) {
      console.error('❌ Error checking MON balance:', error);
      setMonBalance('Error fetching balance');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const checkAllTokenBalances = async (address: string) => {
    try {
      console.log('🪙 Checking all token balances...');
      
      const allBalances = await balanceService.getAllTokenBalances(address);
      const balanceMap: {[key: string]: string} = {};
      
      allBalances.forEach(balanceInfo => {
        balanceMap[balanceInfo.symbol] = balanceInfo.balanceFormatted;
      });
      
      setTokenBalances(balanceMap);
      console.log('✅ All token balances updated:', balanceMap);
    } catch (error) {
      console.error('❌ Error checking token balances:', error);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setUserEmail(authService.getEmail());
    setCurrentScreen('base');
    // Log user address and check balance after successful auth
    logUserAddressAndCheckBalance();
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
        <View style={styles.headerLeft}>
          <Text style={styles.welcomeText}>
            Welcome, {userEmail ? userEmail.split('@')[0] : 'User'}!
          </Text>
          {authService.getEthereumAddress() && (
            <Text style={styles.addressText}>
              {authService.getShortEthereumAddress()}
            </Text>
          )}
          <Text style={styles.balanceText}>
            💰 {monBalance}
          </Text>
          {Object.keys(tokenBalances).length > 0 && (
            <View style={styles.tokenBalancesContainer}>
              {Object.entries(tokenBalances).map(([symbol, balance]) => (
                <Text key={symbol} style={styles.tokenBalanceText}>
                  🪙 {symbol}: {parseFloat(balance) > 0 ? balance : '0'}
                </Text>
              ))}
            </View>
          )}
        </View>
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

        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => {
            const address = authService.getEthereumAddress();
            if (address && address !== 'Invalid Address') {
              checkMonBalance(address);
              checkAllTokenBalances(address);
            }
          }}
          disabled={isLoadingBalance}
        >
          <Text style={styles.refreshButtonText}>
            {isLoadingBalance ? '🔄 Refreshing...' : '🔄 Refresh All Balances'}
          </Text>
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
  headerLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  balanceText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 3,
    fontWeight: '600',
  },
  tokenBalancesContainer: {
    marginTop: 5,
  },
  tokenBalanceText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
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
  refreshButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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

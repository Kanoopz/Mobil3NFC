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
      setCurrentScreen('nfc'); // Go directly to NFC screen
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
    setCurrentScreen('nfc'); // Go directly to NFC screen
    // Log user address and check balance after successful auth
    logUserAddressAndCheckBalance();
  };

  // Removed handleNFCClick and handleBack since we go directly to NFC screen

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
    return <NFCScreen onBack={handleLogout} />;
  }

  // This should never be reached since we go directly to NFC screen
  return null;
}

const styles = StyleSheet.create({
  // Styles removed since we no longer have a base screen
});

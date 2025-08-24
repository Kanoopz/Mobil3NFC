import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, Platform, ToastAndroid, ScrollView, Animated } from 'react-native';
import {
  HCESession,
  NFCTagType4NDEFContentType,
  NFCTagType4,
} from 'react-native-hce';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { ethers } from 'ethers';
import AuthService from './AuthService';
import BalanceService from './services/BalanceService';
import PaymentService from './services/PaymentService';
import SwapService from './services/SwapService';
import { MONAD_TESTNET_TOKENS, Token } from './constants/blockchain';

interface NFCScreenProps {
  onBack: () => void;
}

export default function NFCScreen({ onBack }: NFCScreenProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState<Token>(MONAD_TESTNET_TOKENS.find(t => t.symbol === 'MON') || MONAD_TESTNET_TOKENS[0]);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<{[key: string]: string}>({});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [monBalance, setMonBalance] = useState<string>('Loading...');
  const [desiredReceiveToken, setDesiredReceiveToken] = useState<Token>(MONAD_TESTNET_TOKENS.find(t => t.symbol === 'USDC') || MONAD_TESTNET_TOKENS[2]);
  const [showReceiveTokenSelector, setShowReceiveTokenSelector] = useState(false);
  const [swapQuote, setSwapQuote] = useState<any>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [tokenUpdateTimestamp, setTokenUpdateTimestamp] = useState<number>(0);
  const [hceSupported, setHceSupported] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [isHceActive, setIsHceActive] = useState(false);
  const [isNfcReading, setIsNfcReading] = useState(false);
  const [hceOperation, setHceOperation] = useState<'none' | 'receiving'>('none');
  const [nfcOperation, setNfcOperation] = useState<'none' | 'paying'>('none');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<Array<{text: string, onPress: () => void}>>([]);
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [session, setSession] = useState<HCESession | null>(null);
  
  // Visual feedback states
  const [isPaying, setIsPaying] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [isTransferComplete, setIsTransferComplete] = useState(false);
  const [transferType, setTransferType] = useState<'paying' | 'receiving' | null>(null);
  const [payAnimation] = useState(new Animated.Value(0));
  const [receiveAnimation] = useState(new Animated.Value(0));
  const [completeAnimation] = useState(new Animated.Value(0));

  const authService = AuthService.getInstance();
  const balanceService = BalanceService.getInstance();
  const paymentService = PaymentService.getInstance();
  const swapService = SwapService.getInstance();

  // Log user address and check balance when NFC screen loads
  useEffect(() => {
    const ethereumAddress = authService.getEthereumAddress();
    if (ethereumAddress && ethereumAddress !== 'Invalid Address') {
      console.log('👤 NFC Screen - User Address:', ethereumAddress);
      console.log('🔗 NFC Screen - Short Address:', authService.getShortEthereumAddress());
      
      // Show decimal examples for reference
      balanceService.showDecimalExamples();
      
      // Check native MON balance with direct ethers function
      balanceService.checkNativeMonBalance(ethereumAddress)
        .then(result => {
          if (result.success && result.balance) {
            console.log(`💰 NFC Screen - MON Balance: ${result.balance}`);
            setTokenBalances(prev => ({ ...prev, MON: result.balance || '0' }));
            setMonBalance(result.balance);
          } else {
            console.log('⚠️ NFC Screen - MON balance not available, using 0');
            console.log('❌ Error:', result.error);
            setTokenBalances(prev => ({ ...prev, MON: '0.000000' }));
            setMonBalance('0.000000');
          }
        })
        .catch(error => {
          console.error('❌ NFC Screen - Error checking MON balance:', error);
          setTokenBalances(prev => ({ ...prev, MON: '0.000000' }));
          setMonBalance('0.000000');
        });

      // Check all token balances with direct ethers functions
      const tokenPromises = MONAD_TESTNET_TOKENS
        .filter(token => token.symbol !== 'MON') // MON is handled separately
        .map(token => 
          balanceService.checkERC20TokenBalance(ethereumAddress, token.symbol)
            .then(result => ({
              symbol: token.symbol,
              success: result.success,
              balance: result.balance || '0',
              error: result.error
            }))
        );

      Promise.all(tokenPromises)
        .then(results => {
          console.log('🪙 NFC Screen - Token Balances:');
          const balanceMap: {[key: string]: string} = {};
          results.forEach(result => {
            if (result.success) {
              console.log(`  ✅ ${result.symbol}: ${result.balance}`);
              balanceMap[result.symbol] = result.balance;
            } else {
              console.log(`  ❌ ${result.symbol}: Error - ${result.error}`);
              balanceMap[result.symbol] = '0.000000';
            }
          });
          setTokenBalances(prev => ({ ...prev, ...balanceMap }));
        })
        .catch(error => {
          console.error('❌ NFC Screen - Error checking token balances:', error);
          // Set fallback values for all token balances
          const fallbackBalances: {[key: string]: string} = {};
          MONAD_TESTNET_TOKENS.forEach(token => {
            if (token.symbol !== 'MON') { // MON is handled separately
              fallbackBalances[token.symbol] = '0.000000';
            }
          });
          setTokenBalances(prev => ({ ...prev, ...fallbackBalances }));
        });
    } else {
      console.log('❌ NFC Screen - No valid Ethereum address found');
    }
  }, []);

  // Monitor transaction changes
  useEffect(() => {
    if (transactionHash) {
      console.log('🔄 TRANSACTION HASH CHANGED:', transactionHash);
    }
  }, [transactionHash]);

  // Update quote when payment amount or tokens change
  useEffect(() => {
    console.log('🔄 Quote useEffect triggered:', {
      paymentAmount,
      recipientAddress: recipientAddress ? 'present' : 'missing',
      selectedToken: selectedToken.symbol,
      desiredReceiveToken: desiredReceiveToken.symbol
    });
    
    if (paymentAmount && recipientAddress && parseFloat(paymentAmount) > 0) {
      console.log('✅ Conditions met, calling getSwapQuote');
      // Add a small delay to ensure state is updated
      setTimeout(() => {
        getSwapQuote();
      }, 100);
    } else {
      console.log('❌ Conditions not met, clearing swap quote');
      setSwapQuote(null);
    }
  }, [paymentAmount, selectedToken, desiredReceiveToken, recipientAddress]);

  // Initialize NFC and HCE
  useEffect(() => {
    const initNFC = async () => {
      try {
        const isSupported = await NfcManager.isSupported();
        setNfcSupported(isSupported);
        
        if (isSupported) {
          await NfcManager.start();
          console.log('✅ NFC initialized successfully');
        }
      } catch (error) {
        console.error('❌ NFC initialization failed:', error);
        setNfcSupported(false);
      }
    };

    const initHCE = async () => {
      try {
        if (Platform.OS === 'android') {
          const hceSession = await HCESession.getInstance();
          setSession(hceSession);
          setHceSupported(true);
          console.log('✅ HCE initialized successfully');
        } else {
          setHceSupported(false);
          console.log('❌ HCE not supported on this platform');
        }
      } catch (error) {
        console.error('❌ HCE initialization failed:', error);
        setHceSupported(false);
      }
    };

    initNFC();
    initHCE();

    return () => {
      NfcManager.unregisterTagEvent();
      NfcManager.cancelTechnologyRequest();
    };
  }, []);

  // Helper function to show modals
  const showModal = (title: string, message: string, buttons: Array<{text: string, onPress: () => void}>) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

  // Visual feedback functions
  const showPayingFeedback = () => {
    setIsPaying(true);
    Animated.sequence([
      Animated.timing(payAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(payAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsPaying(false);
    });
  };

  const showReceivingFeedback = () => {
    setIsReceiving(true);
    Animated.sequence([
      Animated.timing(receiveAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(receiveAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsReceiving(false);
    });
  };

  const showTransferComplete = (type: 'paying' | 'receiving') => {
    setTransferType(type);
    setIsTransferComplete(true);
    Animated.timing(completeAnimation, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
    
    // Auto-hide after 1.5 seconds and stop operations
    setTimeout(async () => {
      hideTransferComplete();
      
      // Stop operations based on type
      if (type === 'paying') {
        stopNfcReading();
        
        // Refresh balances after payment
        const userAddress = authService.getEthereumAddress();
        if (userAddress && userAddress !== 'Invalid Address') {
          console.log('🔄 Auto-refreshing balances after payment...');
          try {
            await balanceService.getFormattedBalance(userAddress);
            await balanceService.getAllTokenBalances(userAddress);
            console.log('✅ Balances auto-refreshed after payment');
          } catch (error) {
            console.error('❌ Error auto-refreshing balances after payment:', error);
            // Silently handle balance refresh errors - don't show to user
          }
        }
      } else if (type === 'receiving') {
        stopHceOperation();
        
        // Refresh balances after address sharing
        const userAddress = authService.getEthereumAddress();
        if (userAddress && userAddress !== 'Invalid Address') {
          console.log('🔄 Auto-refreshing balances after address sharing...');
          try {
            await balanceService.getFormattedBalance(userAddress);
            await balanceService.getAllTokenBalances(userAddress);
            console.log('✅ Balances auto-refreshed after address sharing');
          } catch (error) {
            console.error('❌ Error auto-refreshing balances after address sharing:', error);
            // Silently handle balance refresh errors - don't show to user
          }
        }
      }
    }, 1500);
  };

  const hideTransferComplete = () => {
    Animated.timing(completeAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsTransferComplete(false);
      setTransferType(null);
    });
  };

  // Function to stop HCE operation
  const stopHceOperation = async () => {
    try {
      if (session) {
        await session.setEnabled(false);
        setIsHceActive(false);
        setHceOperation('none');
        showModal('Receive Stopped', 'Receive mode has been stopped.', [
          { text: 'OK', onPress: () => setModalVisible(false) }
        ]);
      }
    } catch (error) {
      console.log('Error stopping HCE:', error);
    }
  };

  // Function to stop NFC reading
  const stopNfcReading = async () => {
    try {
      await NfcManager.cancelTechnologyRequest();
      setIsNfcReading(false);
      setNfcOperation('none');
      showModal('Payment Stopped', 'Payment mode has been stopped.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
    } catch (error) {
      console.log('Error stopping NFC reading:', error);
    }
  };

  // Function to receive payment (share address via NFC)
  const handleReceive = async () => {
    console.log('=== RECEIVE FUNCTION STARTED ===');
    console.log('HCE supported:', hceSupported);
    console.log('HCE active:', isHceActive);
    console.log('Session available:', !!session);
    
    if (isHceActive) {
      showModal('Receive Busy', 'Receive mode is already active. Please stop the current operation first.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (!hceSupported) {
      showModal('HCE Not Available', 'Host Card Emulation is not supported on this device', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (!session) {
      showModal('HCE Session Error', 'HCE session not available. Please restart the app.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    const userAddress = authService.getEthereumAddress();
    if (!userAddress || userAddress === 'Invalid Address') {
      showModal('No Address', 'No valid Ethereum address found. Please login first.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    try {
      setIsHceActive(true);
      setHceOperation('receiving');
      
      showModal('Receive Mode Started', 
        'Starting receive mode...\n\n' +
        'Your address will be shared: ' + userAddress + '\n\n' +
        'Other devices can tap to get your address for payment.',
        [
          {
            text: 'Cancel',
            onPress: () => {
              console.log('❌ User cancelled receive mode');
              stopHceOperation();
            }
          }
        ]
      );

      // Start HCE emulation with user address
      setTimeout(async () => {
        try {
          console.log('🔄 Starting HCE receive mode...');
          console.log('📤 Sharing address:', userAddress);
          
          // Create NFC Type 4 tag with the user address and desired receive token
          const addressData = {
            address: userAddress,
            desiredToken: desiredReceiveToken.symbol,
            desiredTokenAddress: desiredReceiveToken.address,
            timestamp: Date.now()
          };
          
          console.log('📤 Sharing address data:', addressData);
          
          const tag = new NFCTagType4({
            type: NFCTagType4NDEFContentType.Text,
            content: JSON.stringify(addressData),
            writable: false,
          });
          
          console.log('✅ NFC Type 4 tag created with address');
          
          // Set the tag as the application for the HCE session
          if (session) {
            session.setApplication(tag);
            console.log('✅ Tag set as HCE application');
            
            // Enable HCE emulation
            await session.setEnabled(true);
          } else {
            throw new Error('HCE session not available');
          }
          console.log('✅ HCE receive mode enabled');
          
          setModalVisible(false);
          
          // Show ready popup
          showModal('Receive Mode Ready', 
            '✅ Receive mode is now active!\n\n' +
            'Address: ' + userAddress + '\n\n' +
            'Your phone is now sharing your address.\n' +
            'Other devices can tap to get your address.\n\n' +
            'Keep this screen open to maintain sharing.',
            [
              {
                text: 'Stop Receiving',
                onPress: () => {
                  console.log('❌ User stopped receive mode');
                  stopHceOperation();
                }
              }
            ]
          );
          
          // Set up event listener for when the tag is read
          const removeListener = session.on(HCESession.Events.HCE_STATE_READ, () => {
            console.log('📳 ADDRESS SHARED SUCCESSFULLY!');
            console.log('⏰ Timestamp:', new Date().toISOString());
            
            // Show receiving feedback
            showReceivingFeedback();
            
            // Show completion illumination
            showTransferComplete('receiving');
            
            // Show success message
            showModal('🎉 ADDRESS SHARED!', 
              'Your address has been shared successfully!\n\n' +
              'Address: ' + userAddress + '\n\n' +
              'The other device can now send you MON tokens.',
              [
                { 
                  text: 'OK', 
                  onPress: async () => {
                    setModalVisible(false);
                    // Stop receive mode after successful address sharing
                    stopHceOperation();
                    
                    // Refresh balances after address sharing (in case payment was received)
                    console.log('🔄 Refreshing balances after address sharing...');
                    try {
                      await balanceService.getFormattedBalance(userAddress);
                      await balanceService.getAllTokenBalances(userAddress);
                      console.log('✅ Balances refreshed after address sharing');
                    } catch (error) {
                      console.error('❌ Error refreshing balances after address sharing:', error);
                      // Silently handle balance refresh errors - don't show to user
                    }
                  }
                }
              ]
            );
            
            // Clean up listener
            removeListener();
          });
          
        } catch (error) {
          console.error('❌ Error starting receive mode:', error);
          setIsHceActive(false);
          setHceOperation('none');
          
          showModal('❌ Receive Mode Failed', 
            'Failed to start receive mode.\n\n' +
            'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
            [
              { text: 'OK', onPress: () => setModalVisible(false) }
            ]
          );
        }
      }, 1000);
    } catch (error) {
      console.error('❌ Error starting receive mode:', error);
      setIsHceActive(false);
      setHceOperation('none');
      
      showModal('❌ Receive Error', 
        'Failed to start receive mode.\n\n' +
        'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        [
          { text: 'OK', onPress: () => setModalVisible(false) }
        ]
      );
    }
  };

  // Function to pay (read address and send MON)
  const handlePay = async () => {
    console.log('=== PAYMENT FUNCTION STARTED ===');
    console.log('Payment amount:', paymentAmount);
    console.log('NFC supported:', nfcSupported);
    console.log('NFC reading:', isNfcReading);
    
    if (!paymentAmount.trim() || parseFloat(paymentAmount) <= 0) {
      console.log('❌ Invalid payment amount');
      showModal('Invalid Amount', 'Please enter a valid payment amount greater than 0!', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    const userPrivateKey = authService.getPrivateKey();
    if (!userPrivateKey) {
      console.log('❌ No private key available');
      showModal('No Private Key', 'No private key found. Please login first.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (isNfcReading) {
      console.log('❌ NFC already reading');
      showModal('NFC Busy', 'NFC is already reading. Please stop the current operation first.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (!nfcSupported) {
      showModal('NFC Not Available', 'NFC is not supported on this device', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    try {
      setIsNfcReading(true);
      setNfcOperation('paying');
      
      showModal('Payment Mode Started', 
        'Starting payment mode...\n\n' +
        'Token: ' + selectedToken.symbol + '\n' +
        'Amount to send: ' + paymentAmount + ' ' + selectedToken.symbol + '\n\n' +
        'Tap your phone near a receiving device to get their address.',
        [
          {
            text: 'Cancel',
            onPress: () => {
              console.log('❌ User cancelled payment');
              stopNfcReading();
            }
          }
        ]
      );

      // Start reading immediately
      setTimeout(async () => {
        try {
          console.log('🔄 Starting NFC reading for payment...');
          
          // Request NFC technology
          await NfcManager.requestTechnology(NfcTech.Ndef);
          console.log('✅ NFC technology requested');
          
          // Read the tag
          const tag = await NfcManager.getTag();
          console.log('✅ NFC tag detected:', tag);
          
          const ndef = await NfcManager.getNdefMessage();
          console.log('✅ NDEF message retrieved:', ndef);
          
          if (ndef && ndef.ndefMessage && Array.isArray(ndef.ndefMessage)) {
            const records = ndef.ndefMessage;
            let recipientAddress = '';
            
            console.log('📋 Processing', records.length, 'NDEF records');
            
            for (const record of records) {
              console.log('📄 Record type:', record.type, 'TNF:', record.tnf);
              
              if (record.tnf === 1 && record.type[0] === 84) { // TNF_WELL_KNOWN = 1, 'T' for text
                // Text record - should contain address data
                const textDecoder = new TextDecoder();
                const payload = new Uint8Array(record.payload);
                const text = textDecoder.decode(payload.slice(3)); // Skip language code
                
                try {
                  // Try to parse as JSON first (new format with desired token)
                  const addressData = JSON.parse(text.trim());
                  console.log('📝 Parsed address data:', addressData);
                  
                  if (addressData.address && addressData.address.startsWith('0x')) {
                    recipientAddress = addressData.address;
                    console.log('📝 Recipient address set:', recipientAddress);
                    console.log('📝 Desired token from NFC:', addressData.desiredToken);
                    
                    // Update desired receive token if specified
                    if (addressData.desiredToken) {
                      const token = MONAD_TESTNET_TOKENS.find(t => t.symbol === addressData.desiredToken);
                      if (token) {
                        console.log('📝 Found token for symbol:', addressData.desiredToken, '->', token.symbol);
                        
                        // Update state immediately
                        setDesiredReceiveToken(token);
                        setTokenUpdateTimestamp(Date.now());
                        
                        // Store the token locally for immediate use
                        const updatedDesiredToken = token;
                        
                        console.log('📝 Desired receive token updated to:', updatedDesiredToken.symbol);
                        
                        // Force a re-render and quote generation with the new token
                        setTimeout(() => {
                          console.log('🔄 Forcing quote regeneration with new token:', updatedDesiredToken.symbol);
                          if (paymentAmount && parseFloat(paymentAmount) > 0) {
                            // Use the updated token directly instead of relying on state
                            getSwapQuoteWithToken(updatedDesiredToken);
                          }
                        }, 200);
                      } else {
                        console.error('❌ Token not found for symbol:', addressData.desiredToken);
                      }
                    } else {
                      console.log('⚠️ No desired token specified in NFC data');
                    }
                    break;
                  } else {
                    console.error('❌ Invalid address in NFC data:', addressData.address);
                  }
                } catch (e) {
                  console.log('📝 Failed to parse JSON, trying old format');
                  // Fallback to old format (just address)
                  recipientAddress = text.trim();
                  if (recipientAddress && recipientAddress.startsWith('0x')) {
                    console.log('📝 Address record found (old format):', recipientAddress);
                    break;
                  } else {
                    console.error('❌ Invalid address format:', recipientAddress);
                  }
                }
              }
            }
            
            if (recipientAddress && recipientAddress.startsWith('0x')) {
              console.log('✅ Valid recipient address found:', recipientAddress);
              setRecipientAddress(recipientAddress);
              
              // Clean up NFC
              await NfcManager.cancelTechnologyRequest();
              setIsNfcReading(false);
              setNfcOperation('none');
              
              // Show payment confirmation
              const isSwapNeeded = selectedToken.symbol !== desiredReceiveToken.symbol;
              const hasSwapQuote = swapQuote && isSwapNeeded;
              
              let confirmationMessage = '';
              let buttonText = '';
              let onPressAction = null;
              
                    if (isSwapNeeded && !hasSwapQuote) {
        // Swap needed but no quote available - fallback to direct payment
        confirmationMessage = `Recipient address found!\n\n` +
           `Address: ${recipientAddress}\n` +
           `📤 You'll pay: ${paymentAmount} ${selectedToken.symbol}\n` +
           `📥 They'll receive: ${paymentAmount} ${selectedToken.symbol}\n\n` +
           `Do you want to proceed with the payment?`;
        buttonText = 'Send Payment';
        onPressAction = async () => {
          await executePayment(userPrivateKey, recipientAddress, paymentAmount, selectedToken);
        };
              } else if (isSwapNeeded && hasSwapQuote) {
                // Swap needed and quote available
                const buyAmountFormatted = swapService.formatAmount(swapQuote.buyAmount, desiredReceiveToken.decimals);
                confirmationMessage = `Recipient address found!\n\n` +
                  `Address: ${recipientAddress}\n` +
                  `📤 You'll pay: ${paymentAmount} ${selectedToken.symbol}\n` +
                  `📥 They'll receive: ${buyAmountFormatted} ${desiredReceiveToken.symbol}\n` +
                  `🔄 Swap will be executed automatically\n\n` +
                  `Do you want to proceed with the swap payment?`;
                buttonText = 'Send Swap Payment';
                onPressAction = async () => {
                  await executeSwapPayment(userPrivateKey, recipientAddress, paymentAmount, selectedToken, desiredReceiveToken);
                };
              } else {
                // Same token, direct payment
                confirmationMessage = `Recipient address found!\n\n` +
                  `Address: ${recipientAddress}\n` +
                  `Token: ${selectedToken.symbol}\n` +
                  `Amount: ${paymentAmount} ${selectedToken.symbol}\n\n` +
                  `Do you want to proceed with the payment?`;
                buttonText = 'Send Payment';
                onPressAction = async () => {
                  await executePayment(userPrivateKey, recipientAddress, paymentAmount, selectedToken);
                };
              }

              showModal('Payment Confirmation', 
                confirmationMessage,
                [
                  {
                    text: 'Cancel',
                    onPress: () => {
                      console.log('❌ User cancelled payment');
                      setModalVisible(false);
                    }
                  },
                  {
                    text: buttonText,
                    onPress: onPressAction
                  }
                ]
              );
            } else {
              throw new Error('No valid Ethereum address found in NFC tag');
            }
          } else {
            throw new Error('Invalid NDEF message format');
          }
        } catch (error) {
          console.error('❌ Error reading NFC for payment:', error);
          
          await NfcManager.cancelTechnologyRequest();
          setIsNfcReading(false);
          setNfcOperation('none');
          
          showModal('❌ Payment Failed', 
            'Failed to read recipient address.\n\n' +
            'Error: ' + (error instanceof Error ? error.message : 'Unknown error') + '\n\n' +
            'Please make sure the receiving device is in receive mode.',
            [
              { text: 'OK', onPress: () => setModalVisible(false) }
            ]
          );
        }
      }, 1000);
    } catch (error) {
      console.error('❌ Error starting payment mode:', error);
      setIsNfcReading(false);
      setNfcOperation('none');
      
      showModal('❌ Payment Error', 
        'Failed to start payment mode.\n\n' +
        'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        [
          { text: 'OK', onPress: () => setModalVisible(false) }
        ]
      );
    }
  };

  // Execute the actual payment
  const executePayment = async (privateKey: string, recipientAddress: string, amount: string, token: Token) => {
    try {
      setModalVisible(false);
      setIsTransactionPending(true);
      
      showModal('Processing Payment', 
        'Sending ' + amount + ' ' + token.symbol + '...\n\n' +
        'Please wait while the transaction is being processed.',
        []
      );
      
      console.log('💸 Executing payment...');
      console.log('📤 From: Private key available');
      console.log('📥 To: ' + recipientAddress);
      console.log('🪙 Token: ' + token.symbol);
      console.log('💰 Amount: ' + amount + ' ' + token.symbol);
      
      // Show paying feedback
      showPayingFeedback();
      
      // Send payment using the unified token method
      const result = await paymentService.sendTokens(privateKey, recipientAddress, amount, token);
      
      if (result.success && result.transactionHash) {
        setTransactionHash(result.transactionHash);
        
        console.log('✅ Payment successful!');
        console.log('🔗 Transaction hash:', result.transactionHash);
        
        // Show completion illumination
        showTransferComplete('paying');
        
        // Show success message
        showModal('🎉 PAYMENT SUCCESSFUL!', 
          'Payment sent successfully!\n\n' +
          'Token: ' + token.symbol + '\n' +
          'Amount: ' + amount + ' ' + token.symbol + '\n' +
          'To: ' + recipientAddress.slice(0, 6) + '...' + recipientAddress.slice(-4) + '\n' +
          'Transaction: ' + result.transactionHash.slice(0, 10) + '...\n\n' +
          'The transaction has been confirmed on the blockchain.',
          [
            { 
              text: 'OK', 
              onPress: async () => {
                setModalVisible(false);
                // Stop payment mode after successful transaction
                stopNfcReading();
                
                // Refresh balances after successful payment
                const userAddress = authService.getEthereumAddress();
                if (userAddress && userAddress !== 'Invalid Address') {
                  console.log('🔄 Refreshing balances after payment...');
                  try {
                    await balanceService.getFormattedBalance(userAddress);
                    await balanceService.getAllTokenBalances(userAddress);
                    console.log('✅ Balances refreshed after payment');
                  } catch (error) {
                    console.error('❌ Error refreshing balances after payment:', error);
                    // Silently handle balance refresh errors - don't show to user
                  }
                }
              }
            }
          ]
        );
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      console.error('❌ Payment execution failed:', error);
      
      showModal('❌ PAYMENT FAILED', 
        'Payment failed!\n\n' +
        'Error: ' + (error instanceof Error ? error.message : 'Unknown error') + '\n\n' +
        'Please check your balance and try again.',
        [
          { text: 'OK', onPress: () => setModalVisible(false) }
        ]
      );
    } finally {
      setIsTransactionPending(false);
    }
  };

  // Get swap quote when payment amount or tokens change
  const getSwapQuote = async () => {
    return getSwapQuoteWithToken(desiredReceiveToken);
  };

  // Get swap quote with specific token (for immediate use after NFC)
  const getSwapQuoteWithToken = async (receiveToken: Token) => {
    console.log('🔄 getSwapQuoteWithToken called with:', {
      paymentAmount,
      recipientAddress,
      selectedToken: selectedToken.symbol,
      receiveToken: receiveToken.symbol,
      tokenUpdateTimestamp
    });

    if (!paymentAmount || parseFloat(paymentAmount) <= 0 || !recipientAddress) {
      console.log('❌ Invalid parameters for swap quote');
      setSwapQuote(null);
      return;
    }

    // If payer and receiver want the same token, no swap needed
    if (selectedToken.symbol === receiveToken.symbol) {
      console.log('✅ Same token, no swap needed');
      setSwapQuote(null);
      return;
    }

    console.log('🔄 Generating quote for:', {
      sellToken: selectedToken.symbol,
      buyToken: receiveToken.symbol,
      sellAmount: paymentAmount,
      sellTokenAddress: selectedToken.address,
      buyTokenAddress: receiveToken.address
    });

    setIsGettingQuote(true);
    try {
      const sellAmountWei = swapService.toWei(paymentAmount, selectedToken.decimals);
      console.log('💰 Converted amount to wei:', sellAmountWei);
      
      const result = await swapService.getQuote(
        selectedToken,
        receiveToken,
        sellAmountWei,
        recipientAddress
      );

      if (result.success && result.quote) {
        setSwapQuote(result.quote);
        console.log('✅ Swap quote received:', result.quote);
      } else {
        setSwapQuote(null);
        console.error('❌ Failed to get swap quote:', result.error);
      }
    } catch (error) {
      console.error('❌ Error getting swap quote:', error);
      setSwapQuote(null);
    } finally {
      setIsGettingQuote(false);
    }
  };

  // Execute swap payment
  const executeSwapPayment = async (privateKey: string, recipientAddress: string, amount: string, sellToken: Token, buyToken: Token) => {
    try {
      setModalVisible(false);
      setIsTransactionPending(true);
      
      showModal('Processing Swap Payment', 
        `Swapping ${amount} ${sellToken.symbol} to ${buyToken.symbol}...\n\n` +
        'Please wait while the swap transaction is being processed.',
        []
      );
      
      console.log('🔄 Executing swap payment...');
      console.log(`📤 Selling: ${amount} ${sellToken.symbol}`);
      console.log(`📥 Buying: ${buyToken.symbol}`);
      console.log(`👤 Recipient: ${recipientAddress}`);
      
      // Show paying feedback
      showPayingFeedback();
      
      if (!swapQuote) {
        console.log('⚠️ No swap quote available, falling back to direct payment');
        // Fallback to direct payment
        await executePayment(privateKey, recipientAddress, amount, sellToken);
        return;
      }

      // Execute the swap
      const result = await swapService.executeSwap(privateKey, swapQuote, recipientAddress);
      
      if (result.success && result.transactionHash) {
        setTransactionHash(result.transactionHash);
        
        console.log('✅ Swap payment successful!');
        console.log('🔗 Transaction hash:', result.transactionHash);
        
        // Show completion illumination
        showTransferComplete('paying');
        
        // Show success message
        const buyAmountFormatted = swapService.formatAmount(swapQuote.buyAmount, buyToken.decimals);
        showModal('🎉 Payment Sent!', 
          `Your payment has been sent successfully!\n\n` +
          `📤 You paid: ${amount} ${sellToken.symbol}\n` +
          `📥 They received: ${buyAmountFormatted} ${buyToken.symbol}\n\n` +
          `The recipient will receive ${buyToken.symbol} tokens.`,
          [
            { 
              text: 'OK', 
              onPress: async () => {
                setModalVisible(false);
                // Stop payment mode after successful transaction
                stopNfcReading();
                
                // Refresh balances after successful payment
                const userAddress = authService.getEthereumAddress();
                if (userAddress && userAddress !== 'Invalid Address') {
                  console.log('🔄 Refreshing balances after payment...');
                  try {
                    await balanceService.getFormattedBalance(userAddress);
                    await balanceService.getAllTokenBalances(userAddress);
                    console.log('✅ Balances refreshed after payment');
                  } catch (error) {
                    console.error('❌ Error refreshing balances after payment:', error);
                  }
                }
              }
            }
          ]
        );
      } else {
        console.log('⚠️ Swap failed, falling back to direct payment');
        // Fallback to direct payment
        await executePayment(privateKey, recipientAddress, amount, sellToken);
      }
    } catch (error) {
      console.error('❌ Swap payment execution failed:', error);
      console.log('⚠️ Falling back to direct payment');
      
      // Fallback to direct payment
      await executePayment(privateKey, recipientAddress, amount, sellToken);
    } finally {
      setIsTransactionPending(false);
    }
  };



  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      {/* User Menu Button */}
      <TouchableOpacity style={styles.userMenuButton} onPress={() => setShowUserMenu(true)}>
        <Text style={styles.userMenuButtonText}>👤</Text>
      </TouchableOpacity>

      {/* Ethereum Address Display */}
      {authService.getEthereumAddress() && (
        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>🔗 Your Wallet:</Text>
          <Text style={styles.addressText}>{authService.getShortEthereumAddress()}</Text>
        </View>
      )}

      {/* Visual feedback overlays */}
      {isPaying && (
        <Animated.View 
          style={[
            styles.visualFeedback,
            styles.sendingFeedback,
            {
              opacity: payAnimation,
            }
          ]}
        >
          <Text style={styles.feedbackText}>💸 SENDING PAYMENT...</Text>
        </Animated.View>
      )}
      
      {isReceiving && (
        <Animated.View 
          style={[
            styles.visualFeedback,
            styles.receivingFeedback,
            {
              opacity: receiveAnimation,
            }
          ]}
        >
          <Text style={styles.feedbackText}>📥 SHARING ADDRESS...</Text>
        </Animated.View>
      )}
      
      {isTransferComplete && (
        <TouchableOpacity 
          style={[
            styles.visualFeedback,
            styles.transferComplete,
            {
              opacity: completeAnimation,
            }
          ]}
          onPress={hideTransferComplete}
          activeOpacity={1}
        >
          <Text style={styles.feedbackText}>
            {transferType === 'paying' ? '💸 PAYMENT SENT!' : '📥 ADDRESS SHARED!'}
          </Text>
          <Text style={styles.tapToDismissText}>Tap anywhere to dismiss</Text>
        </TouchableOpacity>
      )}
      
      {/* Large Stop Buttons when operations are Active */}
      {(isHceActive || isNfcReading) && (
        <View style={styles.stopButtonContainer}>
          {isHceActive && (
            <TouchableOpacity style={styles.largeStopButton} onPress={stopHceOperation}>
              <Text style={styles.largeStopButtonText}>
                🛑 STOP RECEIVING
              </Text>
            </TouchableOpacity>
          )}
          {isNfcReading && (
            <TouchableOpacity style={[styles.largeStopButton, styles.nfcStopButton]} onPress={stopNfcReading}>
              <Text style={styles.largeStopButtonText}>
                🛑 STOP PAYMENT
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.helloWeb}>MON Payment & Receive 📱</Text>
        
        {/* Token Selector */}
        <View style={styles.tokenSelectorContainer}>
          <Text style={styles.tokenSelectorLabel}>🪙 Pay with Token:</Text>
          <TouchableOpacity 
            style={styles.tokenSelectorButton}
            onPress={() => setShowTokenSelector(true)}
          >
            <Text style={styles.tokenSelectorButtonText}>
              {selectedToken.symbol} - {selectedToken.name}
            </Text>
            <Text style={styles.tokenSelectorArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Desired Receive Token Selector */}
        <View style={styles.tokenSelectorContainer}>
          <Text style={styles.tokenSelectorLabel}>📥 Receive Token:</Text>
          <TouchableOpacity 
            style={styles.tokenSelectorButton}
            onPress={() => setShowReceiveTokenSelector(true)}
          >
            <Text style={styles.tokenSelectorButtonText}>
              {desiredReceiveToken.symbol} - {desiredReceiveToken.name}
            </Text>
            <Text style={styles.tokenSelectorArrow}>▼</Text>
          </TouchableOpacity>
        </View>
        
        <TextInput
          style={styles.input}
          placeholder={`Enter amount of ${selectedToken.symbol} to send...`}
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          keyboardType="numeric"
        />
        
        {paymentAmount ? (
          <Text style={styles.displayText}>Amount: {paymentAmount} {selectedToken.symbol}</Text>
        ) : null}
        
        {recipientAddress && (
          <View style={styles.sharedTextContainer}>
            <Text style={styles.sharedTextLabel}>📥 Recipient Address:</Text>
            <Text style={styles.sharedText}>{recipientAddress}</Text>
          </View>
        )}



        {/* Swap Quote Display */}
        {swapQuote && selectedToken.symbol !== desiredReceiveToken.symbol && (
          <View style={styles.swapQuoteContainer}>
            <Text style={styles.swapQuoteTitle}>🔄 Swap Quote:</Text>
            <View style={styles.swapQuoteDetails}>
              <Text style={styles.swapQuoteText}>
                📤 You pay: {paymentAmount} {selectedToken.symbol}
              </Text>
              <Text style={styles.swapQuoteText}>
                📥 They receive: {swapService.formatAmount(swapQuote.buyAmount, desiredReceiveToken.decimals)} {desiredReceiveToken.symbol}
              </Text>
              {isGettingQuote && (
                <Text style={styles.swapQuoteText}>⏳ Getting quote...</Text>
              )}
            </View>
          </View>
        )}
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.buttonContainer}
            onPress={handlePay}
          >
            <Text style={styles.button}>Pay {selectedToken.symbol}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.buttonContainer, styles.readButton]}
            onPress={handleReceive}
          >
            <Text style={styles.button}>Receive</Text>
          </TouchableOpacity>
        </View>


        
        {/* Transaction Status */}
        {isTransactionPending && (
          <View style={styles.transactionContainer}>
            <Text style={styles.transactionTitle}>⏳ Processing Payment...</Text>
            <Text style={styles.transactionText}>Please wait while the transaction is being confirmed on the blockchain.</Text>
          </View>
        )}
        
        {transactionHash && !isTransactionPending && (
          <View style={styles.transactionContainer}>
            <Text style={styles.transactionTitle}>✅ Payment Confirmed!</Text>
            <Text style={styles.transactionText}>Transaction Hash: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}</Text>
          </View>
        )}
        

      </ScrollView>
      
      {/* Custom Modal Popup */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <View style={styles.modalButtons}>
              {modalButtons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.modalButton}
                  onPress={button.onPress}
                >
                  <Text style={styles.modalButtonText}>{button.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Token Selector Dropdown Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTokenSelector}
        onRequestClose={() => setShowTokenSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.simpleTokenModal}>
            <Text style={styles.modalTitle}>🪙 Select Token</Text>
            <View style={styles.simpleTokenList}>
              {MONAD_TESTNET_TOKENS.map((token) => (
                <TouchableOpacity
                  key={token.symbol}
                  style={[
                    styles.simpleTokenItem,
                    selectedToken.symbol === token.symbol && styles.simpleTokenItemSelected
                  ]}
                  onPress={() => {
                    setSelectedToken(token);
                    setShowTokenSelector(false);
                  }}
                >
                  <View style={styles.tokenItemLeft}>
                    <Text style={styles.simpleTokenText}>
                      {token.symbol} - {token.name}
                    </Text>
                    <Text style={styles.tokenBalanceText}>
                      Balance: {tokenBalances[token.symbol] || 'Loading...'}
                    </Text>
                  </View>
                  {selectedToken.symbol === token.symbol && (
                    <Text style={styles.simpleTokenCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowTokenSelector(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Receive Token Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showReceiveTokenSelector}
        onRequestClose={() => setShowReceiveTokenSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.simpleTokenModal}>
            <Text style={styles.modalTitle}>📥 Select Receive Token</Text>
            <View style={styles.simpleTokenList}>
              {MONAD_TESTNET_TOKENS.map((token) => (
                <TouchableOpacity
                  key={token.symbol}
                  style={[
                    styles.simpleTokenItem,
                    desiredReceiveToken.symbol === token.symbol && styles.simpleTokenItemSelected
                  ]}
                  onPress={() => {
                    setDesiredReceiveToken(token);
                    setShowReceiveTokenSelector(false);
                  }}
                >
                  <View style={styles.tokenItemLeft}>
                    <Text style={styles.simpleTokenText}>
                      {token.symbol} - {token.name}
                    </Text>
                    <Text style={styles.tokenBalanceText}>
                      Balance: {tokenBalances[token.symbol] || 'Loading...'}
                    </Text>
                  </View>
                  {desiredReceiveToken.symbol === token.symbol && (
                    <Text style={styles.simpleTokenCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowReceiveTokenSelector(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* User Menu Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showUserMenu}
        onRequestClose={() => setShowUserMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.userMenuModal}>
            <Text style={styles.modalTitle}>👤 User Profile</Text>
            
            {/* User Info */}
            <View style={styles.userInfoSection}>
              <Text style={styles.userInfoLabel}>Email:</Text>
              <Text style={styles.userInfoValue}>{authService.getEmail()}</Text>
              
              <Text style={styles.userInfoLabel}>Address:</Text>
              <Text style={styles.userInfoValue}>{authService.getShortEthereumAddress()}</Text>
              
              <Text style={styles.userInfoLabel}>MON Balance:</Text>
              <Text style={styles.userInfoValue}>💰 {monBalance}</Text>
            </View>

            {/* Token Balances */}
            {Object.keys(tokenBalances).length > 0 && (
              <View style={styles.tokenBalancesSection}>
                <Text style={styles.tokenBalancesTitle}>🪙 Token Balances:</Text>
                <View style={styles.tokenBalancesGrid}>
                  {Object.entries(tokenBalances).map(([symbol, balance]) => {
                    const balanceNum = parseFloat(balance);
                    const displayBalance = isNaN(balanceNum) ? '0' : 
                      balanceNum > 0 ? balance : '0';
                    return (
                      <View key={symbol} style={styles.tokenBalanceItem}>
                        <Text style={styles.tokenBalanceSymbol}>{symbol}</Text>
                        <Text style={styles.tokenBalanceAmount}>{displayBalance}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.userMenuButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.refreshButton]}
                onPress={async () => {
                  const userAddress = authService.getEthereumAddress();
                  if (userAddress && userAddress !== 'Invalid Address') {
                    try {
                      const balance = await balanceService.getFormattedBalance(userAddress);
                      setMonBalance(balance);
                      setTokenBalances(prev => ({ ...prev, MON: balance }));
                      
                      const allBalances = await balanceService.getAllTokenBalances(userAddress);
                      const balanceMap: {[key: string]: string} = {};
                      allBalances.forEach(balanceInfo => {
                        balanceMap[balanceInfo.symbol] = balanceInfo.balanceFormatted;
                      });
                      setTokenBalances(prev => ({ ...prev, ...balanceMap }));
                    } catch (error) {
                      console.error('❌ Error refreshing balances:', error);
                    }
                  }
                }}
              >
                <Text style={styles.modalButtonText}>🔄 Refresh Balances</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.logoutButton]}
                onPress={() => {
                  setShowUserMenu(false);
                  authService.logout();
                  onBack(); // This will trigger the logout flow
                }}
              >
                <Text style={styles.modalButtonText}>🚪 Logout</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowUserMenu(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1001,
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 100, // Extra space for stop buttons
  },
  helloWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: 'white',
  },
  displayText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  sharedTextContainer: {
    backgroundColor: '#e8f5e8',
    borderColor: '#28a745',
    borderWidth: 2,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  sharedTextLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 5,
    textAlign: 'center',
  },
  sharedText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  buttonContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 10,
  },
  button: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  readButton: {
    backgroundColor: '#28a745',
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  transactionContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  transactionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  nfcStatusContainer: {
    marginTop: 15,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  nfcStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  nfcHelp: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  nfcSharingContainer: {
    backgroundColor: 'rgba(0, 123, 255, 0.1)',
    borderColor: '#007AFF',
  },
  nfcSharingStatus: {
    color: '#007AFF',
  },
  nfcSharingHelp: {
    color: '#007AFF',
    fontWeight: '500',
  },
  nfcReceivingContainer: {
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
    borderColor: '#28a745',
  },
  nfcReceivingStatus: {
    color: '#28a745',
  },
  nfcReceivingHelp: {
    color: '#28a745',
    fontWeight: '500',
  },
  nfcPulseIndicator: {
    alignItems: 'center',
    marginVertical: 10,
  },
  nfcPulseText: {
    fontSize: 24,
  },
  stopButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
    marginTop: 10,
  },
  stopButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  nfcInfoContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  nfcInfo: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  stopButtonContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  largeStopButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  largeStopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  nfcStopButton: {
    backgroundColor: '#fd7e14',
  },
  visualFeedback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  sendingFeedback: {
    backgroundColor: 'rgba(0, 123, 255, 0.8)', // Blue
  },
  receivingFeedback: {
    backgroundColor: 'rgba(40, 167, 69, 0.8)', // Green
  },
  transferComplete: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // White with opacity
    borderRadius: 10,
    padding: 20,
    borderWidth: 2,
    borderColor: '#007AFF', // Highlight color
  },
  feedbackText: {
    color: '#007AFF', // Highlight color
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tapToDismissText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 5,
    minWidth: 80,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  addressContainer: {
    backgroundColor: '#f8f9fa',
    borderColor: '#007AFF',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 5,
  },
  addressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
  },
  tokenSelectorContainer: {
    marginBottom: 20,
  },
  tokenSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tokenSelectorButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenSelectorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tokenSelectorArrow: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  simpleTokenModal: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  simpleTokenList: {
    marginVertical: 15,
  },
  simpleTokenItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenItemLeft: {
    flex: 1,
  },
  tokenBalanceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  simpleTokenItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  simpleTokenText: {
    fontSize: 16,
    color: '#333',
  },
  simpleTokenCheck: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  userMenuButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1001,
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  userMenuButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  userMenuModal: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  userInfoSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  userInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  userInfoValue: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 15,
    fontFamily: 'monospace',
  },
  tokenBalancesSection: {
    marginBottom: 20,
  },
  tokenBalancesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  tokenBalancesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tokenBalanceItem: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tokenBalanceSymbol: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 2,
  },
  tokenBalanceAmount: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  userMenuButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  refreshButton: {
    backgroundColor: '#28a745',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
  },
  swapQuoteContainer: {
    backgroundColor: '#e8f5e8',
    borderColor: '#28a745',
    borderWidth: 2,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  swapQuoteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 10,
    textAlign: 'center',
  },
  swapQuoteDetails: {
    alignItems: 'center',
  },
  swapQuoteText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 5,
  },

});

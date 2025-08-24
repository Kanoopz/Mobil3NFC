import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, Platform, ToastAndroid, ScrollView, Animated } from 'react-native';
import {
  HCESession,
  NFCTagType4NDEFContentType,
  NFCTagType4,
} from 'react-native-hce';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import AuthService from './AuthService';
import BalanceService from './services/BalanceService';
import PaymentService from './services/PaymentService';
import { MONAD_TESTNET_TOKENS, Token } from './constants/blockchain';

interface NFCScreenProps {
  onBack: () => void;
}

export default function NFCScreen({ onBack }: NFCScreenProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState<Token>(MONAD_TESTNET_TOKENS.find(t => t.symbol === 'MON') || MONAD_TESTNET_TOKENS[0]);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
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

  // Log user address and check balance when NFC screen loads
  useEffect(() => {
    const ethereumAddress = authService.getEthereumAddress();
    if (ethereumAddress && ethereumAddress !== 'Invalid Address') {
      console.log('👤 NFC Screen - User Address:', ethereumAddress);
      console.log('🔗 NFC Screen - Short Address:', authService.getShortEthereumAddress());
      
      // Check MON balance
      balanceService.getFormattedBalance(ethereumAddress).then(balance => {
        console.log(`💰 NFC Screen - MON Balance: ${balance}`);
      }).catch(error => {
        console.error('❌ NFC Screen - Error checking balance:', error);
      });

      // Check all token balances
      balanceService.getAllTokenBalances(ethereumAddress).then(balances => {
        console.log('🪙 NFC Screen - Token Balances:');
        balances.forEach(balance => {
          console.log(`  ${balance.symbol}: ${balance.balanceFormatted}`);
        });
      }).catch(error => {
        console.error('❌ NFC Screen - Error checking token balances:', error);
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
          
          // Create NFC Type 4 tag with the user address
          const tag = new NFCTagType4({
            type: NFCTagType4NDEFContentType.Text,
            content: userAddress,
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
                // Text record - should contain Ethereum address
                const textDecoder = new TextDecoder();
                const payload = new Uint8Array(record.payload);
                const text = textDecoder.decode(payload.slice(3)); // Skip language code
                recipientAddress = text.trim();
                console.log('📝 Address record found:', recipientAddress);
                break;
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
              showModal('Payment Confirmation', 
                'Recipient address found!\n\n' +
                'Address: ' + recipientAddress + '\n' +
                'Token: ' + selectedToken.symbol + '\n' +
                'Amount: ' + paymentAmount + ' ' + selectedToken.symbol + '\n\n' +
                'Do you want to proceed with the payment?',
                [
                  {
                    text: 'Cancel',
                    onPress: () => {
                      console.log('❌ User cancelled payment');
                      setModalVisible(false);
                    }
                  },
                  {
                    text: 'Send Payment',
                    onPress: async () => {
                      await executePayment(userPrivateKey, recipientAddress, paymentAmount, selectedToken);
                    }
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

  const clearTransactionData = () => {
    setTransactionHash('');
    setRecipientAddress('');
    setPaymentAmount('');
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
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
          <Text style={styles.tokenSelectorLabel}>🪙 Select Token:</Text>
          <TouchableOpacity 
            style={styles.tokenSelectorButton}
            onPress={() => setShowTokenSelector(true)}
          >
            <View style={styles.tokenSelectorButtonContent}>
              <Text style={styles.tokenSelectorButtonText}>
                {selectedToken.symbol}
              </Text>
              <Text style={styles.tokenSelectorButtonSubtext}>
                {selectedToken.name}
              </Text>
            </View>
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

        <TouchableOpacity 
          style={[styles.buttonContainer, styles.clearButton]}
          onPress={clearTransactionData}
        >
          <Text style={styles.button}>Clear Transaction</Text>
        </TouchableOpacity>
        
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

      {/* Token Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTokenSelector}
        onRequestClose={() => setShowTokenSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.tokenSelectorModalContent]}>
            <Text style={styles.modalTitle}>🪙 Select Token</Text>
            <ScrollView style={styles.tokenListContainer} showsVerticalScrollIndicator={false}>
              {MONAD_TESTNET_TOKENS.map((token) => (
                <TouchableOpacity
                  key={token.symbol}
                  style={[
                    styles.tokenItem,
                    selectedToken.symbol === token.symbol && styles.tokenItemSelected
                  ]}
                  onPress={() => {
                    setSelectedToken(token);
                    setShowTokenSelector(false);
                  }}
                >
                  <View style={styles.tokenItemContent}>
                    <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                    <Text style={styles.tokenName}>{token.name}</Text>
                  </View>
                  {selectedToken.symbol === token.symbol && (
                    <Text style={styles.tokenSelectedCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowTokenSelector(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
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
    marginBottom: 15,
  },
  tokenSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  tokenSelectorButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tokenSelectorButtonContent: {
    flex: 1,
  },
  tokenSelectorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tokenSelectorButtonSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  tokenSelectorArrow: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  tokenSelectorModalContent: {
    maxHeight: '60%',
    width: '90%',
  },
  tokenListContainer: {
    maxHeight: 300,
    marginVertical: 10,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: 'white',
    minHeight: 50,
  },
  tokenItemSelected: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  tokenItemContent: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  tokenName: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  tokenSelectedCheck: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, Platform, ToastAndroid, ScrollView, Animated } from 'react-native';
import {
  HCESession,
  NFCTagType4NDEFContentType,
  NFCTagType4,
} from 'react-native-hce';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import AuthService from './AuthService';
import BalanceService from './services/BalanceService';

interface NFCScreenProps {
  onBack: () => void;
}

export default function NFCScreen({ onBack }: NFCScreenProps) {
  const [inputText, setInputText] = useState('');
  const [sharedText, setSharedText] = useState('NOTHING');
  const [hceSupported, setHceSupported] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [isHceActive, setIsHceActive] = useState(false);
  const [isNfcReading, setIsNfcReading] = useState(false);
  const [hceOperation, setHceOperation] = useState<'none' | 'emulating'>('none');
  const [nfcOperation, setNfcOperation] = useState<'none' | 'reading'>('none');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<Array<{text: string, onPress: () => void}>>([]);
  const [lastSavedText, setLastSavedText] = useState<string>('');
  const [receivedData, setReceivedData] = useState<Array<{text: string, timestamp: string}>>([]);
  const [session, setSession] = useState<HCESession | null>(null);
  
  // Visual feedback states
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [isTransferComplete, setIsTransferComplete] = useState(false);
  const [transferType, setTransferType] = useState<'sending' | 'receiving' | null>(null);
  const [sendAnimation] = useState(new Animated.Value(0));
  const [receiveAnimation] = useState(new Animated.Value(0));
  const [completeAnimation] = useState(new Animated.Value(0));

  const authService = AuthService.getInstance();
  const balanceService = BalanceService.getInstance();

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
    } else {
      console.log('❌ NFC Screen - No valid Ethereum address found');
    }
  }, []);

  // Helper function to show modals
  const showModal = (title: string, message: string, buttons: Array<{text: string, onPress: () => void}>) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

  // Visual feedback functions
  const showSendingFeedback = () => {
    setIsSending(true);
    Animated.sequence([
      Animated.timing(sendAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(sendAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsSending(false);
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

  const showTransferComplete = (type: 'sending' | 'receiving') => {
    setTransferType(type);
    setIsTransferComplete(true);
    Animated.timing(completeAnimation, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
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

  // Initialize NFC and HCE
  useEffect(() => {
    const initNfc = async () => {
      try {
        // Initialize NFC Manager
        await NfcManager.start();
        const isSupported = await NfcManager.isSupported();
        setNfcSupported(isSupported);
        
        if (isSupported) {
          console.log('NFC Supported');
        } else {
          console.log('NFC not supported');
        }
      } catch (error) {
        console.log('NFC Error:', error);
        setNfcSupported(false);
      }
    };

    const initHce = async () => {
      try {
        // Check if HCE is supported (Android API 21+)
        if (Platform.OS === 'android') {
          setHceSupported(true);
          console.log('HCE Supported on Android');
          
          // Initialize HCE session
          const hceSession = await HCESession.getInstance();
          setSession(hceSession);
          console.log('HCE Session initialized successfully');
        } else {
          setHceSupported(false);
          console.log('HCE not supported on this platform');
        }
      } catch (error) {
        console.log('HCE Error:', error);
        setHceSupported(false);
      }
    };

    initNfc();
    initHce();

    return () => {
      // Cleanup
      NfcManager.cancelTechnologyRequest().catch(() => {});
      if (session) {
        session.setEnabled(false).catch(console.error);
      }
    };
  }, []);

  // Monitor sharedText changes
  useEffect(() => {
    if (sharedText !== 'NOTHING') {
      console.log('🔄 SHARED TEXT STATE CHANGED:', sharedText);
      setLastSavedText(sharedText);
    }
  }, [sharedText]);

  // Function to stop HCE operation
  const stopHceOperation = async () => {
    try {
      if (session) {
        await session.setEnabled(false);
        setIsHceActive(false);
        setHceOperation('none');
        showModal('HCE Stopped', 'HCE emulation has been stopped.', [
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
      showModal('NFC Reading Stopped', 'NFC reading has been stopped.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
    } catch (error) {
      console.log('Error stopping NFC reading:', error);
    }
  };

  // Function to read NFC tags
  const readNfcTag = async () => {
    if (isNfcReading) {
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
      setNfcOperation('reading');
      
      showModal('NFC Reading Started', 
        'Starting NFC reading mode...\n\n' +
        'Hold your phone near an NFC tag to read it.\n\n' +
        'The app will automatically detect and read the tag.',
        [
          {
            text: 'Cancel',
            onPress: () => {
              console.log('❌ User cancelled NFC reading');
              stopNfcReading();
            }
          }
        ]
      );

      // Start reading immediately
      setTimeout(async () => {
        try {
          console.log('🔄 Starting NFC reading...');
          
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
            let readText = '';
            
            console.log('📋 Processing', records.length, 'NDEF records');
            
            for (const record of records) {
              console.log('📄 Record type:', record.type, 'TNF:', record.tnf);
              
              if (record.tnf === Ndef.TNF_WELL_KNOWN && record.type[0] === 84) { // 'T' for text
                // Text record
                const textDecoder = new TextDecoder();
                const payload = new Uint8Array(record.payload);
                const text = textDecoder.decode(payload.slice(3)); // Skip language code
                readText += text + '\n';
                console.log('📝 Text record found:', text);
              } else if (record.tnf === Ndef.TNF_WELL_KNOWN && record.type[0] === 85) { // 'U' for URI
                // URI record
                const uriDecoder = new TextDecoder();
                const payload = new Uint8Array(record.payload);
                const uri = uriDecoder.decode(payload.slice(1)); // Skip URI identifier
                readText += uri + '\n';
                console.log('🔗 URI record found:', uri);
              }
            }
            
            if (readText.trim()) {
              const timestamp = new Date().toLocaleString();
              const newData = { text: readText.trim(), timestamp };
              
              setReceivedData(prev => [newData, ...prev]);
              setSharedText(readText.trim());
              
              console.log('✅ NFC data saved:', readText.trim());
              
              // Show receiving feedback
              showReceivingFeedback();
              
              // Show completion illumination
              showTransferComplete('receiving');
              
              // Clean up
              await NfcManager.cancelTechnologyRequest();
              setIsNfcReading(false);
              setNfcOperation('none');
              
              showModal('🎉 DATA RECEIVED SUCCESSFULLY!', 
                `✅ NFC tag has been read!\n\n` +
                  `📥 Received: "${readText.trim()}"\n\n` +
                  `The data has been saved to your app.\n\n` +
                  `Reading will now stop automatically.`, [
                  { 
                    text: 'OK', 
                    onPress: async () => {
                      setModalVisible(false);
                      hideTransferComplete();
                      // Stop reading after confirmation
                      await stopNfcReading();
                    }
                  }
                ]);
            } else {
              console.log('❌ No readable text found in NFC tag');
              
              // Clean up
              await NfcManager.cancelTechnologyRequest();
              setIsNfcReading(false);
              setNfcOperation('none');
              
              showModal('❌ No Readable Data', 'The NFC tag was read but contained no readable text or URI data.', [
                { text: 'OK', onPress: () => setModalVisible(false) }
              ]);
            }
          } else {
            console.log('❌ No NDEF data found in NFC tag');
            
            // Clean up
            await NfcManager.cancelTechnologyRequest();
            setIsNfcReading(false);
            setNfcOperation('none');
            
            showModal('❌ No NDEF Data', 'The NFC tag was read but contained no NDEF data.', [
              { text: 'OK', onPress: () => setModalVisible(false) }
            ]);
          }
          
        } catch (error) {
          console.log('NFC Reading Error:', error);
          
          // Clean up
          await NfcManager.cancelTechnologyRequest().catch(() => {});
          setIsNfcReading(false);
          setNfcOperation('none');
          
          showModal('❌ NFC Reading Error', 'Failed to read NFC tag: ' + error, [
            { text: 'OK', onPress: () => setModalVisible(false) }
          ]);
        }
      }, 1000); // Small delay to ensure UI is ready
      
    } catch (error) {
      console.log('NFC Reading Error:', error);
      setIsNfcReading(false);
      setNfcOperation('none');
      showModal('❌ NFC Reading Error', 'Failed to start NFC reading: ' + error, [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
    }
  };

  const handleEmulate = async () => {
    console.log('=== HCE EMULATION FUNCTION STARTED ===');
    console.log('Input text:', inputText);
    console.log('HCE supported:', hceSupported);
    console.log('HCE active:', isHceActive);
    
    if (!inputText.trim()) {
      console.log('❌ No text to emulate');
      showModal('No Text', 'Please type something first!', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (isHceActive) {
      console.log('❌ HCE already active');
      showModal('HCE Busy', 'HCE is already active. Please stop the current operation first.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (hceSupported && session) {
      try {
        console.log('✅ Starting HCE emulation process');
        setIsHceActive(true);
        setHceOperation('emulating');
        console.log('✅ HCE state set to emulating');
        
        // Show initial popup
        showModal('HCE Emulation Started', 
          'Starting HCE emulation mode...\n\n' +
          'Text to emulate: "' + inputText + '"\n\n' +
          'Your phone will now act as an NFC tag.',
          [
            {
              text: 'Cancel',
              onPress: () => {
                console.log('❌ User cancelled emulation');
                setIsHceActive(false);
                setHceOperation('none');
                setModalVisible(false);
              }
            },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  console.log('🔄 Creating NFC Type 4 tag...');
                  
                  // Create NFC Type 4 tag with the input text
                  const tag = new NFCTagType4({
                    type: NFCTagType4NDEFContentType.Text,
                    content: inputText,
                    writable: false,
                  });
                  
                  console.log('✅ NFC Type 4 tag created');
                  console.log('Tag content:', inputText);
                  
                  // Set the tag as the application for the HCE session
                  session.setApplication(tag);
                  console.log('✅ Tag set as HCE application');
                  
                  // Enable HCE emulation
                  await session.setEnabled(true);
                  console.log('✅ HCE emulation enabled');
                  
                  setModalVisible(false);
                  
                  // Show ready popup
                  showModal('HCE Emulation Ready', 
                    '✅ HCE is now active!\n\n' +
                    'Text: "' + inputText + '"\n\n' +
                    'Your phone is now emulating an NFC tag.\n' +
                    'Other devices can read this tag by tapping.\n\n' +
                    'Keep this screen open to maintain emulation.',
                    [
                      {
                        text: 'Stop Emulation',
                        onPress: () => {
                          console.log('❌ User stopped HCE emulation');
                          stopHceOperation();
                        }
                      }
                    ]
                  );
                  
                  // Set up event listener for when the tag is read
                  const removeListener = session.on(HCESession.Events.HCE_STATE_READ, () => {
                    console.log('📳 TAG HAS BEEN READ!');
                    console.log('⏰ Timestamp:', new Date().toISOString());
                    console.log('📱 Device state - isHceActive:', isHceActive);
                    console.log('📱 Device state - hceOperation:', hceOperation);
                    
                    // Show sending feedback
                    showSendingFeedback();
                    
                    // Show completion illumination
                    showTransferComplete('sending');
                    
                    // Show toast notification
                    if (Platform.OS === 'android') {
                      ToastAndroid.show('The tag has been read! Thank You.', ToastAndroid.LONG);
                    }
                    
                    // Don't update shared text state on sender - only on receiver
                    console.log('📤 DATA SENT SUCCESSFULLY:', inputText);
                    console.log('✅ Emulated text was read by another device');
                    
                    showModal('🎉 DATA SENT SUCCESSFULLY!', 
                      `✅ Your NFC tag has been read!\n\n` +
                        `📤 Sent: "${inputText}"\n\n` +
                        `The other device has received this data.\n\n` +
                        `Emulation will now stop automatically.`, [
                        { 
                          text: 'OK', 
                          onPress: async () => {
                            setModalVisible(false);
                            hideTransferComplete();
                            // Stop emulation after confirmation
                            await stopHceOperation();
                          }
                        }
                      ]);
                  });
                  
                  // Store the remove listener function for cleanup
                  // Note: In a real app, you'd want to store this and call it on cleanup
                  
                } catch (error) {
                  console.log('HCE Emulation Error:', error);
                  setIsHceActive(false);
                  setHceOperation('none');
                  showModal('❌ HCE Error', 'Failed to start HCE emulation: ' + error, [
                    { text: 'OK', onPress: () => setModalVisible(false) }
                  ]);
                }
              }
            }
          ]
        );
        
      } catch (error) {
        console.log('HCE Emulation Error:', error);
        setIsHceActive(false);
        setHceOperation('none');
        showModal('❌ HCE Error', 'Failed to start HCE emulation: ' + error, [
          { text: 'OK', onPress: () => setModalVisible(false) }
        ]);
      }
    } else {
      showModal('HCE Not Available', 'HCE is not supported on this device or platform', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
    }
  };

  const clearReceivedData = () => {
    setReceivedData([]);
    setSharedText('NOTHING');
    setLastSavedText('');
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
      {isSending && (
        <Animated.View 
          style={[
            styles.visualFeedback,
            styles.sendingFeedback,
            {
              opacity: sendAnimation,
            }
          ]}
        >
          <Text style={styles.feedbackText}>📤 SENDING DATA...</Text>
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
          <Text style={styles.feedbackText}>📥 RECEIVING DATA...</Text>
        </Animated.View>
      )}
      
      {isTransferComplete && (
        <Animated.View 
          style={[
            styles.visualFeedback,
            styles.transferComplete,
            {
              opacity: completeAnimation,
            }
          ]}
        >
          <Text style={styles.feedbackText}>
            {transferType === 'sending' ? '📤 DATA SENT!' : '📥 DATA RECEIVED!'}
          </Text>
        </Animated.View>
      )}
      
      {/* Large Stop Buttons when operations are Active */}
      {(isHceActive || isNfcReading) && (
        <View style={styles.stopButtonContainer}>
          {isHceActive && (
            <TouchableOpacity style={styles.largeStopButton} onPress={stopHceOperation}>
              <Text style={styles.largeStopButtonText}>
                🛑 STOP HCE EMULATION
              </Text>
            </TouchableOpacity>
          )}
          {isNfcReading && (
            <TouchableOpacity style={[styles.largeStopButton, styles.nfcStopButton]} onPress={stopNfcReading}>
              <Text style={styles.largeStopButtonText}>
                🛑 STOP NFC READING
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.helloWeb}>NFC Reader & Emulator 📱</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Type something to emulate as NFC tag..."
          value={inputText}
          onChangeText={setInputText}
        />
        
        {inputText ? (
          <Text style={styles.displayText}>You typed: {inputText}</Text>
        ) : null}
        
        <View style={styles.sharedTextContainer}>
          <Text style={styles.sharedTextLabel}>📥 Last Received Data:</Text>
          <Text style={styles.sharedText}>{sharedText}</Text>
          {lastSavedText && (
            <Text style={styles.lastSavedText}>
              💾 Last received: {lastSavedText} at {new Date().toLocaleTimeString()}
            </Text>
          )}
        </View>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.buttonContainer}
            onPress={handleEmulate}
          >
            <Text style={styles.button}>Emulate NFC Tag</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.buttonContainer, styles.readButton]}
            onPress={readNfcTag}
          >
            <Text style={styles.button}>Read NFC Tag</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.buttonContainer, styles.clearButton]}
          onPress={clearReceivedData}
        >
          <Text style={styles.button}>Clear All Data</Text>
        </TouchableOpacity>
        
        {/* Received Data History */}
        {receivedData.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>📋 Received Data History:</Text>
            {receivedData.map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyText}>{item.text}</Text>
                <Text style={styles.historyTimestamp}>{item.timestamp}</Text>
              </View>
            ))}
          </View>
        )}
        
        {!hceSupported && !nfcSupported && (
          <View style={styles.nfcStatusContainer}>
            <Text style={styles.nfcStatus}>❌ NFC/HCE not supported on this device</Text>
            <Text style={styles.nfcHelp}>This device doesn't support NFC or Host Card Emulation</Text>
          </View>
        )}
        
        {hceSupported && !isHceActive && (
          <View style={styles.nfcStatusContainer}>
            <Text style={styles.nfcStatus}>✅ HCE Ready!</Text>
            <Text style={styles.nfcHelp}>Tap "Emulate NFC Tag" to start HCE emulation</Text>
          </View>
        )}
        
        {nfcSupported && !isNfcReading && (
          <View style={styles.nfcStatusContainer}>
            <Text style={styles.nfcStatus}>✅ NFC Ready!</Text>
            <Text style={styles.nfcHelp}>Tap "Read NFC Tag" to read NFC tags</Text>
          </View>
        )}
        
        {hceSupported && isHceActive && hceOperation === 'emulating' && (
          <View style={[styles.nfcStatusContainer, styles.nfcSharingContainer]}>
            <Text style={[styles.nfcStatus, styles.nfcSharingStatus]}>📤 HCE EMULATION ACTIVE!</Text>
            <Text style={styles.nfcSharingHelp}>Your phone is emulating an NFC tag with: "{inputText}"</Text>
            <View style={styles.nfcPulseIndicator}>
              <Text style={styles.nfcPulseText}>📤</Text>
            </View>
            <TouchableOpacity style={styles.stopButton} onPress={stopHceOperation}>
              <Text style={styles.stopButtonText}>🛑 Stop Emulation</Text>
            </TouchableOpacity>
          </View>
        )}

        {nfcSupported && isNfcReading && nfcOperation === 'reading' && (
          <View style={[styles.nfcStatusContainer, styles.nfcReceivingContainer]}>
            <Text style={[styles.nfcStatus, styles.nfcReceivingStatus]}>📥 NFC READING ACTIVE!</Text>
            <Text style={styles.nfcReceivingHelp}>Hold your phone near an NFC tag to read it</Text>
            <View style={styles.nfcPulseIndicator}>
              <Text style={styles.nfcPulseText}>📥</Text>
            </View>
            <TouchableOpacity style={styles.stopButton} onPress={stopNfcReading}>
              <Text style={styles.stopButtonText}>🛑 Stop Reading</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.nfcInfoContainer}>
          <Text style={styles.nfcInfo}>
            📱 Device: {hceSupported ? 'HCE Capable' : 'No HCE'} | {nfcSupported ? 'NFC Capable' : 'No NFC'}
          </Text>
          <Text style={styles.nfcInfo}>
            🔧 Status: {hceSupported ? (isHceActive ? 'HCE ACTIVE' : 'HCE Ready') : 'HCE Unavailable'} | {nfcSupported ? (isNfcReading ? 'NFC ACTIVE' : 'NFC Ready') : 'NFC Unavailable'}
          </Text>
          <Text style={styles.nfcInfo}>
            🏷️ Mode: Host Card Emulation (HCE) + NFC Reading
          </Text>
        </View>
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
  lastSavedText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
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
    fontWeight: '600',
  },
  readButton: {
    backgroundColor: '#28a745',
  },
  clearButton: {
    backgroundColor: '#dc3545',
    alignSelf: 'center',
  },
  historyContainer: {
    backgroundColor: '#f8f9fa',
    borderColor: '#dee2e6',
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 10,
    textAlign: 'center',
  },
  historyItem: {
    backgroundColor: 'white',
    borderColor: '#dee2e6',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  historyText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 5,
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  nfcStatusContainer: {
    marginTop: 15,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  nfcStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  nfcHelp: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  nfcInfoContainer: {
    marginTop: 20,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
  },
  nfcInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
    textAlign: 'center',
  },
  nfcSharingContainer: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
    borderWidth: 2,
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  nfcSharingStatus: {
    color: '#155724',
    fontSize: 20,
    fontWeight: 'bold',
  },
  nfcSharingHelp: {
    color: '#155724',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
  },
  nfcReceivingContainer: {
    backgroundColor: '#d1ecf1',
    borderColor: '#17a2b8',
    borderWidth: 2,
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  nfcReceivingStatus: {
    color: '#0c5460',
    fontSize: 20,
    fontWeight: 'bold',
  },
  nfcReceivingHelp: {
    color: '#0c5460',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
  },
  nfcPulseIndicator: {
    alignItems: 'center',
    marginTop: 10,
  },
  nfcPulseText: {
    fontSize: 24,
    color: '#ffc107',
    fontWeight: 'bold',
  },
  stopButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  stopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  stopButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  largeStopButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    marginBottom: 10,
  },
  nfcStopButton: {
    backgroundColor: '#fd7e14',
  },
  largeStopButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
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
});

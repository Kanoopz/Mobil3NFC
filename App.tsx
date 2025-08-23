import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, Platform } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [sharedText, setSharedText] = useState('NOTHING');
  const [nfcSupported, setNfcSupported] = useState(false);
  const [isNfcEnabled, setIsNfcEnabled] = useState(false);
  const [isNfcActive, setIsNfcActive] = useState(false);
  const [nfcOperation, setNfcOperation] = useState<'none' | 'sharing' | 'receiving'>('none');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<Array<{text: string, onPress: () => void}>>([]);
  const [lastSavedText, setLastSavedText] = useState<string>('');

  // Helper function to show modals
  const showModal = (title: string, message: string, buttons: Array<{text: string, onPress: () => void}>) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

  // Function to stop NFC operation
  const stopNfcOperation = async () => {
    try {
      await NfcManager.cancelTechnologyRequest();
      setIsNfcActive(false);
      setNfcOperation('none');
      showModal('NFC Stopped', 'NFC operation has been cancelled.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
    } catch (error) {
      console.log('Error stopping NFC:', error);
    }
  };

  // Initialize NFC
  useEffect(() => {
    const initNfc = async () => {
      try {
        await NfcManager.start();
        const isSupported = await NfcManager.isSupported();
        setNfcSupported(isSupported);
        console.log('NFC Supported:', isSupported);
        
        if (isSupported) {
          setIsNfcEnabled(true);
          console.log('NFC Started successfully');
        }
      } catch (error) {
        console.log('NFC Error:', error);
        setNfcSupported(false);
      }
    };

    initNfc();

    return () => {
      NfcManager.cancelTechnologyRequest();
    };
  }, []);

  // Monitor sharedText changes
  useEffect(() => {
    if (sharedText !== 'NOTHING') {
      console.log('🔄 SHARED TEXT STATE CHANGED:', sharedText);
      setLastSavedText(sharedText);
    }
  }, [sharedText]);

  const handleShare = async () => {
    console.log('=== SHARE FUNCTION STARTED ===');
    console.log('Input text:', inputText);
    console.log('NFC supported:', nfcSupported);
    console.log('NFC active:', isNfcActive);
    
    if (!inputText.trim()) {
      console.log('❌ No text to share');
      showModal('No Text', 'Please type something first!', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (isNfcActive) {
      console.log('❌ NFC already active');
      showModal('NFC Busy', 'NFC is already active. Please wait or cancel the current operation.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (nfcSupported) {
      try {
        console.log('✅ Starting NFC sharing process');
        setIsNfcActive(true);
        setNfcOperation('sharing');
        console.log('✅ NFC state set to sharing');
        
        // Show initial popup
        showModal('NFC Sharing Started', 
          'Starting NFC sharing mode...\n\n' +
          'Text to share: "' + inputText + '"',
          [
            {
              text: 'Cancel',
              onPress: () => {
                console.log('❌ User cancelled sharing');
                setIsNfcActive(false);
                setNfcOperation('none');
                NfcManager.cancelTechnologyRequest();
                setModalVisible(false);
              }
            },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  console.log('🔄 Requesting NFC technology (NDEF)...');
                  // Start NFC sharing mode
                  await NfcManager.requestTechnology(NfcTech.Ndef);
                  console.log('✅ NFC technology requested successfully');
                  setModalVisible(false);
                  
                  // Show ready popup
                  showModal('NFC Share Ready', 
                    '✅ NFC is now active for sharing!\n\n' +
                    'Text: "' + inputText + '"\n\n' +
                    'Tap your phone to another phone to share.\n' +
                    'Keep this screen open until connection.',
                    [
                      {
                        text: 'Cancel',
                        onPress: () => {
                          console.log('❌ User cancelled NFC sharing');
                          setIsNfcActive(false);
                          setNfcOperation('none');
                          NfcManager.cancelTechnologyRequest();
                          setModalVisible(false);
                        }
                      }
                    ]
                  );
                  
                  // Register for tag discovery (when another device connects)
                  console.log('🔄 Registering tag event for sharing...');
                  console.log('📱 Waiting for phone vibration/connection...');
                  NfcManager.registerTagEvent(
                    async (tag: any) => {
                      try {
                        console.log('📳 PHONE VIBRATED - NFC CONNECTION DETECTED!');
                        console.log('🎯 TAG DISCOVERED FOR SHARING!');
                        console.log('⏰ Timestamp:', new Date().toISOString());
                        console.log('📱 Device state - isNfcActive:', isNfcActive);
                        console.log('📱 Device state - nfcOperation:', nfcOperation);
                        console.log('Tag object:', tag);
                        console.log('Tag ID:', tag.id);
                        console.log('Tag tech types:', tag.techTypes);
                        console.log('Tag isWritable:', tag.isWritable);
                        console.log('Tag has NDEF:', !!tag.ndefMessage);
                        console.log('Tag NDEF message length:', tag.ndefMessage ? tag.ndefMessage.length : 0);
                        
                        showModal('NFC Connection Detected', 'Another device is connecting...', [
                          { text: 'OK', onPress: () => setModalVisible(false) }
                        ]);
                        
                        // Create NDEF message with app-specific record
                        const appRecord = {
                          tnf: 0x04, // NFC Forum external type
                          type: 'com.kanoopz.NFCTestApp', // Your app's package name
                          payload: Array.from(inputText, c => c.charCodeAt(0))
                        };
                        
                        const textRecord = {
                          tnf: 0x01, // NFC Forum well-known type
                          type: 'T', // Text type
                          payload: Array.from(inputText, c => c.charCodeAt(0))
                        };
                        
                        // Add a simple URL record as backup
                        const urlRecord = {
                          tnf: 0x01, // NFC Forum well-known type
                          type: 'U', // URL type
                          payload: Array.from('https://example.com/' + inputText, c => c.charCodeAt(0))
                        };
                        
                        console.log('📤 PREPARING TO SHARE DATA');
                        console.log('Sharing text:', inputText);
                        console.log('App record:', appRecord);
                        console.log('Text record:', textRecord);
                        console.log('URL record:', urlRecord);
                        console.log('Combined records:', [appRecord, textRecord, urlRecord]);
                        
                        // Another device has connected - share the data
                        console.log('🔄 Writing NDEF message...');
                        try {
                          await NfcManager.ndefHandler.writeNdefMessage([appRecord, textRecord, urlRecord]);
                          console.log('✅ NDEF message written successfully!');
                        } catch (writeError) {
                          console.log('❌ Error writing NDEF message:', writeError);
                          console.log('🔄 Trying alternative approach...');
                          
                          // Try with just the text record
                          try {
                            await NfcManager.ndefHandler.writeNdefMessage([textRecord]);
                            console.log('✅ Simple text record written successfully!');
                          } catch (simpleError) {
                            console.log('❌ Error writing simple record:', simpleError);
                            throw simpleError;
                          }
                        }
                        console.log('💾 SAVING SHARED TEXT TO STATE:', inputText);
                        setSharedText(inputText);
                        console.log('✅ Shared text state updated');
                        setInputText(''); // Clear the input after sharing
                        setIsNfcActive(false);
                        setNfcOperation('none');
                        showModal('🎉 SHARED SUCCESSFULLY!', 
                          `✅ Your text has been shared via NFC!\n\n` +
                          `📤 Shared: "${inputText}"\n\n` +
                          `The other phone should have received this data.`, [
                          { text: 'OK', onPress: () => setModalVisible(false) }
                        ]);
                        await NfcManager.cancelTechnologyRequest();
                      } catch (error) {
                        console.log('NFC Share Error:', error);
                        setIsNfcActive(false);
                        setNfcOperation('none');
                        showModal('❌ NFC Share Error', 'Failed to share via NFC: ' + error, [
                          { text: 'OK', onPress: () => setModalVisible(false) }
                        ]);
                        await NfcManager.cancelTechnologyRequest();
                      }
                    },
                    'Hold your device over the receiving phone',
                    true
                  );
                  
                } catch (error) {
                  console.log('NFC Share Error:', error);
                  setIsNfcActive(false);
                  setNfcOperation('none');
                  showModal('❌ NFC Error', 'Failed to start NFC sharing: ' + error, [
                    { text: 'OK', onPress: () => setModalVisible(false) }
                  ]);
                }
              }
            }
          ]
        );
        
      } catch (error) {
        console.log('NFC Share Error:', error);
        setIsNfcActive(false);
        setNfcOperation('none');
        showModal('❌ NFC Error', 'Failed to start NFC sharing: ' + error, [
          { text: 'OK', onPress: () => setModalVisible(false) }
        ]);
      }
    } else {
      // Fallback to local sharing
      setSharedText(inputText);
      setInputText(''); // Clear the input after sharing
    }
  };

  const handleReceive = async () => {
    console.log('=== RECEIVE FUNCTION STARTED ===');
    console.log('NFC supported:', nfcSupported);
    console.log('NFC active:', isNfcActive);
    
    if (isNfcActive) {
      console.log('❌ NFC already active');
      showModal('NFC Busy', 'NFC is already active. Please wait or cancel the current operation.', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
      return;
    }

    if (nfcSupported) {
      try {
        console.log('✅ Starting NFC receiving process');
        setIsNfcActive(true);
        setNfcOperation('receiving');
        console.log('✅ NFC state set to receiving');
        
        // Show initial popup
        showModal('NFC Receiving Started', 
          'Starting NFC receiving mode...\n\n' +
          'Ready to receive data from another phone.',
          [
            {
              text: 'Cancel',
              onPress: () => {
                setIsNfcActive(false);
                setNfcOperation('none');
                NfcManager.cancelTechnologyRequest();
                setModalVisible(false);
              }
            },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  // Start NFC receiving mode
                  await NfcManager.requestTechnology(NfcTech.Ndef);
                  setModalVisible(false);
                  
                  // Show ready popup
                  showModal('NFC Receive Ready', 
                    '✅ NFC is now active for receiving!\n\n' +
                    'Tap your phone to another phone to receive data.\n' +
                    'Keep this screen open until connection.',
                    [
                      {
                        text: 'Cancel',
                        onPress: () => {
                          setIsNfcActive(false);
                          setNfcOperation('none');
                          NfcManager.cancelTechnologyRequest();
                          setModalVisible(false);
                        }
                      }
                    ]
                  );
                  
                  // Register for tag discovery (when data is received)
                  console.log('🔄 Registering tag event for receiving...');
                  console.log('📱 Waiting for phone vibration/connection...');
                  NfcManager.registerTagEvent(
                    async (tag: any) => {
                      try {
                        console.log('📳 PHONE VIBRATED - NFC CONNECTION DETECTED!');
                        console.log('🎯 TAG DISCOVERED FOR RECEIVING!');
                        console.log('⏰ Timestamp:', new Date().toISOString());
                        console.log('📱 Device state - isNfcActive:', isNfcActive);
                        console.log('📱 Device state - nfcOperation:', nfcOperation);
                        console.log('Tag object:', tag);
                        console.log('Tag ID:', tag.id);
                        console.log('Tag tech types:', tag.techTypes);
                        console.log('Tag isWritable:', tag.isWritable);
                        console.log('Tag has NDEF:', !!tag.ndefMessage);
                        console.log('Tag NDEF message length:', tag.ndefMessage ? tag.ndefMessage.length : 0);
                        
                        showModal('NFC Connection Detected', 'Receiving data from another device...', [
                          { text: 'OK', onPress: () => setModalVisible(false) }
                        ]);
                        
                        if (tag.ndefMessage && tag.ndefMessage.length > 0) {
                          console.log('📨 NDEF MESSAGE FOUND AFTER VIBRATION!');
                          console.log('📊 NDEF Message received:', tag.ndefMessage);
                          console.log('📊 Total records in message:', tag.ndefMessage.length);
                          
                          // Look for our app-specific record first
                          let receivedText = '';
                          console.log('🔍 Starting to parse NDEF records...');
                          
                          for (let i = 0; i < tag.ndefMessage.length; i++) {
                            const record = tag.ndefMessage[i];
                            console.log(`📋 Record ${i + 1}/${tag.ndefMessage.length}:`, record);
                            console.log(`📋 Record ${i + 1} type:`, record.type);
                            console.log(`📋 Record ${i + 1} TNF:`, record.tnf);
                            console.log(`📋 Record ${i + 1} payload length:`, record.payload ? record.payload.length : 0);
                            console.log(`📋 Record ${i + 1} payload:`, record.payload);
                            
                            if (record.type === 'com.kanoopz.NFCTestApp') {
                              console.log(`🎯 MATCH FOUND: App-specific record in record ${i + 1}!`);
                              console.log(`🔤 Converting payload to text...`);
                              receivedText = String.fromCharCode.apply(null, Array.from(record.payload));
                              console.log(`✅ Extracted text from app record: "${receivedText}"`);
                              console.log(`✅ Text length: ${receivedText.length} characters`);
                              break;
                            } else if (record.type === 'T') {
                              console.log(`🎯 MATCH FOUND: Text record in record ${i + 1}!`);
                              console.log(`🔤 Converting payload to text...`);
                              receivedText = String.fromCharCode.apply(null, Array.from(record.payload));
                              console.log(`✅ Extracted text from text record: "${receivedText}"`);
                              console.log(`✅ Text length: ${receivedText.length} characters`);
                              console.log('💾 SAVING RECEIVED TEXT TO STATE:', receivedText);
                              setSharedText(receivedText);
                              console.log('✅ Received text state updated');
                              break;
                            } else if (record.type === 'U') {
                              console.log(`🎯 MATCH FOUND: URL record in record ${i + 1}!`);
                              console.log(`🔤 Converting payload to text...`);
                              const urlText = String.fromCharCode.apply(null, Array.from(record.payload));
                              console.log(`✅ Extracted URL: "${urlText}"`);
                              // Extract the text part after the URL
                              if (urlText.startsWith('https://example.com/')) {
                                receivedText = urlText.replace('https://example.com/', '');
                                console.log(`✅ Extracted text from URL: "${receivedText}"`);
                                console.log(`✅ Text length: ${receivedText.length} characters`);
                                console.log('💾 SAVING RECEIVED TEXT TO STATE:', receivedText);
                                setSharedText(receivedText);
                                console.log('✅ Received text state updated');
                                break;
                              }
                            } else {
                              console.log(`❌ Record ${i + 1} type "${record.type}" doesn't match expected types`);
                            }
                          }
                          
                          if (receivedText) {
                            setSharedText(receivedText);
                            setIsNfcActive(false);
                            setNfcOperation('none');
                            showModal('🎉 RECEIVED SUCCESSFULLY!', 
                              `✅ Data received via NFC!\n\n` +
                              `📥 Received: "${receivedText}"\n\n` +
                              `The text has been saved and is now displayed below.`, [
                              { text: 'OK', onPress: () => setModalVisible(false) }
                            ]);
                          } else {
                            // Try alternative parsing methods
                            console.log('Trying alternative parsing...');
                            let alternativeText = '';
                            
                            // Try to parse any text-like data
                            for (const record of tag.ndefMessage) {
                              try {
                                if (record.payload && record.payload.length > 0) {
                                  const payloadString = String.fromCharCode.apply(null, Array.from(record.payload));
                                  console.log('Alternative payload string:', payloadString);
                                  
                                  // If it looks like text, use it
                                  if (payloadString.length > 0 && payloadString.length < 1000) {
                                    alternativeText = payloadString;
                                    break;
                                  }
                                }
                              } catch (e) {
                                console.log('Error parsing alternative payload:', e);
                              }
                            }
                            
                            if (alternativeText) {
                              console.log('💾 SAVING ALTERNATIVE TEXT TO STATE:', alternativeText);
                              setSharedText(alternativeText);
                              console.log('✅ Alternative text state updated');
                              setIsNfcActive(false);
                              setNfcOperation('none');
                              showModal('🎉 RECEIVED SUCCESSFULLY!', 
                                `✅ Data received via NFC!\n\n` +
                                `📥 Received: "${alternativeText}"\n\n` +
                                `The text has been saved and is now displayed below.`, [
                                { text: 'OK', onPress: () => setModalVisible(false) }
                              ]);
                            } else {
                              setIsNfcActive(false);
                              setNfcOperation('none');
                              showModal('❌ No Compatible Data', 'No compatible data found in NFC message. Check console for debugging info.', [
                                { text: 'OK', onPress: () => setModalVisible(false) }
                              ]);
                            }
                          }
                        }
                        await NfcManager.cancelTechnologyRequest();
                      } catch (error) {
                        console.log('NFC Receive Error:', error);
                        setIsNfcActive(false);
                        setNfcOperation('none');
                        showModal('❌ NFC Receive Error', 'Failed to receive via NFC: ' + error, [
                          { text: 'OK', onPress: () => setModalVisible(false) }
                        ]);
                        await NfcManager.cancelTechnologyRequest();
                      }
                    },
                    'Hold your device over the sending phone',
                    true
                  );
                  
                } catch (error) {
                  console.log('NFC Receive Error:', error);
                  setIsNfcActive(false);
                  setNfcOperation('none');
                  showModal('❌ NFC Error', 'Failed to start NFC receiving: ' + error, [
                    { text: 'OK', onPress: () => setModalVisible(false) }
                  ]);
                }
              }
            }
          ]
        );
        
      } catch (error) {
        console.log('NFC Receive Error:', error);
        setIsNfcActive(false);
        setNfcOperation('none');
        showModal('❌ NFC Error', 'Failed to start NFC receiving: ' + error, [
          { text: 'OK', onPress: () => setModalVisible(false) }
        ]);
      }
    } else {
      showModal('NFC Not Available', 'NFC is not supported on this device', [
        { text: 'OK', onPress: () => setModalVisible(false) }
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Large Stop Button when NFC is Active */}
      {isNfcActive && (
        <View style={styles.stopButtonContainer}>
          <TouchableOpacity style={styles.largeStopButton} onPress={stopNfcOperation}>
            <Text style={styles.largeStopButtonText}>
              🛑 STOP {nfcOperation.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.content}>
        <Text style={styles.helloWeb}>Hello NFC! 📱</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Type something here..."
          value={inputText}
          onChangeText={setInputText}
        />
        
        {inputText ? (
          <Text style={styles.displayText}>You typed: {inputText}</Text>
        ) : null}
        
        <View style={styles.sharedTextContainer}>
          <Text style={styles.sharedTextLabel}>📥 Received Data:</Text>
          <Text style={styles.sharedText}>{sharedText}</Text>
          {lastSavedText && (
            <Text style={styles.lastSavedText}>
              💾 Last saved: {lastSavedText} at {new Date().toLocaleTimeString()}
            </Text>
          )}
        </View>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.buttonContainer}
            onPress={handleShare}
          >
            <Text style={styles.button}>Share</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.buttonContainer, styles.receiveButton]}
            onPress={handleReceive}
          >
            <Text style={styles.button}>Receive</Text>
          </TouchableOpacity>
        </View>
        
        {!nfcSupported && (
          <View style={styles.nfcStatusContainer}>
            <Text style={styles.nfcStatus}>❌ NFC not supported on this device</Text>
            <Text style={styles.nfcHelp}>This device doesn't have NFC hardware</Text>
          </View>
        )}
        
        {nfcSupported && !isNfcActive && (
          <View style={styles.nfcStatusContainer}>
            <Text style={styles.nfcStatus}>✅ NFC Ready!</Text>
            <Text style={styles.nfcHelp}>Tap Share or Receive to start NFC</Text>
          </View>
        )}
        
        {nfcSupported && isNfcActive && nfcOperation === 'sharing' && (
          <View style={[styles.nfcStatusContainer, styles.nfcSharingContainer]}>
            <Text style={[styles.nfcStatus, styles.nfcSharingStatus]}>📤 SHARING MODE ACTIVE!</Text>
            <Text style={styles.nfcSharingHelp}>Touch phones together to share: "{inputText}"</Text>
            <View style={styles.nfcPulseIndicator}>
              <Text style={styles.nfcPulseText}>📤</Text>
            </View>
            <TouchableOpacity style={styles.stopButton} onPress={stopNfcOperation}>
              <Text style={styles.stopButtonText}>🛑 Stop Sharing</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {nfcSupported && isNfcActive && nfcOperation === 'receiving' && (
          <View style={[styles.nfcStatusContainer, styles.nfcReceivingContainer]}>
            <Text style={[styles.nfcStatus, styles.nfcReceivingStatus]}>📥 RECEIVING MODE ACTIVE!</Text>
            <Text style={styles.nfcReceivingHelp}>Touch phones together to receive data</Text>
            <View style={styles.nfcPulseIndicator}>
              <Text style={styles.nfcPulseText}>📥</Text>
            </View>
            <TouchableOpacity style={styles.stopButton} onPress={stopNfcOperation}>
              <Text style={styles.stopButtonText}>🛑 Stop Receiving</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.nfcInfoContainer}>
          <Text style={styles.nfcInfo}>
            📱 Device: {nfcSupported ? 'NFC Capable' : 'No NFC'}
          </Text>
          <Text style={styles.nfcInfo}>
            🔧 Status: {nfcSupported ? (isNfcActive ? 'ACTIVE' : 'Ready') : 'Unavailable'}
          </Text>
        </View>
      </View>
      
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  helloWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    width: '80%',
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
    minWidth: '80%',
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
  },
  buttonContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  button: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  receiveButton: {
    backgroundColor: '#ffc107',
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
  },
  largeStopButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
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
});

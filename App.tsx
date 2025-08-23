import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [sharedText, setSharedText] = useState('NOTHING');
  const [nfcSupported, setNfcSupported] = useState(false);
  const [isNfcEnabled, setIsNfcEnabled] = useState(false);

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

  const handleShare = async () => {
    if (!inputText.trim()) {
      Alert.alert('No Text', 'Please type something first!');
      return;
    }

    if (nfcSupported) {
      try {
        // Start NFC sharing mode - this will make the device discoverable
        await NfcManager.requestTechnology(NfcTech.Ndef);
        
        // Create a shareable NDEF message
        const shareMessage = [
          {
            type: 'text/plain',
            value: inputText,
            payload: Array.from(inputText, c => c.charCodeAt(0))
          }
        ];
        
        // Make this device available for NFC sharing
        Alert.alert('NFC Share Ready', 
          'Tap your phone to another phone to share: "' + inputText + '"\n\n' +
          'Keep this screen open until the other phone taps to receive.'
        );
        
        // Wait for another device to connect
        NfcManager.setEventListener(NfcManager.EVENT_TAG_DISCOVERED, async (tag) => {
          try {
            // Another device has connected - share the data
            await NfcManager.writeNdefMessage(shareMessage);
            setSharedText(inputText);
            setInputText(''); // Clear the input after sharing
            Alert.alert('Shared!', 'Data shared successfully via NFC!');
            await NfcManager.cancelTechnologyRequest();
          } catch (error) {
            console.log('NFC Share Error:', error);
            Alert.alert('NFC Error', 'Failed to share via NFC: ' + error);
          }
        });
        
      } catch (error) {
        console.log('NFC Share Error:', error);
        Alert.alert('NFC Error', 'Failed to start NFC sharing: ' + error);
      }
    } else {
      // Fallback to local sharing
      setSharedText(inputText);
      setInputText(''); // Clear the input after sharing
    }
  };

  const handleReceive = async () => {
    if (nfcSupported) {
      try {
        // Start NFC receiving mode
        await NfcManager.requestTechnology(NfcTech.Ndef);
        
        Alert.alert('NFC Receive Ready', 
          'Tap your phone to another phone to receive data.\n\n' +
          'Keep this screen open until you tap the sending phone.'
        );
        
        // Wait for data from another device
        NfcManager.setEventListener(NfcManager.EVENT_TAG_DISCOVERED, async (tag) => {
          try {
            if (tag.ndefMessage && tag.ndefMessage.length > 0) {
              const receivedData = tag.ndefMessage[0];
              const receivedText = String.fromCharCode.apply(null, Array.from(receivedData.payload));
              setSharedText(receivedText);
              Alert.alert('Received!', `Received via NFC: "${receivedText}"`);
            }
            await NfcManager.cancelTechnologyRequest();
          } catch (error) {
            console.log('NFC Receive Error:', error);
            Alert.alert('NFC Error', 'Failed to receive via NFC: ' + error);
          }
        });
        
      } catch (error) {
        console.log('NFC Receive Error:', error);
        Alert.alert('NFC Error', 'Failed to start NFC receiving: ' + error);
      }
    } else {
      Alert.alert('NFC Not Available', 'NFC is not supported on this device');
    }
  };

  return (
    <View style={styles.container}>
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
        
        <Text style={styles.sharedText}>Shared: {sharedText}</Text>
        
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
        
        {nfcSupported && (
          <View style={styles.nfcStatusContainer}>
            <Text style={styles.nfcStatus}>✅ NFC Ready!</Text>
            <Text style={styles.nfcHelp}>You can send and receive NFC messages</Text>
          </View>
        )}
        
        <View style={styles.nfcInfoContainer}>
          <Text style={styles.nfcInfo}>
            📱 Device: {nfcSupported ? 'NFC Capable' : 'No NFC'}
          </Text>
          <Text style={styles.nfcInfo}>
            🔧 Status: {nfcSupported ? 'Ready' : 'Unavailable'}
          </Text>
        </View>
      </View>
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
  sharedText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
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
});

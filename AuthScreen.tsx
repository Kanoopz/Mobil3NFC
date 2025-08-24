import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import AuthService from './AuthService';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'email' | 'quick'>('email');
  const [codeSent, setCodeSent] = useState(false);
  const [isEmailServiceConfigured, setIsEmailServiceConfigured] = useState(false);

  const authService = AuthService.getInstance();

  useEffect(() => {
    // Check if email service is configured
    setIsEmailServiceConfigured(authService.isEmailJSConfigured());
  }, []);

  const handleEmailVerification = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.requestVerificationCode(email.trim());
      
      if (result.success) {
        setCodeSent(true);
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.verifyCode(verificationCode.trim());
      
      if (result.success) {
        Alert.alert('Success', result.message, [
          {
            text: 'Go to NFC',
            onPress: onAuthSuccess
          }
        ]);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAccess = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.quickAccess(email.trim());
      
      if (result.success) {
        Alert.alert('Success', result.message, [
          {
            text: 'Go to NFC',
            onPress: onAuthSuccess
          }
        ]);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = () => {
    if (authMode === 'email') {
      if (codeSent) {
        handleVerifyCode();
      } else {
        handleEmailVerification();
      }
    } else {
      handleQuickAccess();
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const result = await authService.requestVerificationCode(email.trim());
      
      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setCodeSent(false);
    setVerificationCode('');
  };

  const getButtonText = () => {
    if (isLoading) return '';
    if (authMode === 'email') {
      return codeSent ? 'Verify Code' : 'Send Verification Code';
    } else {
      return 'Quick Access';
    }
  };

  const showEmailServiceSetup = () => {
    Alert.alert(
      'Email Service Setup Required',
      'To send real verification emails, you need to set up Resend:\n\n' +
      '1. Go to resend.com and create a free account\n' +
      '2. Get your API key from the dashboard\n' +
      '3. Configure it in the AuthService.ts file\n\n' +
      'For now, you can use Quick Access mode to test the app.',
      [
        { text: 'Switch to Quick Access', onPress: () => setAuthMode('quick') },
        { text: 'OK' }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Mobil3 NFC App</Text>
          <Text style={styles.subtitle}>Authentication Required</Text>
          
          {/* Email Service Configuration Status */}
          {authMode === 'email' && (
            <View style={[styles.statusContainer, !isEmailServiceConfigured && styles.statusWarning]}>
              <Text style={[styles.statusText, !isEmailServiceConfigured && styles.statusWarningText]}>
                {isEmailServiceConfigured ? '✅ Resend Email Service Configured' : '⚠️ Email Service Not Configured'}
              </Text>
              {!isEmailServiceConfigured && (
                <TouchableOpacity style={styles.setupButton} onPress={showEmailServiceSetup}>
                  <Text style={styles.setupButtonText}>Setup Email Service</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          <View style={styles.formContainer}>
            <Text style={styles.label}>
              {authMode === 'email' && codeSent 
                ? 'Enter verification code' 
                : 'Enter your email address'
              }
            </Text>
            <Text style={styles.description}>
              {authMode === 'email' 
                ? codeSent 
                  ? `We sent a 6-digit code to ${email}`
                  : isEmailServiceConfigured
                    ? 'We\'ll send you a real verification code to your email via Resend'
                    : 'Email service not configured. Use Quick Access or setup Resend.'
                : 'Quick access: No verification required'
              }
            </Text>
            
            {authMode === 'email' && codeSent ? (
              <TextInput
                style={styles.input}
                placeholder="123456"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isLoading}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            )}
            
            <TouchableOpacity 
              style={[
                styles.button, 
                isLoading && styles.buttonDisabled,
                authMode === 'email' && !isEmailServiceConfigured && !codeSent && styles.buttonDisabled
              ]}
              onPress={handleAuth}
              disabled={isLoading || (authMode === 'email' && !isEmailServiceConfigured && !codeSent)}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>{getButtonText()}</Text>
              )}
            </TouchableOpacity>
            
            {authMode === 'email' && codeSent && (
              <View style={styles.secondaryActions}>
                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={handleResendCode}
                  disabled={isLoading}
                >
                  <Text style={styles.secondaryButtonText}>Resend Code</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={handleBackToEmail}
                  disabled={isLoading}
                >
                  <Text style={styles.secondaryButtonText}>Change Email</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.modeToggle}
              onPress={() => {
                setAuthMode(authMode === 'email' ? 'quick' : 'email');
                setCodeSent(false);
                setVerificationCode('');
              }}
              disabled={isLoading}
            >
              <Text style={styles.modeToggleText}>
                Switch to {authMode === 'email' ? 'Quick Access' : 'Email Verification'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>
              {authMode === 'email' ? '📧 Real Email Verification' : '⚡ Quick Access Mode'}
            </Text>
            <Text style={styles.infoText}>
              {authMode === 'email' 
                ? isEmailServiceConfigured
                  ? 'Sends real verification codes to your email using Resend email service.'
                  : 'Requires Resend setup to send real emails. Use Quick Access for testing.'
                : 'Instant access without verification. Perfect for testing and development.'
              }
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    alignItems: 'center',
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
    marginBottom: 20,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  statusWarning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#155724',
    textAlign: 'center',
  },
  statusWarningText: {
    color: '#856404',
  },
  setupButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginTop: 8,
  },
  setupButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
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
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  modeToggle: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 20,
  },
  modeToggleText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  infoContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2196f3',
    maxWidth: 400,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    textAlign: 'center',
    lineHeight: 20,
  },
});

// Real authentication service for Expo/React Native
// Uses local Express backend to send real verification codes and manage user data
import { ethers } from 'ethers';

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  verificationCode: string | null;
  privateKey: string | null;
  userData: UserData | null;
  ethereumAddress: string | null;
}

interface UserData {
  email: string;
  privateKey: string;
  isFirstLogin: boolean;
  loginCount: number;
  firstLogin: string;
  lastLogin: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: any;
}

class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    email: null,
    verificationCode: null,
    privateKey: null,
    userData: null,
    ethereumAddress: null,
  };

  // Local backend configuration
  private backendUrl = 'http://192.168.100.201:3000/api';

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Derive Ethereum address from private key
  private deriveEthereumAddress(privateKey: string): string {
    try {
      // Ensure private key has 0x prefix
      const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      
      // Create wallet from private key
      const wallet = new ethers.Wallet(formattedKey);
      
      // Get the address
      const address = wallet.address;
      
      console.log(`🔗 Derived Ethereum address: ${address} from private key`);
      
      return address;
    } catch (error) {
      console.error('❌ Error deriving Ethereum address:', error);
      return 'Invalid Address';
    }
  }

  // Get short version of Ethereum address
  getShortAddress(address: string): string {
    if (!address || address === 'Invalid Address') {
      return 'Invalid Address';
    }
    
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // Send verification code using local backend
  private async sendVerificationCode(email: string): Promise<boolean> {
    try {
      console.log(`📧 Sending verification code to ${email} via local backend`);
      
      const response = await fetch(`${this.backendUrl}/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Verification code sent successfully');
        return true;
      } else {
        console.error('❌ Failed to send verification code:', result.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending verification code:', error);
      return false;
    }
  }

  // Verify code using local backend
  private async verifyCodeWithBackend(email: string, code: string): Promise<{success: boolean, data?: UserData, message: string}> {
    try {
      console.log(`🔍 Verifying code for ${email}`);
      
      const response = await fetch(`${this.backendUrl}/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Code verified successfully');
        console.log('🔑 User data received:', result.data);
        return { success: true, data: result.data, message: result.message };
      } else {
        console.error('❌ Code verification failed:', result.message);
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('❌ Error verifying code:', error);
      return { success: false, message: 'Error verifying code' };
    }
  }

  // Request verification code (sends real email)
  async requestVerificationCode(email: string): Promise<AuthResponse> {
    try {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, message: 'Please enter a valid email address' };
      }

      // Store email
      this.authState.email = email;

      // Send verification code via backend
      const emailSent = await this.sendVerificationCode(email);
      
      if (emailSent) {
        return { 
          success: true, 
          message: `Verification code sent to ${email}. Please check your email and enter the 6-digit code.` 
        };
      } else {
        return { 
          success: false, 
          message: 'Failed to send verification email. Please make sure the backend server is running.' 
        };
      }
    } catch (error) {
      console.error('Error requesting verification code:', error);
      return { success: false, message: 'An error occurred. Please try again.' };
    }
  }

  // Verify the code
  async verifyCode(code: string): Promise<AuthResponse> {
    try {
      if (!this.authState.email) {
        return { success: false, message: 'No email found. Please request a code first.' };
      }

      if (!code.trim()) {
        return { success: false, message: 'Please enter the verification code' };
      }

      // Verify code via backend
      const result = await this.verifyCodeWithBackend(this.authState.email, code.trim());
      
      if (result.success && result.data) {
        this.authState.isAuthenticated = true;
        this.authState.privateKey = result.data.privateKey;
        this.authState.userData = result.data;
        
        // Derive Ethereum address from private key
        const ethereumAddress = this.deriveEthereumAddress(result.data.privateKey);
        this.authState.ethereumAddress = ethereumAddress;
        
        const loginMessage = result.data.isFirstLogin 
          ? 'Welcome! Your account has been created with a new private key.'
          : `Welcome back! This is your ${result.data.loginCount}${this.getOrdinalSuffix(result.data.loginCount)} login.`;
        
        return { 
          success: true, 
          message: `Verification successful! ${loginMessage}`,
          data: {
            ...result.data,
            ethereumAddress: ethereumAddress,
            shortAddress: this.getShortAddress(ethereumAddress)
          }
        };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      return { success: false, message: 'An error occurred. Please try again.' };
    }
  }

  // Get ordinal suffix for numbers
  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j == 1 && k != 11) {
      return "st";
    }
    if (j == 2 && k != 12) {
      return "nd";
    }
    if (j == 3 && k != 13) {
      return "rd";
    }
    return "th";
  }

  // Quick access mode (bypasses email verification for development)
  async quickAccess(email: string): Promise<AuthResponse> {
    try {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, message: 'Please enter a valid email address' };
      }

      // Store email
      this.authState.email = email;
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Authenticate immediately
      this.authState.isAuthenticated = true;
      
      console.log(`🔓 Quick access granted for ${email}`);
      
      return { 
        success: true, 
        message: 'Quick access granted! Welcome to the app.' 
      };
    } catch (error) {
      console.error('Error with quick access:', error);
      return { success: false, message: 'An error occurred. Please try again.' };
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  // Get current email
  getEmail(): string | null {
    return this.authState.email;
  }

  // Get user's private key
  getPrivateKey(): string | null {
    return this.authState.privateKey;
  }

  // Get user's Ethereum address
  getEthereumAddress(): string | null {
    return this.authState.ethereumAddress;
  }

  // Get short version of user's Ethereum address
  getShortEthereumAddress(): string {
    return this.authState.ethereumAddress ? this.getShortAddress(this.authState.ethereumAddress) : 'No Address';
  }

  // Get user data
  getUserData(): UserData | null {
    return this.authState.userData;
  }

  // Logout
  logout(): void {
    this.authState = {
      isAuthenticated: false,
      email: null,
      verificationCode: null,
      privateKey: null,
      userData: null,
      ethereumAddress: null,
    };
    console.log('👋 User logged out');
  }

  // Get auth state (for debugging)
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  // Check if backend is configured (always true for local backend)
  isEmailJSConfigured(): boolean {
    return true;
  }

  // Check if backend is running
  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/health`);
      const result = await response.json();
      return result.status === 'OK';
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      return false;
    }
  }
}

export default AuthService;

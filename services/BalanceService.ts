import { ethers } from 'ethers';
import { MONAD_TESTNET, MONAD_TESTNET_TOKENS, Token, NATIVE_MON_ADDRESS } from '../constants/blockchain';

interface BalanceInfo {
  address: string;
  balance: string;
  balanceInEth: string;
  network: string;
  timestamp: number;
}

interface TokenBalanceInfo {
  token: Token;
  balance: string;
  balanceFormatted: string;
  symbol: string;
  decimals: number;
  address: string;
  timestamp: number;
}

class BalanceService {
  private static instance: BalanceService;
  private provider: ethers.JsonRpcProvider | null = null;

  private constructor() {
    this.initializeProvider();
  }

  static getInstance(): BalanceService {
    if (!BalanceService.instance) {
      BalanceService.instance = new BalanceService();
    }
    return BalanceService.instance;
  }

  private initializeProvider(): void {
    try {
      // Use the fastest RPC URL from our constants
      const rpcUrl = MONAD_TESTNET.getFastestRpcUrl();
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log(`🔗 Connected to Monad Testnet via: ${rpcUrl}`);
    } catch (error) {
      console.error('❌ Failed to initialize provider:', error);
      this.provider = null;
    }
  }

  // Reinitialize provider if needed
  private ensureProvider(): ethers.JsonRpcProvider | null {
    if (!this.provider) {
      this.initializeProvider();
    }
    return this.provider;
  }

  // Get MON balance for an address
  async getMonBalance(address: string): Promise<BalanceInfo | null> {
    try {
      if (!ethers.isAddress(address)) {
        console.error('❌ Invalid Ethereum address:', address);
        return null;
      }

      console.log(`🔍 Checking MON balance for address: ${address}`);
      console.log(`🌐 Network: ${MONAD_TESTNET.name} (Chain ID: ${MONAD_TESTNET.chainId})`);

      // Use the official RPC URL for better reliability
      const rpcUrl = MONAD_TESTNET.getOfficialRpcUrl();
      console.log(`🔄 Using RPC for MON balance: ${rpcUrl}`);
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Get the balance in wei
      const balanceWei = await provider.getBalance(address);
      
      // Convert to ETH (MON uses 18 decimals like ETH)
      const balanceEth = ethers.formatEther(balanceWei);
      
      const balanceInfo: BalanceInfo = {
        address: address,
        balance: balanceWei.toString(),
        balanceInEth: balanceEth,
        network: MONAD_TESTNET.name,
        timestamp: Date.now()
      };

      console.log(`💰 MON Balance: ${balanceEth} MON`);
      console.log(`🔢 Balance in Wei: ${balanceWei.toString()}`);
      console.log(`📅 Checked at: ${new Date().toISOString()}`);

      return balanceInfo;
    } catch (error) {
      console.error('❌ Error getting MON balance:', error);
      return null;
    }
  }

  // Get formatted balance string
  async getFormattedBalance(address: string): Promise<string> {
    try {
      // Try different RPC URLs if the first one fails
      const rpcUrls = MONAD_TESTNET.getHttpRpcUrls();
      
      for (const rpcUrl of rpcUrls) {
        try {
          console.log(`🔄 Trying RPC for MON balance: ${rpcUrl}`);
          this.provider = new ethers.JsonRpcProvider(rpcUrl);
          
          const balanceInfo = await this.getMonBalance(address);
          if (!balanceInfo) {
            continue; // Try next RPC
          }
          
          const balance = parseFloat(balanceInfo.balanceInEth);
          
          if (isNaN(balance)) {
            return 'Invalid balance';
          }
          
          if (balance === 0) {
            return '0 MON';
          } else if (balance < 0.000001) {
            return '< 0.000001 MON';
          } else if (balance < 0.001) {
            return `${balance.toFixed(6)} MON`;
          } else if (balance < 1) {
            return `${balance.toFixed(4)} MON`;
          } else if (balance < 1000) {
            return `${balance.toFixed(3)} MON`;
          } else if (balance < 1000000) {
            return `${balance.toFixed(2)} MON`;
          } else {
            return `${(balance / 1000000).toFixed(2)}M MON`;
          }
        } catch (error) {
          console.error(`❌ Failed with RPC ${rpcUrl}:`, error);
          continue; // Try next RPC
        }
      }
      
      return 'Error fetching balance';
    } catch (error) {
      console.error('❌ Error formatting MON balance:', error);
      return 'Error formatting balance';
    }
  }

  // Get token balance for a specific token
  async getTokenBalance(userAddress: string, tokenSymbol: string): Promise<TokenBalanceInfo | null> {
    try {
      if (!ethers.isAddress(userAddress)) {
        console.error('❌ Invalid user address:', userAddress);
        return null;
      }

      const token = MONAD_TESTNET_TOKENS.find(t => t.symbol === tokenSymbol);
      if (!token) {
        console.error(`❌ Token not found: ${tokenSymbol}`);
        return null;
      }

      // Skip MON token as it's handled separately
      if (tokenSymbol === 'MON') {
        console.log(`🔄 Skipping MON token balance check (handled separately)`);
        return null;
      }

      console.log(`🔍 Checking ${tokenSymbol} balance for address: ${userAddress}`);
      console.log(`🪙 Token contract: ${token.address}`);

      // Use the official RPC URL for better reliability
      const rpcUrl = MONAD_TESTNET.getOfficialRpcUrl();
      console.log(`🔄 Using RPC for ${tokenSymbol} balance: ${rpcUrl}`);
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // ERC-20 ABI for balanceOf function
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];

      const tokenContract = new ethers.Contract(token.address, erc20Abi, provider);
      
      // Get balance
      const balanceWei = await tokenContract.balanceOf(userAddress);
      
      // Format balance based on token decimals
      const balanceFormatted = ethers.formatUnits(balanceWei, token.decimals);
      
      const tokenBalanceInfo: TokenBalanceInfo = {
        token: token,
        balance: balanceWei.toString(),
        balanceFormatted: balanceFormatted,
        symbol: token.symbol,
        decimals: token.decimals,
        address: token.address,
        timestamp: Date.now()
      };

      console.log(`💰 ${tokenSymbol} Balance: ${balanceFormatted} ${tokenSymbol}`);
      console.log(`🔢 Balance in smallest unit: ${balanceWei.toString()}`);
      console.log(`📅 Checked at: ${new Date().toISOString()}`);

      return tokenBalanceInfo;
    } catch (error) {
      console.error(`❌ Error getting ${tokenSymbol} balance:`, error);
      return null;
    }
  }

  // Get all token balances for a user
  async getAllTokenBalances(userAddress: string): Promise<TokenBalanceInfo[]> {
    try {
      console.log(`🔍 Checking all token balances for address: ${userAddress}`);
      
      const balances: TokenBalanceInfo[] = [];
      
      // Get balances for each token individually with proper error handling
      for (const token of MONAD_TESTNET_TOKENS) {
        // Skip MON token as it's handled separately
        if (token.symbol === 'MON') {
          console.log(`🔄 Skipping MON token in getAllTokenBalances (handled separately)`);
          continue;
        }
        
        try {
          const balanceInfo = await this.getTokenBalance(userAddress, token.symbol);
          if (balanceInfo) {
            balances.push(balanceInfo);
            console.log(`✅ Got ${token.symbol} balance: ${balanceInfo.balanceFormatted}`);
          } else {
            // Add fallback balance of 0 for failed requests
            const fallbackBalance: TokenBalanceInfo = {
              token: token,
              balance: '0',
              balanceFormatted: '0',
              symbol: token.symbol,
              decimals: token.decimals,
              address: token.address,
              timestamp: Date.now()
            };
            balances.push(fallbackBalance);
            console.log(`⚠️ Using fallback balance for ${token.symbol}: 0`);
          }
        } catch (error) {
          console.error(`❌ Error getting ${token.symbol} balance:`, error);
          // Add fallback balance of 0 for failed requests
          const fallbackBalance: TokenBalanceInfo = {
            token: token,
            balance: '0',
            balanceFormatted: '0',
            symbol: token.symbol,
            decimals: token.decimals,
            address: token.address,
            timestamp: Date.now()
          };
          balances.push(fallbackBalance);
          console.log(`⚠️ Using fallback balance for ${token.symbol}: 0`);
        }
      }
      
      console.log(`✅ Retrieved ${balances.length}/${MONAD_TESTNET_TOKENS.length - 1} token balances (excluding MON)`);
      return balances;
    } catch (error) {
      console.error('❌ Error getting all token balances:', error);
      return [];
    }
  }

  // Get formatted token balance string
  async getFormattedTokenBalance(userAddress: string, tokenSymbol: string): Promise<string> {
    try {
      const balanceInfo = await this.getTokenBalance(userAddress, tokenSymbol);
      if (!balanceInfo) {
        return `Error fetching ${tokenSymbol}`;
      }
      
      const balance = parseFloat(balanceInfo.balanceFormatted);
      
      if (isNaN(balance)) {
        return `Invalid ${tokenSymbol}`;
      }
      
      if (balance === 0) {
        return `0 ${tokenSymbol}`;
      } else if (balance < 0.000001) {
        return `< 0.000001 ${tokenSymbol}`;
      } else if (balance < 0.001) {
        return `${balance.toFixed(6)} ${tokenSymbol}`;
      } else if (balance < 1) {
        return `${balance.toFixed(4)} ${tokenSymbol}`;
      } else if (balance < 1000) {
        return `${balance.toFixed(3)} ${tokenSymbol}`;
      } else if (balance < 1000000) {
        return `${balance.toFixed(2)} ${tokenSymbol}`;
      } else {
        return `${(balance / 1000000).toFixed(2)}M ${tokenSymbol}`;
      }
    } catch (error) {
      console.error(`❌ Error formatting ${tokenSymbol} balance:`, error);
      return `Error formatting ${tokenSymbol}`;
    }
  }

  // Check if provider is connected
  isProviderConnected(): boolean {
    return this.provider !== null;
  }

  // Get network info
  getNetworkInfo() {
    return {
      name: MONAD_TESTNET.name,
      chainId: MONAD_TESTNET.chainId,
      currency: MONAD_TESTNET.currency,
      rpcUrl: MONAD_TESTNET.getFastestRpcUrl()
    };
  }

  // Reinitialize provider (useful for network changes)
  reinitializeProvider(): void {
    this.initializeProvider();
  }

  // Format amount for display
  formatAmount(amount: string, decimals: number): string {
    try {
      const formatted = ethers.formatUnits(amount, decimals);
      const num = parseFloat(formatted);
      
      if (isNaN(num)) return '0';
      if (num === 0) return '0';
      if (num < 0.000001) return '< 0.000001';
      if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
      
      return num.toFixed(6).replace(/\.?0+$/, '');
    } catch (error) {
      console.error('Error formatting amount:', error);
      return '0';
    }
  }

  // Helper function to show decimal examples
  showDecimalExamples(): void {
    console.log('📊 Decimal Examples:');
    console.log('🪙 MON (Native): 1 MON = 1000000000000000000 wei (18 decimals)');
    console.log('🪙 WMON (ERC-20): 1 WMON = 1000000000000000000 wei (18 decimals)');
    console.log('🪙 USDC (ERC-20): 1 USDC = 1000000 wei (6 decimals)');
    console.log('🪙 USDT (ERC-20): 1 USDT = 1000000 wei (6 decimals)');
    console.log('🪙 WETH (ERC-20): 1 WETH = 1000000000000000000 wei (18 decimals)');
    console.log('🪙 WBTC (ERC-20): 1 WBTC = 100000000 wei (8 decimals)');
    console.log('🪙 PINGU (ERC-20): 1 PINGU = 1000000000000000000 wei (18 decimals)');
  }

  // Separate function to check native MON balance with ethers directly
  async checkNativeMonBalance(address: string): Promise<{ success: boolean; balance?: string; error?: string }> {
    try {
      console.log('🔍 [NATIVE] Checking native MON balance for address:', address);
      
      if (!ethers.isAddress(address)) {
        return { success: false, error: 'Invalid Ethereum address' };
      }

      // Use the official RPC URL
      const rpcUrl = MONAD_TESTNET.getOfficialRpcUrl();
      console.log('🔗 [NATIVE] Using RPC:', rpcUrl);
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Test network connection first
      try {
        const network = await provider.getNetwork();
        console.log('🌐 [NATIVE] Network:', network.name, 'Chain ID:', network.chainId);
        
        // Verify we're on the correct network
        if (network.chainId !== BigInt(MONAD_TESTNET.chainId)) {
          console.error('❌ [NATIVE] Wrong network! Expected:', MONAD_TESTNET.chainId, 'Got:', network.chainId);
          return { success: false, error: 'Wrong network connected' };
        }
      } catch (error) {
        console.error('❌ [NATIVE] Network connection failed:', error);
        return { success: false, error: 'Network connection failed' };
      }

      // Get the native MON balance using provider.getBalance() (not contract call)
      console.log('🪙 [NATIVE] Getting native MON balance using provider.getBalance()');
      const balanceWei = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balanceWei);
      
      console.log('💰 [NATIVE] Native MON Balance:', balanceEth, 'MON');
      console.log('🔢 [NATIVE] Balance in Wei:', balanceWei.toString());
      console.log('📊 [NATIVE] 1 MON = 1000000000000000000 wei (18 decimals)');
      
      // Show some examples for reference
      if (balanceWei > 0n) {
        const oneMonInWei = ethers.parseEther('1');
        const monAmount = balanceWei / oneMonInWei;
        console.log('📈 [NATIVE] Approximate MON amount:', monAmount.toString());
      }
      
      return { 
        success: true, 
        balance: balanceEth 
      };
      
    } catch (error) {
      console.error('❌ [NATIVE] Error getting native MON balance:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Separate function to check ERC-20 token balance with ethers directly
  async checkERC20TokenBalance(address: string, tokenSymbol: string): Promise<{ success: boolean; balance?: string; error?: string }> {
    try {
      console.log('🔍 [ERC20] Checking ERC-20 token', tokenSymbol, 'balance for address:', address);
      
      if (!ethers.isAddress(address)) {
        return { success: false, error: 'Invalid Ethereum address' };
      }

      const token = MONAD_TESTNET_TOKENS.find(t => t.symbol === tokenSymbol);
      if (!token) {
        return { success: false, error: `Token not found: ${tokenSymbol}` };
      }

      // Skip MON token as it's the native gas token, not an ERC-20
      if (tokenSymbol === 'MON') {
        return { success: false, error: 'MON is the native gas token, use checkNativeMonBalance instead' };
      }

      // Use the official RPC URL
      const rpcUrl = MONAD_TESTNET.getOfficialRpcUrl();
      console.log('🔗 [ERC20] Using RPC:', rpcUrl);
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // ERC-20 ABI for balanceOf function
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];

      console.log('🪙 [ERC20] Token contract address:', token.address);
      const tokenContract = new ethers.Contract(token.address, erc20Abi, provider);
      
      // Get ERC-20 token balance using contract call
      console.log('🪙 [ERC20] Getting ERC-20 balance using contract.balanceOf()');
      const balanceWei = await tokenContract.balanceOf(address);
      const balanceFormatted = ethers.formatUnits(balanceWei, token.decimals);
      
      console.log('💰 [ERC20]', tokenSymbol, 'Balance:', balanceFormatted, tokenSymbol);
      console.log('🔢 [ERC20] Balance in smallest unit:', balanceWei.toString());
      console.log('📊 [ERC20]', tokenSymbol, 'decimals:', token.decimals);
      
      // Show decimal examples for different tokens
      if (token.decimals === 18) {
        console.log('📈 [ERC20] 1', tokenSymbol, '= 1000000000000000000 wei (18 decimals)');
      } else if (token.decimals === 6) {
        console.log('📈 [ERC20] 1', tokenSymbol, '= 1000000 wei (6 decimals)');
      } else if (token.decimals === 8) {
        console.log('📈 [ERC20] 1', tokenSymbol, '= 100000000 wei (8 decimals)');
      }
      
      return { 
        success: true, 
        balance: balanceFormatted 
      };
      
    } catch (error) {
      console.error('❌ [ERC20] Error getting', tokenSymbol, 'balance:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export default BalanceService;

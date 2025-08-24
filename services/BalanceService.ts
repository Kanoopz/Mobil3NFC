import { ethers } from 'ethers';
import { MONAD_TESTNET, MONAD_TESTNET_TOKENS, Token } from '../constants/blockchain';

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

  // Get MON balance for an address
  async getMonBalance(address: string): Promise<BalanceInfo | null> {
    try {
      if (!this.provider) {
        console.error('❌ Provider not initialized');
        return null;
      }

      if (!ethers.isAddress(address)) {
        console.error('❌ Invalid Ethereum address:', address);
        return null;
      }

      console.log(`🔍 Checking MON balance for address: ${address}`);
      console.log(`🌐 Network: ${MONAD_TESTNET.name} (Chain ID: ${MONAD_TESTNET.chainId})`);

      // Get the balance in wei
      const balanceWei = await this.provider.getBalance(address);
      
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
      const balanceInfo = await this.getMonBalance(address);
      if (!balanceInfo) {
        return 'Error fetching balance';
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
      console.error('❌ Error formatting MON balance:', error);
      return 'Error formatting balance';
    }
  }

  // Get token balance for a specific token
  async getTokenBalance(userAddress: string, tokenSymbol: string): Promise<TokenBalanceInfo | null> {
    try {
      if (!this.provider) {
        console.error('❌ Provider not initialized');
        return null;
      }

      if (!ethers.isAddress(userAddress)) {
        console.error('❌ Invalid user address:', userAddress);
        return null;
      }

      const token = MONAD_TESTNET_TOKENS.find(t => t.symbol === tokenSymbol);
      if (!token) {
        console.error(`❌ Token not found: ${tokenSymbol}`);
        return null;
      }

      console.log(`🔍 Checking ${tokenSymbol} balance for address: ${userAddress}`);
      console.log(`🪙 Token contract: ${token.address}`);

      // ERC-20 ABI for balanceOf function
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];

      const tokenContract = new ethers.Contract(token.address, erc20Abi, this.provider);
      
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
      
      const balancePromises = MONAD_TESTNET_TOKENS.map(token => 
        this.getTokenBalance(userAddress, token.symbol)
      );
      
      const results = await Promise.allSettled(balancePromises);
      const balances: TokenBalanceInfo[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          balances.push(result.value);
        } else {
          console.error(`❌ Failed to get balance for ${MONAD_TESTNET_TOKENS[index].symbol}:`, result);
        }
      });
      
      console.log(`✅ Retrieved ${balances.length}/${MONAD_TESTNET_TOKENS.length} token balances`);
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
}

export default BalanceService;

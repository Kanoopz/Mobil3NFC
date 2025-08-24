import { ethers } from 'ethers';
import { MONAD_TESTNET } from '../constants/blockchain';

interface BalanceInfo {
  address: string;
  balance: string;
  balanceInEth: string;
  network: string;
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
    const balanceInfo = await this.getMonBalance(address);
    if (!balanceInfo) {
      return 'Error fetching balance';
    }
    
    const balance = parseFloat(balanceInfo.balanceInEth);
    
    if (balance === 0) {
      return '0 MON';
    } else if (balance < 0.001) {
      return '< 0.001 MON';
    } else if (balance < 1) {
      return `${balance.toFixed(6)} MON`;
    } else if (balance < 1000) {
      return `${balance.toFixed(4)} MON`;
    } else {
      return `${balance.toFixed(2)} MON`;
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

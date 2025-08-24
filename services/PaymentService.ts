import { ethers } from 'ethers';
import { MONAD_TESTNET, MONAD_TESTNET_TOKENS, Token } from '../constants/blockchain';

interface PaymentInfo {
  fromAddress: string;
  toAddress: string;
  amount: string;
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
}

interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  message: string;
}

// ERC-20 ABI for token transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

class PaymentService {
  private static instance: PaymentService;
  private provider: ethers.JsonRpcProvider | null = null;

  private constructor() {
    this.initializeProvider();
  }

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  private initializeProvider(): void {
    try {
      const rpcUrl = MONAD_TESTNET.getFastestRpcUrl();
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log(`🔗 Payment Service connected to Monad Testnet via: ${rpcUrl}`);
    } catch (error) {
      console.error('❌ Failed to initialize payment provider:', error);
      this.provider = null;
    }
  }

  // Send MON tokens (native token)
  async sendMonTokens(
    fromPrivateKey: string,
    toAddress: string,
    amount: string
  ): Promise<PaymentResult> {
    try {
      if (!this.provider) {
        return {
          success: false,
          error: 'Provider not initialized',
          message: 'Payment service not connected to network'
        };
      }

      if (!ethers.isAddress(toAddress)) {
        return {
          success: false,
          error: 'Invalid recipient address',
          message: 'Please provide a valid recipient address'
        };
      }

      const amountWei = ethers.parseEther(amount);
      if (amountWei <= 0n) {
        return {
          success: false,
          error: 'Invalid amount',
          message: 'Payment amount must be greater than 0'
        };
      }

      console.log(`💸 Initiating MON transfer: ${amount} MON`);
      console.log(`📤 From: ${fromPrivateKey ? 'Private key provided' : 'No private key'}`);
      console.log(`📥 To: ${toAddress}`);

      // Create wallet from private key
      const formattedKey = fromPrivateKey.startsWith('0x') ? fromPrivateKey : `0x${fromPrivateKey}`;
      const wallet = new ethers.Wallet(formattedKey, this.provider);
      
      console.log(`👤 Sender address: ${wallet.address}`);

      // Check balance
      const balance = await this.provider.getBalance(wallet.address);
      if (balance < amountWei) {
        return {
          success: false,
          error: 'Insufficient balance',
          message: `Insufficient MON balance. You have ${ethers.formatEther(balance)} MON, need ${amount} MON`
        };
      }

      // Create transaction
      const tx = {
        to: toAddress,
        value: amountWei,
        gasLimit: 21000n, // Standard ETH transfer gas limit
      };

      console.log('📝 Creating transaction...');
      
      // Send transaction
      const transaction = await wallet.sendTransaction(tx);
      const txHash = transaction.hash;
      
      console.log(`✅ Transaction sent! Hash: ${txHash}`);
      console.log('⏳ Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await transaction.wait();
      
      console.log(`🎉 Transaction confirmed! Block: ${receipt?.blockNumber}`);
      console.log(`💰 Gas used: ${receipt?.gasUsed?.toString()}`);

      return {
        success: true,
        transactionHash: txHash,
        message: `Successfully sent ${amount} MON to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`
      };

    } catch (error) {
      console.error('❌ Payment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Payment failed. Please try again.'
      };
    }
  }

  // Send ERC-20 tokens
  async sendERC20Tokens(
    fromPrivateKey: string,
    toAddress: string,
    amount: string,
    token: Token
  ): Promise<PaymentResult> {
    try {
      if (!this.provider) {
        return {
          success: false,
          error: 'Provider not initialized',
          message: 'Payment service not connected to network'
        };
      }

      if (!ethers.isAddress(toAddress)) {
        return {
          success: false,
          error: 'Invalid recipient address',
          message: 'Please provide a valid recipient address'
        };
      }

      if (!ethers.isAddress(token.address)) {
        return {
          success: false,
          error: 'Invalid token address',
          message: 'Token contract address is invalid'
        };
      }

      // Create wallet from private key
      const formattedKey = fromPrivateKey.startsWith('0x') ? fromPrivateKey : `0x${fromPrivateKey}`;
      const wallet = new ethers.Wallet(formattedKey, this.provider);
      
      console.log(`👤 Sender address: ${wallet.address}`);
      console.log(`🪙 Token: ${token.symbol} (${token.address})`);

      // Create contract instance
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);
      
      // Parse amount based on token decimals
      const amountWei = ethers.parseUnits(amount, token.decimals);
      if (amountWei <= 0n) {
        return {
          success: false,
          error: 'Invalid amount',
          message: 'Payment amount must be greater than 0'
        };
      }

      console.log(`💸 Initiating ${token.symbol} transfer: ${amount} ${token.symbol}`);
      console.log(`📤 From: ${wallet.address}`);
      console.log(`📥 To: ${toAddress}`);

      // Check token balance
      const balance = await tokenContract.balanceOf(wallet.address);
      if (balance < amountWei) {
        const formattedBalance = ethers.formatUnits(balance, token.decimals);
        return {
          success: false,
          error: 'Insufficient token balance',
          message: `Insufficient ${token.symbol} balance. You have ${formattedBalance} ${token.symbol}, need ${amount} ${token.symbol}`
        };
      }

      // Send token transfer
      const transaction = await tokenContract.transfer(toAddress, amountWei);
      const txHash = transaction.hash;
      
      console.log(`✅ ${token.symbol} transaction sent! Hash: ${txHash}`);
      console.log('⏳ Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await transaction.wait();
      
      console.log(`🎉 ${token.symbol} transaction confirmed! Block: ${receipt?.blockNumber}`);
      console.log(`💰 Gas used: ${receipt?.gasUsed?.toString()}`);

      return {
        success: true,
        transactionHash: txHash,
        message: `Successfully sent ${amount} ${token.symbol} to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`
      };

    } catch (error) {
      console.error(`❌ ${token.symbol} payment failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `${token.symbol} payment failed. Please try again.`
      };
    }
  }

  // Send any token (MON or ERC-20)
  async sendTokens(
    fromPrivateKey: string,
    toAddress: string,
    amount: string,
    token: Token
  ): Promise<PaymentResult> {
    if (token.symbol === 'MON' || token.address === '0x0000000000000000000000000000000000000000') {
      return this.sendMonTokens(fromPrivateKey, toAddress, amount);
    } else {
      return this.sendERC20Tokens(fromPrivateKey, toAddress, amount, token);
    }
  }

  // Get transaction status
  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    try {
      if (!this.provider) {
        return 'failed';
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return 'pending';
      }

      if (receipt.status === 1n) {
        return 'confirmed';
      } else {
        return 'failed';
      }
    } catch (error) {
      console.error('❌ Error checking transaction status:', error);
      return 'failed';
    }
  }

  // Get transaction details
  async getTransactionDetails(txHash: string): Promise<any> {
    try {
      if (!this.provider) {
        return null;
      }

      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!tx) {
        return null;
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value || 0n),
        gasUsed: receipt?.gasUsed?.toString(),
        blockNumber: receipt?.blockNumber?.toString(),
        status: receipt?.status === 1n ? 'confirmed' : 'failed',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Error getting transaction details:', error);
      return null;
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
}

export default PaymentService;

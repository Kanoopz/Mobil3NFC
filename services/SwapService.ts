import { ethers } from 'ethers';
import { MONAD_TESTNET_TOKENS, Token } from '../constants/blockchain';

export interface SwapQuote {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  allowanceTarget: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  estimatedGas: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  sources: any[];
  orders: any[];
  decodedUniqueId: string;
  sellAmountToEthRate: string;
  buyAmountToEthRate: string;
  blockNumber: string;
  transaction?: {
    to: string;
    data: string;
    value: string;
    gas: string;
  };
  permit2?: {
    eip712: any;
  };
}

export interface SwapPrice {
  chainId: number;
  price: string;
  grossPrice: string;
  estimatedPriceImpact: string;
  value: string;
  gas: string;
  estimatedGas: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  allowanceTarget: string;
  sellAmountToEthRate: string;
  buyAmountToEthRate: string;
  blockNumber: string;
}

export interface SwapResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  quote?: SwapQuote;
  price?: SwapPrice;
}

class SwapService {
  private static instance: SwapService;
  private provider: ethers.JsonRpcProvider;
  private readonly ZEROEX_API_KEY = '68ec2683-b9ae-4d12-97fc-0763247f133a';
  private readonly ZEROEX_BASE_URL = 'https://api.0x.org';

  private constructor() {
    this.provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
  }

  public static getInstance(): SwapService {
    if (!SwapService.instance) {
      SwapService.instance = new SwapService();
    }
    return SwapService.instance;
  }

  /**
   * Get a quote for swapping tokens
   */
  async getQuote(
    sellToken: Token,
    buyToken: Token,
    sellAmount: string,
    takerAddress: string
  ): Promise<SwapResult> {
    try {
      console.log('🔄 Getting swap quote...');
      console.log(`📤 Selling: ${sellAmount} ${sellToken.symbol}`);
      console.log(`📥 Buying: ${buyToken.symbol}`);
      console.log(`👤 Taker: ${takerAddress}`);



      // Use token addresses directly (MON now uses the correct 0x API address)
      const sellTokenAddress = sellToken.address;
      const buyTokenAddress = buyToken.address;

      const params = new URLSearchParams({
        sellToken: sellTokenAddress,
        buyToken: buyTokenAddress,
        sellAmount: sellAmount,
        takerAddress: takerAddress,
        chainId: '10143', // Monad Testnet
        skipValidation: 'false',
        enableSlippageProtection: 'false'
      });

      console.log('🌐 Making 0x API request:', `${this.ZEROEX_BASE_URL}/swap/permit2/quote?${params}`);
      
      const response = await fetch(`${this.ZEROEX_BASE_URL}/swap/permit2/quote?${params}`, {
        headers: {
          '0x-api-key': this.ZEROEX_API_KEY,
          '0x-version': 'v2',
        },
      });

      console.log('📡 0x API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 0x Quote API Error:', response.status, errorText);
        
        // Check if it's a chain not supported error
        if (response.status === 400 && errorText.includes('chain')) {
          return {
            success: false,
            error: `Monad Testnet (Chain ID 10143) is not yet supported by 0x API. Please use direct token transfers instead.`
          };
        }
        
        return {
          success: false,
          error: `0x Quote API Error: ${response.status} - ${errorText}`
        };
      }

      const quote: SwapQuote = await response.json();
      console.log('✅ Quote received:', quote);

      return {
        success: true,
        quote
      };
    } catch (error) {
      console.error('❌ Error getting quote:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }



  /**
   * Get price for swapping tokens
   */
  async getPrice(
    sellToken: Token,
    buyToken: Token,
    sellAmount: string
  ): Promise<SwapResult> {
    try {
      console.log('💰 Getting swap price...');
      console.log(`📤 Selling: ${sellAmount} ${sellToken.symbol}`);
      console.log(`📥 Buying: ${buyToken.symbol}`);

      // Use token addresses directly (MON now uses the correct 0x API address)
      const sellTokenAddress = sellToken.address;
      const buyTokenAddress = buyToken.address;

      const params = new URLSearchParams({
        sellToken: sellTokenAddress,
        buyToken: buyTokenAddress,
        sellAmount: sellAmount,
        chainId: '10143', // Monad Testnet
      });

      const response = await fetch(`${this.ZEROEX_BASE_URL}/swap/permit2/price?${params}`, {
        headers: {
          '0x-api-key': this.ZEROEX_API_KEY,
          '0x-version': 'v2',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 0x Price API Error:', response.status, errorText);
        return {
          success: false,
          error: `0x Price API Error: ${response.status} - ${errorText}`
        };
      }

      const price: SwapPrice = await response.json();
      console.log('✅ Price received:', price);

      return {
        success: true,
        price
      };
    } catch (error) {
      console.error('❌ Error getting price:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(
    privateKey: string,
    quote: SwapQuote,
    recipientAddress: string
  ): Promise<SwapResult> {
    try {
      console.log('🚀 Executing swap...');
      console.log(`📤 Selling: ${quote.sellAmount} tokens`);
      console.log(`📥 Buying: ${quote.buyAmount} tokens`);
      console.log(`👤 Recipient: ${recipientAddress}`);



      const wallet = new ethers.Wallet(privateKey, this.provider);
      
      // Prepare transaction (handle v2 API structure)
      const tx = {
        to: quote.transaction?.to || quote.to,
        data: quote.transaction?.data || quote.data,
        value: quote.transaction?.value || quote.value,
        gasLimit: ethers.parseUnits(quote.transaction?.gas || quote.estimatedGas, 'wei'),
        gasPrice: ethers.parseUnits(quote.gasPrice, 'wei'),
      };

      console.log('📝 Transaction prepared:', tx);

      // Send transaction
      const transaction = await wallet.sendTransaction(tx);
      console.log('⏳ Transaction sent:', transaction.hash);

      // Wait for confirmation
      const receipt = await transaction.wait();
      console.log('✅ Transaction confirmed:', receipt.hash);

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.error('❌ Error executing swap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }



  /**
   * Get formatted amount for display
   */
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

  /**
   * Convert amount to wei
   */
  toWei(amount: string, decimals: number): string {
    try {
      return ethers.parseUnits(amount, decimals).toString();
    } catch (error) {
      console.error('Error converting to wei:', error);
      return '0';
    }
  }
}

export default SwapService;

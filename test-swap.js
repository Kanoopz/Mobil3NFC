const { ethers } = require('ethers');

// Test configuration
const ZEROEX_API_KEY = '68ec2683-b9ae-4d12-97fc-0763247f133a';
const ZEROEX_BASE_URL = 'https://api.0x.org';

// Test tokens (using the same addresses from constants)
const MON_TOKEN = {
  symbol: 'MON',
  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  decimals: 18
};

const USDC_TOKEN = {
  symbol: 'USDC',
  address: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea',
  decimals: 6
};

const WBTC_TOKEN = {
  symbol: 'WBTC',
  address: '0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d',
  decimals: 8
};

// Test function
async function testSwapQuote() {
  console.log('🧪 Testing 0x Swap API...\n');

  // Test 1: MON to USDC
  console.log('📋 Test 1: MON → USDC');
  await testQuote(MON_TOKEN, USDC_TOKEN, '1000000000000000000'); // 1 MON

  // Test 2: USDC to WBTC
  console.log('\n📋 Test 2: USDC → WBTC');
  await testQuote(USDC_TOKEN, WBTC_TOKEN, '1000000'); // 1 USDC

  // Test 3: WBTC to MON
  console.log('\n📋 Test 3: WBTC → MON');
  await testQuote(WBTC_TOKEN, MON_TOKEN, '100000000'); // 1 WBTC
}

async function testQuote(sellToken, buyToken, sellAmount) {
  try {
    console.log(`🔄 Getting quote for ${sellAmount} ${sellToken.symbol} → ${buyToken.symbol}`);
    
    const params = new URLSearchParams({
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: sellAmount,
      takerAddress: '0x1234567890123456789012345678901234567890', // Test address
      chainId: '10143', // Monad Testnet
      skipValidation: 'false',
      enableSlippageProtection: 'false'
    });

    const url = `${ZEROEX_BASE_URL}/swap/permit2/quote?${params}`;
    console.log(`🌐 API URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        '0x-api-key': ZEROEX_API_KEY,
        '0x-version': 'v2',
      },
    });

    console.log(`📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log('✅ Quote received successfully!');
    console.log(`📤 Sell amount: ${data.sellAmount} ${sellToken.symbol}`);
    console.log(`📥 Buy amount: ${data.buyAmount} ${buyToken.symbol}`);
    console.log(`💰 Price: ${data.price}`);
    console.log(`⛽ Gas: ${data.gas}`);
    console.log(`🎯 To: ${data.transaction?.to || data.to}`);

  } catch (error) {
    console.error(`❌ Error testing quote:`, error.message);
  }
}

// Run the test
testSwapQuote().catch(console.error);

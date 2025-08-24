const { ethers } = require('ethers');

// Test configuration
const RPC_URL = 'https://testnet-rpc.monad.xyz';
const TEST_ADDRESS = '0x1234567890123456789012345678901234567890'; // Test address

// Test function for MON balance
async function testMonBalance() {
  console.log('🧪 Testing MON Balance with Ethers...\n');

  try {
    // Create provider
    console.log(`🔗 Connecting to Monad Testnet via: ${RPC_URL}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Test 1: Get network info
    console.log('\n📋 Test 1: Network Information');
    const network = await provider.getNetwork();
    console.log(`🌐 Network: ${network.name}`);
    console.log(`🔢 Chain ID: ${network.chainId}`);

    // Test 2: Get latest block
    console.log('\n📋 Test 2: Latest Block');
    const latestBlock = await provider.getBlockNumber();
    console.log(`📦 Latest block: ${latestBlock}`);

    // Test 3: Get MON balance for test address
    console.log('\n📋 Test 3: MON Balance for Test Address');
    console.log(`👤 Address: ${TEST_ADDRESS}`);
    
    const balanceWei = await provider.getBalance(TEST_ADDRESS);
    const balanceEth = ethers.formatEther(balanceWei);
    
    console.log(`💰 Balance in Wei: ${balanceWei.toString()}`);
    console.log(`💰 Balance in MON: ${balanceEth} MON`);

    // Test 4: Get MON balance for zero address (should be 0)
    console.log('\n📋 Test 4: MON Balance for Zero Address');
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    console.log(`👤 Address: ${zeroAddress}`);
    
    const zeroBalanceWei = await provider.getBalance(zeroAddress);
    const zeroBalanceEth = ethers.formatEther(zeroBalanceWei);
    
    console.log(`💰 Balance in Wei: ${zeroBalanceWei.toString()}`);
    console.log(`💰 Balance in MON: ${zeroBalanceEth} MON`);

    // Test 5: Get MON balance for a known address (if any)
    console.log('\n📋 Test 5: MON Balance for Known Address');
    const knownAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'; // Example address
    console.log(`👤 Address: ${knownAddress}`);
    
    const knownBalanceWei = await provider.getBalance(knownAddress);
    const knownBalanceEth = ethers.formatEther(knownBalanceWei);
    
    console.log(`💰 Balance in Wei: ${knownBalanceWei.toString()}`);
    console.log(`💰 Balance in MON: ${knownBalanceEth} MON`);

    console.log('\n✅ All MON balance tests completed successfully!');

  } catch (error) {
    console.error('❌ Error testing MON balance:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Test function for token balances
async function testTokenBalances() {
  console.log('\n🧪 Testing Token Balances with Ethers...\n');

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Test tokens
    const tokens = [
      {
        symbol: 'WMON',
        address: '0x760afe86e5de5fa0ee542fc7b7b713e1c5425701',
        decimals: 18
      },
      {
        symbol: 'USDC',
        address: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea',
        decimals: 6
      },
      {
        symbol: 'WETH',
        address: '0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37',
        decimals: 18
      },
      {
        symbol: 'USDT',
        address: '0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D',
        decimals: 6
      },
      {
        symbol: 'WBTC',
        address: '0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d',
        decimals: 8
      },
      {
        symbol: 'PINGU',
        address: '0xA2426cD97583939E79Cfc12aC6E9121e37D0904d',
        decimals: 18
      }
    ];

    // ERC-20 ABI for balanceOf function
    const erc20Abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ];

    for (const token of tokens) {
      console.log(`\n📋 Testing ${token.symbol} Balance`);
      console.log(`🪙 Token contract: ${token.address}`);
      
      try {
        const tokenContract = new ethers.Contract(token.address, erc20Abi, provider);
        
        // Get balance
        const balanceWei = await tokenContract.balanceOf(TEST_ADDRESS);
        const balanceFormatted = ethers.formatUnits(balanceWei, token.decimals);
        
        console.log(`💰 ${token.symbol} Balance: ${balanceFormatted} ${token.symbol}`);
        console.log(`🔢 Balance in smallest unit: ${balanceWei.toString()}`);
        
      } catch (error) {
        console.error(`❌ Error getting ${token.symbol} balance:`, error.message);
      }
    }

    console.log('\n✅ All token balance tests completed!');

  } catch (error) {
    console.error('❌ Error testing token balances:', error.message);
  }
}

// Run the tests
async function runAllTests() {
  console.log('🚀 Starting Balance Tests...\n');
  
  await testMonBalance();
  await testTokenBalances();
  
  console.log('\n🎉 All tests completed!');
}

runAllTests().catch(console.error);

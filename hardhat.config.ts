import type { HardhatUserConfig } from 'hardhat/config';
import type { NetworkUserConfig } from 'hardhat/types';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import './scripts/deploy';

dotenvConfig({ path: resolve(__dirname, './.env') });

const chainIds = {
  hardhat: 31337,
  mainnet: 1,
  gnosis: 100,
  rinkeby: 4,
};

const mnemonic: string | undefined = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error('Please set your MNEMONIC in a .env file');
}

const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error('Please set your INFURA_API_KEY in a .env file');
}

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;
  switch (chain) {
    case 'mainnet':
      jsonRpcUrl = 'https://mainnet.infura.io/v3/' + infuraApiKey;
      break;
    case 'gnosis':
      jsonRpcUrl = 'https://rpc.gnosischain.com ';
      break;
    case 'rinkeby':
      jsonRpcUrl = 'https://rinkeby.infura.io/v3/' + infuraApiKey;
      break;
    default:
      jsonRpcUrl = 'https://mainnet.infura.io/v3/' + infuraApiKey;
  }
  return {
    accounts: {
      count: 10,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[chain],
    url: jsonRpcUrl,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      gnosis: process.env.GNOSIS_API_KEY || '',
      rinkeby: process.env.ETHERSCAN_API_KEY || '',
    },
  },
  gasReporter: {
    currency: 'USD',
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: './contracts',
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    only: ['TalentLayer', 'JobRegistry'],
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
    },
    mainnet: getChainConfig('mainnet'),
    rinkeby: getChainConfig('rinkeby'),
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
    tests: './test',
  },
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.5.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
};

export default config;

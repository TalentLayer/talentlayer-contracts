import { ethers } from 'ethers'

export enum Network {
  LOCAL = 1337,
  AVALANCHE = 43114,
  FUJI = 43113,
  POLYGON = 137,
  MUMBAI = 80001,
}

export type NetworkConfig = {
  multisigAddressList: { admin?: `0x${string}`; fee: `0x${string}` }
  allowedTokenList: {
    [key: string]: {
      address: `0x${string}`
      minTransactionAmount: string
      decimals: number
    }
  }
  platformList: { [name: string]: `0x${string}` }
}

const local: NetworkConfig = {
  multisigAddressList: {
    fee: '0x3Fba71369E5E2E947AE2320274b1677de7D28120',
  },
  allowedTokenList: {
    ETH: {
      address: ethers.constants.AddressZero,
      minTransactionAmount: '0.001',
      decimals: 18,
    },
  },
  platformList: {
    hirevibes: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    workpod: '0x4444F618BA8E99435E721abF3c611D5105A407e9',
    indie: '0x8d960334c2EF30f425b395C1506Ef7c5783789F3',
  },
}

const fuji: NetworkConfig = {
  multisigAddressList: {
    fee: '0x_TODO_CREATE_MULTISIG',
  },
  allowedTokenList: {
    AVAX: {
      address: ethers.constants.AddressZero,
      minTransactionAmount: '0.1',
      decimals: 18,
    },
    USDC: {
      address: '0xAF82969ECF299c1f1Bb5e1D12dDAcc9027431160',
      minTransactionAmount: '1',
      decimals: 6,
    },
  },
  platformList: {
    hirevibes: '0x96573C632c88996711de69389b501F4D9005Ff4e',
    indie: '0x8d960334c2EF30f425b395C1506Ef7c5783789F3',
  },
}

const mumbai: NetworkConfig = {
  multisigAddressList: {
    fee: '0xfBF3D68b1750032BDDa47D555D68143CfBB43EbC',
    admin: '0x99f117069F9ED15476003502AD8D96107A180648',
  },
  allowedTokenList: {
    MATIC: {
      address: ethers.constants.AddressZero,
      minTransactionAmount: '1',
      decimals: 18,
    },
    USDC: {
      address: '0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747',
      minTransactionAmount: '1',
      decimals: 6,
    },
  },
  platformList: {
    hirevibes: '0x96573C632c88996711de69389b501F4D9005Ff4e',
    workpod: '0x4444F618BA8E99435E721abF3c611D5105A407e9',
    scalesecurity: '0xD0C5A5C281cE5f8A0016F310Bd428111b44159A0',
    indie: '0x8d960334c2EF30f425b395C1506Ef7c5783789F3',
    orb_ac: '0xB718b58F83a5011588c9e3674f9029E26339a90F',
    workx: '0x0000004DeFbb2ABe972E964f19A7615D6c80e574',
  },
}

const avalanche = {} as NetworkConfig
const polygon: NetworkConfig = {
  multisigAddressList: {
    fee: '0x33B424f8aFF0d2a406f1E7386f1ff64aCacC62fe',
    admin: '0x0CFF3F17b62704A0fc76539dED9223a44CAf4825',
  },
  allowedTokenList: {
    MATIC: {
      address: ethers.constants.AddressZero,
      minTransactionAmount: '10',
      decimals: 18,
    },
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      minTransactionAmount: '10',
      decimals: 6,
    },
    WETH: {
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      minTransactionAmount: '0.005',
      decimals: 18,
    },
  },
  platformList: {},
}

export const configs: { [networkId in Network]: NetworkConfig } = {
  [Network.LOCAL]: local,
  [Network.AVALANCHE]: avalanche,
  [Network.FUJI]: fuji,
  [Network.POLYGON]: polygon,
  [Network.MUMBAI]: mumbai,
}

export const getConfig = (networkId: Network): NetworkConfig => {
  return configs[networkId]
}

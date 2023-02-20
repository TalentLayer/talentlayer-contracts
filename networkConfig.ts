import { ethers } from 'ethers'

export enum Network {
  LOCAL = 1337,
  AVALANCHE = 43114,
  FUJI = 43113,
  POLYGON = 137,
  MUMBAI = 80001,
}

export type NetworkConfig = {
  multisigAddressList: { deployer?: `0x${string}`; fee: `0x${string}` }
  allowedTokenList: {
    [key: string]: {
      address: `0x${string}`
      mintransactionamount: string
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
      mintransactionamount: '0.001',
      decimals: 18,
    },
  },
  platformList: {
    hirevibes: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    workpod: '0x4444F618BA8E99435E721abF3c611D5105A407e9',
  },
}

const fuji: NetworkConfig = {
  multisigAddressList: {
    fee: '0x_TODO_CREATE_MULTISIG',
  },
  allowedTokenList: {
    AVAX: {
      address: ethers.constants.AddressZero,
      mintransactionamount: '0.001',
      decimals: 18,
    },
    USDC: {
      address: '0x_TODO_CREATE_USDC',
      mintransactionamount: '1',
      decimals: 6,
    },
  },
  platformList: {
    hirevibes: '0x96573C632c88996711de69389b501F4D9005Ff4e',
  },
}

const mumbai: NetworkConfig = {
  multisigAddressList: {
    fee: '0x3Fba71369E5E2E947AE2320274b1677de7D28120',
    deployer: '0x99f117069F9ED15476003502AD8D96107A180648',
  },
  allowedTokenList: {
    MATIC: {
      address: ethers.constants.AddressZero,
      mintransactionamount: '1',
      decimals: 18,
    },
    USDC: {
      address: '0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747',
      mintransactionamount: '1',
      decimals: 6,
    },
  },
  platformList: {
    hirevibes: '0x96573C632c88996711de69389b501F4D9005Ff4e',
    workpod: '0x4444F618BA8E99435E721abF3c611D5105A407e9',
  },
}

const avalanche = {} as NetworkConfig
const polygon = {} as NetworkConfig

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

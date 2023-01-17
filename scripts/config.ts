export enum Network {
  LOCAL = 1337,
  MAINNET = 1,
  GNOSIS = 100,
  KOVAN = 42,
  GOERLI = 5,
  AVALANCHE = 43114,
  FUJI = 43113,
  MUMBAI = 80001,
}

export type NetworkConfig = {
  proofOfHumanityAddress: string
}

const kovan: NetworkConfig = {
  proofOfHumanityAddress: '0x73BCCE92806BCe146102C44c4D9c3b9b9D745794',
}

const local = {} as NetworkConfig
const mainnet = {} as NetworkConfig
const gnosis = {} as NetworkConfig
const goerli = {} as NetworkConfig
const avalanche = {} as NetworkConfig
const fuji = {} as NetworkConfig
const mumbai = {} as NetworkConfig

export const configs: { [networkId in Network]: NetworkConfig } = {
  [Network.LOCAL]: local,
  [Network.MAINNET]: mainnet,
  [Network.GNOSIS]: gnosis,
  [Network.KOVAN]: kovan,
  [Network.GOERLI]: goerli,
  [Network.AVALANCHE]: avalanche,
  [Network.FUJI]: fuji,
  [Network.MUMBAI]: mumbai,
}

export const getConfig = (networkId: Network): NetworkConfig => {
  return configs[networkId]
}

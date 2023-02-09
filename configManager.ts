import * as fs from 'fs'

export enum ConfigProperty {
  MockProofOfHumanity = 'proofOfHumanityAddress',
  TalentLayerID = 'talentLayerIdAddress',
  ServiceRegistry = 'serviceRegistryAddress',
  Reviewscontract = 'talentLayerReviewAddress',
  TalentLayerArbitrator = 'talentLayerArbitratorAddress',
  TalentLayerEscrow = 'talentLayerEscrowAddress',
  SimpleERC20 = 'simpleERC20Address',
  TalentLayerPlatformID = 'talentLayerPlatformIdAddress',
}

const loadJSON = (network: string) => {
  const filename = getFilename(network)
  return fs.existsSync(filename) ? fs.readFileSync(filename).toString() : '{}'
}

const saveJSON = (network: string, json = '') => {
  const filename = getFilename(network)
  return fs.writeFileSync(filename, JSON.stringify(json, null, 2))
}

export const get = (network: string, property: ConfigProperty) => {
  const obj = JSON.parse(loadJSON(network))
  return obj[property] || 'Not found'
}

export const getConfig = (network: string) => {
  const obj = JSON.parse(loadJSON(network))
  return obj || 'Not found'
}

export const set = (network: string, property: ConfigProperty, value: string) => {
  const obj = JSON.parse(loadJSON(network) || '{}')
  obj[property] = value
  saveJSON(network, obj)
}

export const remove = (network: string, property: ConfigProperty) => {
  const obj = JSON.parse(loadJSON(network) || '{}')
  delete obj[property]
  saveJSON(network, obj)
}

const getFilename = (network: string) => `${__dirname}/deployment.config_${network}.json`

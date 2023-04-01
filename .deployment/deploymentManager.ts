import * as fs from 'fs'

export enum DeploymentProperty {
  TalentLayerID = 'talentLayerIdAddress',
  TalentLayerService = 'talentLayerServiceAddress',
  TalentLayerReview = 'talentLayerReviewAddress',
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

export const getDeploymentProperty = (network: string, property: DeploymentProperty) => {
  const obj = JSON.parse(loadJSON(network))
  return obj[property] || 'Not found'
}

export const getDeploymennt = (network: string) => {
  const obj = JSON.parse(loadJSON(network))
  return obj || 'Not found'
}

export const setDeploymentProperty = (
  network: string,
  property: DeploymentProperty,
  value: string,
) => {
  const obj = JSON.parse(loadJSON(network) || '{}')
  obj[property] = value
  saveJSON(network, obj)
}

export const removeDeploymentProperty = (network: string, property: DeploymentProperty) => {
  const obj = JSON.parse(loadJSON(network) || '{}')
  delete obj[property]
  saveJSON(network, obj)
}

const getFilename = (network: string) => `${__dirname}/${network}.json`

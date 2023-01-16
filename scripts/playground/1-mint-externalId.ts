import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

async function main() {
  const network = await hre.network.name
  console.log(network)
  console.log('Mint with external ID test start')

  const [alice, bob, carol, dave, eve, frank] = await ethers.getSigners()

  const strategiesID = [0]
  console.log('strategiesID', strategiesID)

  const talentLayerIdContract = await ethers.getContractAt(
    'TalentLayerID',
    get(network as Network, ConfigProperty.TalentLayerID),
  )

  const mockLensHub = await ethers.getContractAt('MockLensHub', get(network as Network, ConfigProperty.MockLensHub))

  await mockLensHub.addLensProfileManually([
    alice.address,
    bob.address,
    carol.address,
    dave.address,
    eve.address,
    frank.address,
  ])

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  // We get the platform ID of Dave
  const daveTalentLayerIdPLatform = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  console.log('Dave talentLayerIdPLatform', daveTalentLayerIdPLatform)

  const getStrategyId = await talentLayerIdContract.getStrategy(strategiesID[0])
  console.log('getStrategyId', getStrategyId)

  await talentLayerIdContract.connect(frank).mintWithExternalIDs(daveTalentLayerIdPLatform, 'frank', strategiesID)

  const frankUserId = await talentLayerIdContract.walletOfOwner(frank.address)
  console.log('frankUserId', frankUserId)
  const externalId = await talentLayerIdContract.getExternalId(frankUserId, strategiesID[0])
  console.log('externalId', externalId)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

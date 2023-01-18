import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

async function main() {
  const network = await hre.network.name
  console.log(network)
  console.log('Mint with external ID test start')

  const [alice, bob, carol, dave, eve, frank] = await ethers.getSigners()

  const strategiesID = [0, 1]
  console.log('strategiesID', strategiesID)

  const talentLayerIdContract = await ethers.getContractAt(
    'TalentLayerID',
    get(network as Network, ConfigProperty.TalentLayerID),
  )

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  const mockLensHub = await ethers.getContractAt('MockLensHub', get(network as Network, ConfigProperty.MockLensHub))

  const mockProofOfHumanity = await ethers.getContractAt(
    'MockProofOfHumanity',
    get(network as Network, ConfigProperty.MockProofOfHumanity),
  )

  // add user to strategies
  await mockProofOfHumanity.addSubmissionManually([
    alice.address,
    bob.address,
    carol.address,
    dave.address,
    eve.address,
    frank.address,
  ])

  await mockLensHub.addLensProfileManually([
    alice.address,
    bob.address,
    carol.address,
    dave.address,
    eve.address,
    frank.address,
  ])

  // We get the platform ID of Dave
  const daveTalentLayerIdPLatform = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  console.log('Dave talentLayerIdPLatform', daveTalentLayerIdPLatform)

  await talentLayerIdContract.connect(frank).mint(daveTalentLayerIdPLatform, 'frank', strategiesID)

  const frankUserId = await talentLayerIdContract.walletOfOwner(frank.address)
  console.log('frankUserId', frankUserId)

  const thirdPartyIdIndexZero = await talentLayerIdContract.getThirdPartyId(frankUserId, 0)
  console.log('thirdPartyIdIndexZero', thirdPartyIdIndexZero)

  const thirdPartyIdIndexOne = await talentLayerIdContract.getThirdPartyId(frankUserId, 1)
  console.log('thirdPartyIdIndexOne', thirdPartyIdIndexOne)

  // frank address
  console.log('frank address', frank.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

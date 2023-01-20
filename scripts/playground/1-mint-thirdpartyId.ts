import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { lens } from '../../typechain-types/factories/contracts/ThirdParties'
import { Network } from '../config'
const hre = require('hardhat')

async function main() {
  const network = await hre.network.name
  console.log(network)
  console.log('Mint with external ID test start')

  const [alice, bob, carol, dave, eve, frank] = await ethers.getSigners()

  const talentLayerIdContract = await ethers.getContractAt(
    'TalentLayerID',
    get(network as Network, ConfigProperty.TalentLayerID),
  )

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  const mockLensHub = await ethers.getContractAt('MockLensHub', get(network as Network, ConfigProperty.MockLensHub))

  const lensID = await ethers.getContractAt('LensID', get(network as Network, ConfigProperty.LensID))

  const mockProofOfHumanity = await ethers.getContractAt(
    'MockProofOfHumanity',
    get(network as Network, ConfigProperty.MockProofOfHumanity),
  )

  const proofOfHumanityID = await ethers.getContractAt(
    'ProofOfHumanityID',
    get(network as Network, ConfigProperty.ProofOfHumanityID),
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
    alice.address, // WARNING array submission start at 1 Alice won't be registered
    bob.address,
    carol.address,
    dave.address,
    eve.address,
    frank.address,
  ])

  // We check if bob is Registerd on ProofOfHumanity and Lens
  const bobIsRegisteredOnProofOfHumanity = await proofOfHumanityID.isRegistered(bob.address)
  console.log('Bob Is Registered On ProofOfHumanity', bobIsRegisteredOnProofOfHumanity)

  const bobIsRegisteredOnLens = await lensID.isRegistered(bob.address)
  console.log('Bob Is Registered On Lens', bobIsRegisteredOnLens)

  // we check if carol is Registerd on ProofOfHumanity
  const carolIsRegisteredOnProofOfHumanity = await proofOfHumanityID.isRegistered(carol.address)
  console.log('carol Is Registered On ProofOfHumanity', carolIsRegisteredOnProofOfHumanity)

  // we check that eve is well registerd on Lens
  const eveIsRegisteredOnLens = await lensID.isRegistered(eve.address)
  console.log('eve Is Registered On Lens', eveIsRegisteredOnLens)

  // We get the platform ID of Dave
  const daveTalentLayerIdPLatform = await platformIdContrat.getPlatformIdFromAddress(dave.address)

  await talentLayerIdContract.connect(bob).mint(daveTalentLayerIdPLatform, 'Bob', [0, 1])
  await talentLayerIdContract.connect(carol).mint(daveTalentLayerIdPLatform, 'Carol', [0])
  await talentLayerIdContract.connect(eve).mint(daveTalentLayerIdPLatform, 'Eve', [1])

  // A few checks
  const bobUserId = await talentLayerIdContract.walletOfOwner(bob.address)
  console.log('frankUserId', bobUserId)

  const frankPohId = await talentLayerIdContract.getThirdPartyId(bobUserId, 0)
  console.log('Bob poh Id', frankPohId)

  const frankLensId = await talentLayerIdContract.getThirdPartyId(bobUserId, 1)
  console.log('Bob Lens Id', frankLensId)

  // frank address
  console.log('bob address', bob.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

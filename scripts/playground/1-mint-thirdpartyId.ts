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

  // We check if bob is Registered on ProofOfHumanity and Lens
  const bobIsRegisteredOnProofOfHumanity = await proofOfHumanityID.isRegistered(bob.address)
  console.log('Bob Is Registered On ProofOfHumanity', bobIsRegisteredOnProofOfHumanity)

  const bobIsRegisteredOnLens = await lensID.isRegistered(bob.address)
  console.log('Bob Is Registered On Lens', bobIsRegisteredOnLens)

  // we check if carol is Registered on ProofOfHumanity
  const carolIsRegisteredOnProofOfHumanity = await proofOfHumanityID.isRegistered(carol.address)
  console.log('carol Is Registered On ProofOfHumanity', carolIsRegisteredOnProofOfHumanity)

  // We get the platform ID of Dave
  const daveTalentLayerIdPLatform = await platformIdContrat.getPlatformIdFromAddress(dave.address)

  // Alice can mint a Talent Layer Id without strategy
  await talentLayerIdContract.connect(alice).mint(daveTalentLayerIdPLatform, 'Alice', [])
  console.log('Alice is not registered on Lens or Poh')

  // Bob can mint a Talent Layer Id with strategy ProofOfHumanity and Lens
  await talentLayerIdContract.connect(bob).mint(daveTalentLayerIdPLatform, 'Bob', [0, 1])
  console.log('Bob is registered on Lens and Poh')
  // Carol can mint a Talent Layer Id with strategy ProofOfHumanity
  await talentLayerIdContract.connect(carol).mint(daveTalentLayerIdPLatform, 'Carol', [0])
  console.log('carol is registered on POh')

  // Dave can mint a Talent Layer Id
  // ------ 1 : without strategy
  await talentLayerIdContract.connect(dave).mint(daveTalentLayerIdPLatform, 'Dave', [])
  console.log('Dave minted without third party Id')
  // ------ 2 : we link his Talent Layer Id to his Lens Id
  const DaveUserId = await talentLayerIdContract.walletOfOwner(dave.address)
  console.log('Dave Talent Layer Id', DaveUserId)
  await talentLayerIdContract.connect(dave).associateThirdPartiesIDs(DaveUserId, [1])
  console.log('Dave linked his Talent Layer Id to his Lens Id after the minting')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

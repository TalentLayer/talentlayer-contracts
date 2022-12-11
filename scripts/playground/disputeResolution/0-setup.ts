import { ethers } from 'hardhat'
import { ConfigProperty, get } from '../../../configManager'
import { Network } from '../../config'
import { arbitrationCost, arbitrationFeeTimeout, arbitratorExtraData, transactionAmount } from './constants'

const hre = require('hardhat')

const carolPlatformId = 1
const serviceId = 1
const ethAddress = '0x0000000000000000000000000000000000000000'

/*
This script sets up the context for dispute resolution, specifically it does the following:
- Sets the arbitration cost on the arbitrator
- Mints platform id for Carol
- Mints TL Ids for Alice and Bob
- Alice initiates an open service
- Bob submits a proposal for the open service
- Alice accepts the proposal by creating a transaction
*/
async function main() {
  const network = await hre.network.name
  console.log('Network: ', network)

  const [deployer, alice, bob, carol] = await ethers.getSigners()

  // ----------------- Deploy -----------------

  const talentLayerID = await ethers.getContractAt(
    'TalentLayerID',
    get(network as Network, ConfigProperty.TalentLayerID),
  )

  const talentLayerPlatformID = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    get(network as Network, ConfigProperty.TalentLayerEscrow),
  )

  const talentLayerArbitrator = await ethers.getContractAt(
    'TalentLayerArbitrator',
    get(network as Network, ConfigProperty.TalentLayerArbitrator),
  )

  // Set arbitration cost on arbitrator
  await talentLayerArbitrator.connect(deployer).setArbitrationPrice(arbitrationCost)

  // Grant Platform Id Mint role to Deployer and Bob
  const mintRole = await talentLayerPlatformID.MINT_ROLE()
  await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)
  console.log('Minted platform id for Carol')

  // Update platform arbitrator, extra data and fee timeout
  await talentLayerPlatformID.connect(carol).updateArbitrator(carolPlatformId, talentLayerArbitrator.address)
  await talentLayerPlatformID.connect(carol).updateArbitratorExtraData(carolPlatformId, arbitratorExtraData)
  await talentLayerPlatformID.connect(carol).updateArbitrationFeeTimeout(carolPlatformId, arbitrationFeeTimeout)

  // Mint TL Id for Alice and Bob
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob')
  console.log('Minted TL Id for Alice')
  console.log('Minted TL Id for Bob')

  // Alice, the buyer, initiates a new open service
  await serviceRegistry.connect(alice).createOpenServiceFromBuyer(carolPlatformId, 'cid')
  console.log('Open service created by Alice')

  // Bob, the seller, creates a proposal for the service
  await serviceRegistry.connect(bob).createProposal(serviceId, ethAddress, transactionAmount, 'cid')
  console.log('Proposal for service created by Bob')

  // Create transaction
  const proposalId = 2
  const metaEvidence = 'metaEvidence'
  const feeDivider = 10000
  const protocolFee = await talentLayerEscrow.protocolFee()
  const originPlatformFee = await talentLayerEscrow.originPlatformFee()
  const platformFee = (await talentLayerPlatformID.platforms(carolPlatformId)).fee
  const totalTransactionAmount = transactionAmount.add(
    transactionAmount.mul(protocolFee + originPlatformFee + platformFee).div(feeDivider),
  )
  await talentLayerEscrow.connect(alice).createETHTransaction(metaEvidence, serviceId, proposalId, {
    value: totalTransactionAmount,
  })
  console.log('Proposal accepted by Alice with transaction')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

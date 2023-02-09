import { ethers } from 'hardhat'
import { ConfigProperty, get } from '../../../configManager'
import { Network } from '../../utils/config'
import postToIPFS from '../../utils/ipfs'
import {
  arbitrationCost,
  arbitrationFeeTimeout,
  arbitratorExtraData,
  transactionAmount,
} from './constants'

import hre = require('hardhat')

const carolPlatformId = 1
const serviceId = 1
const ethAddress = '0x0000000000000000000000000000000000000000'

/*
This script sets up the context for dispute resolution, specifically it does the following:
- Sets the arbitration cost on the arbitrator
- Adds the arbitrator to the platform available arbitrators
- Mints platform id for Carol, sets arbitrator and fee timeout, and updates arbitration cost
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

  // Grant Platform Id Mint role to Deployer and Bob
  const mintRole = await talentLayerPlatformID.MINT_ROLE()
  await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)
  console.log('Minted platform id for Carol')

  // Add arbitrator to platform available arbitrators
  await talentLayerPlatformID.connect(deployer).addArbitrator(talentLayerArbitrator.address, true)

  // Update platform arbitrator and fee timeout
  await talentLayerPlatformID
    .connect(carol)
    .updateArbitrator(carolPlatformId, talentLayerArbitrator.address, [])
  await talentLayerPlatformID
    .connect(carol)
    .updateArbitrationFeeTimeout(carolPlatformId, arbitrationFeeTimeout)

  // Update arbitration cost
  await talentLayerArbitrator.connect(carol).setArbitrationPrice(carolPlatformId, arbitrationCost)

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

  // Upload meta evidence to IPFS
  const metaEvidence = await postToIPFS(
    JSON.stringify({
      fileURI: '/ipfs/QmUQMJbfiQYX7k6SWt8xMpR7g4vwtAYY1BTeJ8UY8JWRs9',
      fileHash: 'QmUQMJbfiQYX7k6SWt8xMpR7g4vwtAYY1BTeJ8UY8JWRs9',
      fileTypeExtension: 'pdf',
      category: 'Escrow',
      title: 'Bob builds a website for Alice',
      description:
        'Bob is hired by Alice as a contractor to create a website for his company. When completed, the site will be hosted at https://my-site.com.',
      aliases: {
        [alice.address]: 'Alice',
        [bob.address]: 'Bob',
      },
      question: 'Is the website compliant with the terms of the contract?',
      rulingOptions: {
        type: 'single-select',
        titles: ['No', 'Yes'],
        descriptions: [
          'The website is not compliant. This will refund Alice.',
          'The website is compliant. This will release the funds to Bob.',
        ],
      },
    }),
  )

  // Create transaction
  const proposalId = 2
  const feeDivider = 10000
  const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
  const originPlatformEscrowFeeRate = await talentLayerEscrow.originPlatformEscrowFeeRate()
  const platformEscrowFeeRate = (await talentLayerPlatformID.platforms(carolPlatformId)).fee
  const totalTransactionAmount = transactionAmount.add(
    transactionAmount
      .mul(protocolEscrowFeeRate + originPlatformEscrowFeeRate + platformEscrowFeeRate)
      .div(feeDivider),
  )
  await talentLayerEscrow.connect(alice).createETHTransaction(metaEvidence, serviceId, proposalId, {
    value: totalTransactionAmount,
  })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

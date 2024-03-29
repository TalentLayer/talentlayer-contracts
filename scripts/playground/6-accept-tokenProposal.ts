import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import { waitConfirmations } from '../utils/waitConfirmations'
import hre = require('hardhat')
import { metaEvidenceCid } from './constants'

/*
In this script Alice will accept Dave's proposal with Token transaction
*/

// Alice accept the Carol proposal
async function main() {
  const network = hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const talentLayerService = await ethers.getContractAt(
    'TalentLayerService',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerService),
  )

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerEscrow),
  )

  const platformIdContract = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  const talentLayerArbitrator = await ethers.getContractAt(
    'TalentLayerArbitrator',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerArbitrator),
  )

  const token = await ethers.getContractAt(
    'SimpleERC20',
    getDeploymentProperty(network, DeploymentProperty.SimpleERC20),
  )

  const amountDave = ethers.utils.parseUnits('0.03', 18)
  console.log('amountBob', amountDave.toString())

  // Accepting Proposal #4 from Dave: for Alice's service #2
  // OriginService platform: Dave's platform #1
  // OriginService platform: Bob's platform #2

  const daveTlPId = await platformIdContract.ids(dave.address)
  const bobTlPId = await platformIdContract.ids(bob.address)

  //Protocol fee
  const protocolEscrowFeeRate = ethers.BigNumber.from(
    await talentLayerEscrow.protocolEscrowFeeRate(),
  )
  console.log('protocolEscrowFeeRate', protocolEscrowFeeRate.toString())

  //Origin platform fee && platform fee
  const davePlatformData = await platformIdContract.platforms(daveTlPId)
  const bobPlatformData = await platformIdContract.platforms(bobTlPId)
  const originServiceFeeRate = ethers.BigNumber.from(davePlatformData.originServiceFeeRate)
  const originValidatedProposalFeeRate = ethers.BigNumber.from(
    bobPlatformData.originValidatedProposalFeeRate,
  )

  console.log('originServiceFeeRate', originServiceFeeRate.toString())
  console.log('originValidatedProposalFeeRate', originValidatedProposalFeeRate.toString())

  const totalAmount = amountDave.add(
    amountDave
      .mul(protocolEscrowFeeRate.add(originServiceFeeRate).add(originValidatedProposalFeeRate))
      .div(ethers.BigNumber.from(10000)),
  )
  console.log('totalAmount', totalAmount.toString())

  // we allow the contract to spend Alice tokens with the bob rateAmount + fees
  const approve = await token.approve(talentLayerEscrow.address, totalAmount)
  await waitConfirmations(network, approve, 10)

  let secondServiceId = await talentLayerService.nextServiceId()
  secondServiceId = secondServiceId.sub(1)
  console.log('serviceId', secondServiceId.toString())

  // we need to retreive the Bob proposal dataUri
  const proposal = await talentLayerService.proposals(secondServiceId, 4)

  await talentLayerEscrow.connect(alice).createTransaction(
    secondServiceId,
    4, //proposalId/talentLayerId of Dave.
    metaEvidenceCid,
    proposal.dataUri,
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

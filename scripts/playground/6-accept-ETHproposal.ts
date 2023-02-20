import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import hre = require('hardhat')

/*
In this script Alice will accept Carol's proposal with an ETH transaction
We need to add to the rateAmount the protocolEscrowFeeRate, originPlatformEscrowFeeRate and platformEscrowFeeRate
First Dave will update his platformEscrowFeeRate to 11% then we get the plateFormFee from TalentLayerPlatformID
and the protocolEscrowFeeRate and originPlatformEscrowFeeRate from TalentLayerEscrow
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

  const nextServiceId = await talentLayerService.nextServiceId()
  const firstServiceId = nextServiceId.sub(2) // service id #1
  console.log('serviceId', firstServiceId.toString())

  // Accepting Proposal #3 from Carol: for Alice's service #1
  // OriginService platform: Dave's platform #1
  // OriginService platform: Bob's platform #2
  const rateAmount = ethers.utils.parseUnits('0.002', 18)
  const daveTlPId = await platformIdContract.ids(dave.address)
  const bobTlPId = await platformIdContract.ids(bob.address)

  const davePlatformData = await platformIdContract.platforms(daveTlPId)
  const bobPlatformData = await platformIdContract.platforms(bobTlPId)
  const protocolEscrowFeeRate = ethers.BigNumber.from(
    await talentLayerEscrow.protocolEscrowFeeRate(),
  )
  const originServiceFeeRate = ethers.BigNumber.from(davePlatformData.originServiceFeeRate)
  const originValidatedProposalFeeRate = ethers.BigNumber.from(
    bobPlatformData.originValidatedProposalFeeRate,
  )

  console.log('protocolEscrowFeeRate', protocolEscrowFeeRate.toString())
  console.log('originServiceFeeRate', originServiceFeeRate.toString())
  console.log('originValidatedProposalFeeRate', originValidatedProposalFeeRate.toString())

  const totalAmount = rateAmount.add(
    rateAmount
      .mul(protocolEscrowFeeRate.add(originServiceFeeRate).add(originValidatedProposalFeeRate))
      .div(ethers.BigNumber.from(10000)),
  )
  console.log('totalAmount', totalAmount.toString())

  // we need to retreive the carol proposal dataUri
  const proposal = await talentLayerService.proposals(firstServiceId, 3)

  await talentLayerEscrow.connect(alice).createETHTransaction(
    firstServiceId,
    3, //proposalId/talentLayerId of carol.
    '_metaEvidence',
    proposal.dataUri,
    { value: totalAmount },
  )
  console.log('ETH transaction created')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

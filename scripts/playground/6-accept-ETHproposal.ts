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
  const network = await hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    getDeploymentProperty(network, DeploymentProperty.ServiceRegistry),
  )

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerEscrow),
  )

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  const talentLayerArbitrator = await ethers.getContractAt(
    'TalentLayerArbitrator',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerArbitrator),
  )

  const nextServiceId = await serviceRegistry.nextServiceId()
  const firstServiceId = nextServiceId.sub(2) // service id #1
  console.log('serviceId', firstServiceId.toString())

  const rateAmount = ethers.utils.parseUnits('0.002', 18)
  const daveTlId = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  const updatePlatformEscrowFeeRate = await platformIdContrat
    .connect(dave)
    .updatePlatformEscrowFeeRate(daveTlId, 1100)
  await updatePlatformEscrowFeeRate.wait()

  const davePlatformData = await platformIdContrat.platforms(daveTlId)
  const protocolEscrowFeeRate = ethers.BigNumber.from(
    await talentLayerEscrow.protocolEscrowFeeRate(),
  )
  const originPlatformEscrowFeeRate = ethers.BigNumber.from(
    await talentLayerEscrow.originPlatformEscrowFeeRate(),
  )
  const platformEscrowFeeRate = ethers.BigNumber.from(davePlatformData.fee)

  const totalAmount = rateAmount.add(
    rateAmount
      .mul(protocolEscrowFeeRate.add(originPlatformEscrowFeeRate).add(platformEscrowFeeRate))
      .div(ethers.BigNumber.from(10000)),
  )
  console.log('totalAmount', totalAmount.toString())

  await talentLayerEscrow.connect(alice).createETHTransaction(
    '_metaEvidence',
    firstServiceId,
    3, //proposalId/talentLayerId of carol.
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

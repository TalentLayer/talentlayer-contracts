import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

/*
In this script Alice will accept Carol's proposal with an ETH transaction
We need to add to the rateAmount the protocolFee, originPlatformFee and platformFee
First Dave will update his platformFee to 11% then we get the plateFormFee from TalentLayerPlatformID
and the protocolFee and originPlatformFee from TalentLayerEscrow
*/

// Alice accept the Carol proposal
async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    get(network as Network, ConfigProperty.TalentLayerEscrow),
  )

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  const talentLayerArbitrator = await ethers.getContractAt(
    'TalentLayerArbitrator',
    get(network as Network, ConfigProperty.TalentLayerArbitrator),
  )

  let nextServiceId = await serviceRegistry.nextServiceId()
  let firstServiceId = nextServiceId.sub(2) // service id #1
  console.log('serviceId', firstServiceId.toString())

  const rateAmount = ethers.utils.parseUnits('0.002', 18)
  const daveTlId = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  const updatePlatformfee = await platformIdContrat.connect(dave).updatePlatformfee(daveTlId, 1100)
  updatePlatformfee.wait()

  const davePlatformData = await platformIdContrat.platforms(daveTlId)
  const protocolFee = ethers.BigNumber.from(await talentLayerEscrow.protocolFee())
  const originPlatformFee = ethers.BigNumber.from(await talentLayerEscrow.originPlatformFee())
  const platformFee = ethers.BigNumber.from(davePlatformData.fee)

  const totalAmount = rateAmount.add(
    rateAmount.mul(protocolFee.add(originPlatformFee).add(platformFee)).div(ethers.BigNumber.from(10000)),
  )
  console.log('totalAmount', totalAmount.toString())

  await talentLayerEscrow.connect(alice).createETHTransaction(
    3600 * 24 * 7,
    '_metaEvidence',
    firstServiceId,
    3, //proposalId/talentLayerId of carol.
    talentLayerArbitrator.address,
    '',
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

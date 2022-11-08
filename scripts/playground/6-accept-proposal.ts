import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

// Alice accept the Carol proposal
async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )

  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    'TalentLayerMultipleArbitrableTransaction',
    get(network as Network, ConfigProperty.TalentLayerMultipleArbitrableTransaction),
  )
  // const rateToken = "0x0000000000000000000000000000000000000000";
  const rateAmount = 200
  const adminFeeAmount = 10

  let serviceId = await serviceRegistry.nextServiceId()
  serviceId = serviceId.sub(1)
  console.log('serviceId', serviceId.toString())

  await talentLayerMultipleArbitrableTransaction.connect(alice).createETHTransaction(
    3600 * 24 * 7,
    '_metaEvidence',
    dave.address, //admin address, not used yet.
    adminFeeAmount,
    serviceId,
    3, //proposalId/talentLayerId of carol.
    { value: rateAmount + adminFeeAmount },
  )

  console.log('Alice accept the Carol proposal')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

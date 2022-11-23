import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

/*
In this script Alice will accept Dave proposal with Token transaction
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

  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    'TalentLayerMultipleArbitrableTransaction',
    get(network as Network, ConfigProperty.TalentLayerMultipleArbitrableTransaction),
  )

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  const token = await ethers.getContractAt('SimpleERC20', get(network as Network, ConfigProperty.SimpleERC20))

  // contract send 20 token to alice
  // await token.transfer(alice.address, ethers.utils.parseUnits('1', 18))

  const amountDave = ethers.utils.parseUnits('0.003', 18)
  console.log('amountBob', amountDave.toString())

  //Protocol fee
  const protocolFee = ethers.BigNumber.from(await talentLayerMultipleArbitrableTransaction.protocolFee())
  console.log('protocolFee', protocolFee.toString())

  //Origin platform fee && platform fee
  const daveTlId = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  const davePlatformData = await platformIdContrat.platforms(daveTlId)
  const originPlatformFee = ethers.BigNumber.from(await talentLayerMultipleArbitrableTransaction.originPlatformFee())
  const platformFee = ethers.BigNumber.from(davePlatformData.fee)

  const totalAmount = amountDave.add(
    amountDave.mul(protocolFee.add(originPlatformFee).add(platformFee)).div(ethers.BigNumber.from(10000)),
  )
  console.log('totalAmount', totalAmount.toString())

  // we allow the contract to spend Alice tokens with the bob rateAmount + fees
  const approv = await token.approve(talentLayerMultipleArbitrableTransaction.address, totalAmount)
  approv.wait()

  let secondServiceId = await serviceRegistry.nextServiceId()
  secondServiceId = secondServiceId.sub(1)
  console.log('serviceId', secondServiceId.toString())

  await talentLayerMultipleArbitrableTransaction.connect(alice).createTokenTransaction(
    3600 * 24 * 7,
    '_metaEvidence',
    secondServiceId,
    4, //proposalId/talentLayerId of Dave.
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

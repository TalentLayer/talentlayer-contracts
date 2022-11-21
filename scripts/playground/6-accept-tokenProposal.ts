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
  console.log('talentLayerMultipleArbitrableTransaction', talentLayerMultipleArbitrableTransaction)

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  const token = await ethers.getContractAt('SimpleERC20', get(network as Network, ConfigProperty.SimpleERC20))
  console.log('token', token.address)

  // contract send 20 token to alice
  await token.transfer(alice.address, ethers.utils.parseUnits('20', 18))

  // we check the alice wallet balance
  const aliceBalance = await token.balanceOf(alice.address)
  console.log('aliceBalance', ethers.utils.formatUnits(aliceBalance, 18))

  // we allow the contract to spend our tokens
  const amountBob = ethers.utils.parseUnits('0.03', 18)
  console.log('amountBob', amountBob.toString())

  //Protocol fee
  const protocolFee = ethers.BigNumber.from(await talentLayerMultipleArbitrableTransaction.protocolFee())
  console.log('protocolFee', protocolFee.toString())

  //Origin platform fee && platform fee
  const daveTlId = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  const davePlatformData = await platformIdContrat.platforms(daveTlId)
  const originPlatformFee = ethers.BigNumber.from(await talentLayerMultipleArbitrableTransaction.originPlatformFee())
  const platformFee = ethers.BigNumber.from(davePlatformData.fee)

  const totalAmount = amountBob.add(
    amountBob.mul(protocolFee.add(originPlatformFee).add(platformFee)).div(ethers.BigNumber.from(10000)),
  )
  console.log('totalAmount', totalAmount.toString())

  await token.approve(talentLayerMultipleArbitrableTransaction.address, totalAmount)

  let serviceId = await serviceRegistry.nextServiceId()
  serviceId = serviceId.sub(1)
  console.log('serviceId', serviceId.toString())

  await talentLayerMultipleArbitrableTransaction.connect(alice).createTokenTransaction(
    3600 * 24 * 7,
    '_metaEvidence',
    serviceId,
    3, //proposalId/talentLayerId of carol.
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

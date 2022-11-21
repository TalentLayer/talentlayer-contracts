import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

// Then Alice releases 3/4 of the escrow & Carol reimburses the remaining 1/4 to Alice
async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    'TalentLayerMultipleArbitrableTransaction',
    get(network as Network, ConfigProperty.TalentLayerMultipleArbitrableTransaction),
  )
  const rateAmount = ethers.utils.parseUnits('0.002', 18)

  await talentLayerMultipleArbitrableTransaction.connect(alice).release(0, rateAmount.div(2))
  await talentLayerMultipleArbitrableTransaction.connect(alice).release(0, rateAmount.div(4))
  await talentLayerMultipleArbitrableTransaction.connect(carol).reimburse(0, rateAmount.div(4))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

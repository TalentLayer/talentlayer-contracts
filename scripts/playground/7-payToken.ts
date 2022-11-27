import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')
/*
In this script  Alice will release the full token Amount in token to Dave

*/
async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    'TalentLayerMultipleArbitrableTransaction',
    get(network as Network, ConfigProperty.TalentLayerMultipleArbitrableTransaction),
  )
  const rateAmount = ethers.utils.parseUnits('0.003', 18)

  const release = await talentLayerMultipleArbitrableTransaction.connect(alice).release(1, rateAmount)
  release.wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

// Then Alice create a service, and others add proposals
async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice] = await ethers.getSigners()
  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    'TalentLayerMultipleArbitrableTransaction',
    get(network as Network, ConfigProperty.TalentLayerMultipleArbitrableTransaction),
  )

  const firstRelease = await talentLayerMultipleArbitrableTransaction.connect(alice).release(0, 140)
  await firstRelease.wait()
  console.log('Alice first Release is 140')

  const secondRelease = await talentLayerMultipleArbitrableTransaction.connect(alice).release(0, 60)
  await secondRelease.wait()

  console.log('Alice second release is 60')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

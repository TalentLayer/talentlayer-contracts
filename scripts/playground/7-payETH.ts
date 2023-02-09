import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../utils/config'
const hre = require('hardhat')
/*
In this script  Alice releases 3/4 of the escrow & Carol reimburses the remaining 1/4 to Alice
*/
async function main() {
  const network = await hre.network.name
  console.log(network)

  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    get(network as Network, ConfigProperty.TalentLayerEscrow),
  )

  const rateAmount = ethers.utils.parseUnits('0.002', 18)

  const firstRelease = await talentLayerEscrow.connect(alice).release(0, rateAmount.div(2))
  firstRelease.wait()
  const secondRelease = await talentLayerEscrow.connect(alice).release(0, rateAmount.div(2))
  secondRelease.wait()
  // const reimburse = await talentLayerEscrow.connect(carol).reimburse(0, rateAmount.div(4))
  // reimburse.wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

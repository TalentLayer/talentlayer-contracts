import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import hre = require('hardhat')

const aliceTlId = 1
const carolTlId = 3

/*
In this script  Alice releases 3/4 of the escrow & Carol reimburses the remaining 1/4 to Alice
*/
async function main() {
  const network = hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerEscrow),
  )

  const rateAmount = ethers.utils.parseUnits('0.002', 18)

  // Alice releases an amount too low for the service to be considered finished
  const firstRelease = await talentLayerEscrow
    .connect(alice)
    .release(aliceTlId, 1, rateAmount.mul(20).div(100))
  await firstRelease.wait()
  const secondRelease = await talentLayerEscrow
    .connect(carol)
    .reimburse(carolTlId, 1, rateAmount.mul(80).div(100))
  await secondRelease.wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import { ethers } from 'hardhat'
import { getDeploymentProperty, DeploymentProperty } from '../../.deployment/deploymentManager'
import hre = require('hardhat')

/*
In this script dave the platform owner will claim the fees in ETH for the first service and in token for the second service
*/

async function main() {
  const network = hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerEscrow),
  )

  const platformIdContract = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  const simpleERC20 = await ethers.getContractAt(
    'SimpleERC20',
    getDeploymentProperty(network, DeploymentProperty.SimpleERC20),
  )

  const rateToken = '0x0000000000000000000000000000000000000000'
  const ERC20TokenAddress = simpleERC20.address
  const davePlatformId = await platformIdContract.connect(dave).ids(dave.address)

  // let balance = await talentLayerEscrow.connect(dave).getClaimableFeeBalance(rateToken)
  // console.log('balance before ', balance.toString())
  await talentLayerEscrow.connect(dave).claim(davePlatformId, rateToken)
  await talentLayerEscrow.connect(dave).claim(davePlatformId, ERC20TokenAddress)
  // balance = await talentLayerEscrow.connect(dave).getClaimableFeeBalance(rateToken)
  // console.log('balance after ', balance.toString())
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

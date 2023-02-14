import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import hre = require('hardhat')

const aliceTlId = 1

/*
In this script Alice will reject Bob's proposal
*/

// Then Alice create a service, and others add proposals
async function main() {
  const network = hre.network.name
  console.log(network)

  const [alice] = await ethers.getSigners()
  const talentLayerService = await ethers.getContractAt(
    'TalentLayerService',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerService),
  )

  const nextServiceId = await talentLayerService.nextServiceId()
  const firstServiceId = nextServiceId.sub(2)
  console.log('serviceId', firstServiceId.toString())

  //Alice rejected Bob proposal
  await talentLayerService.connect(alice).rejectProposal(aliceTlId, firstServiceId, 2)
  console.log('Alice rejected Bob proposal')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

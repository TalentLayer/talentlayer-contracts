import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import postToIPFS from '../utils/ipfs'
import hre = require('hardhat')

/*
In this script Bob will update his proposal
*/

// Then Alice create a service, and others add proposals
async function main() {
  const network = hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const talentLayerService = await ethers.getContractAt(
    'TalentLayerService',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerService),
  )

  const nextServiceId = await talentLayerService.nextServiceId()
  const firstServiceId = nextServiceId.sub(2)
  console.log('serviceId', firstServiceId.toString())

  const rateTokenBob = getDeploymentProperty(network, DeploymentProperty.SimpleERC20)
  const bobUri = await postToIPFS(
    JSON.stringify({
      proposalTitle: 'Javascript Developer',
      proposalAbout: 'We looking for Javascript Developer',
      rateType: 3,
      expectedHours: 50,
    }),
  )

  await talentLayerService
    .connect(bob)
    .updateProposal(firstServiceId, rateTokenBob, ethers.utils.parseUnits('0.0015', 18), bobUri)

  console.log('Bob update his proposal')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

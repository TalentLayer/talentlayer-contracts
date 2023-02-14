import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import postToIPFS from '../utils/ipfs'
import hre = require('hardhat')

const aliceTlId = 1

/*
In this script Alice will update the first service.
*/

async function main() {
  const network = hre.network.name
  console.log('Create service Test start---------------------')
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const talentLayerService = await ethers.getContractAt(
    'TalentLayerService',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerService),
  )
  const platformIdContract = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  const daveTalentLayerIdPlatform = await platformIdContract.getPlatformIdFromAddress(dave.address)
  console.log('Dave Talent Layer Id', daveTalentLayerIdPlatform)

  /* ----------- Alice Update her Service -------------- */

  const aliceUpdateJobData = await postToIPFS(
    JSON.stringify({
      title: 'Update title',
      about: 'Update about',
      keywords: 'Update Keyword',
      role: 'developer',
      rateToken: '0x0000000000000000000000000000000000000000',
      rateAmount: 1,
      recipient: '',
    }),
  )
  console.log('Alice Job Updated data Uri', aliceUpdateJobData)

  const nextServiceId = await talentLayerService.nextServiceId()
  const firstServiceId = nextServiceId.sub(2)
  console.log('the Alice service id is ', firstServiceId.toString())

<<<<<<< HEAD
  await talentLayerService
    .connect(alice)
    .updateServiceData(aliceTlId, firstServiceId, aliceUpdateJobData)
=======
  await talentLayerService.connect(alice).updateServiceData(firstServiceId, aliceUpdateJobData)
>>>>>>> 2713ee51e9241a067dfb2e987f2d3787a43913b7
  const jobDataAfterUpdate = await talentLayerService.getService(firstServiceId)
  console.log('Job Data after update', jobDataAfterUpdate)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

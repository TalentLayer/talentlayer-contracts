import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import postToIPFS from '../utils/ipfs'
import { getSignatureForService } from '../../test/utils/signature'
import hre = require('hardhat')

const aliceTlId = 1
const referralAmount = 0

/*
In this script Alice will create two services.
First we need to create Job Data and post it to IPFS to get the Service Data URI
Then we will create Open service

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

  const daveTalentLayerIdPlatform = await platformIdContract.ids(dave.address)
  console.log('Dave TalentLayer Id', daveTalentLayerIdPlatform)

  /* ----------- Create Open Service -------------- */

  // Alice create first service #1
  const aliceCreateFirstJobData = await postToIPFS(
    JSON.stringify({
      title: 'Full Stack Developer Job',
      about: 'Looking for Full Stack Developer',
      keywords: 'BlockChain',
      role: 'developer',
      rateToken: '0x0000000000000000000000000000000000000000',
      rateAmount: 1,
      recipient: '',
    }),
  )
  console.log('Alice First Job Data Uri', aliceCreateFirstJobData)
  const signatureFirstJob = await getSignatureForService(
    dave,
    aliceTlId,
    0,
    aliceCreateFirstJobData,
  )

  const createFirstOpenService = await talentLayerService
    .connect(alice)
    .createService(aliceTlId, daveTalentLayerIdPlatform, aliceCreateFirstJobData, signatureFirstJob, ethers.constants.AddressZero, referralAmount)
  await createFirstOpenService.wait()
  console.log('First Open Service created')

  const getFirstService = await talentLayerService.getService(1)
  console.log('First Service', getFirstService)

  // Alice create a second service #2
  const aliceCreateSecondJobData = await postToIPFS(
    JSON.stringify({
      title: 'Full Stack Developer Job 2',
      about: 'Looking for Full Stack Developer 2',
      keywords: 'BlockChain',
      role: 'developer',
      rateToken: '0x0000000000000000000000000000000000000000',
      rateAmount: 1,
      recipient: '',
    }),
  )
  console.log('Alice Second Job Data Uri', aliceCreateSecondJobData)

  const signatureSecondJob = await getSignatureForService(
    dave,
    aliceTlId,
    1,
    aliceCreateSecondJobData,
  )

  const createSecondOpenService = await talentLayerService
    .connect(alice)
    .createService(
      aliceTlId,
      daveTalentLayerIdPlatform,
      aliceCreateSecondJobData,
      signatureSecondJob,
      ethers.constants.AddressZero,
      referralAmount,
    )
  await createSecondOpenService.wait()
  console.log('Open Service 2 created')

  const getSecondService = await talentLayerService.getService(2)
  console.log('Second Service', getSecondService)

  // the next service id will be 3
  const getNextServiceId = await talentLayerService.nextServiceId()
  console.log('Next Service Id', getNextServiceId)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

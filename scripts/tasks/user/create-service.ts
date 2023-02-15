import { task } from 'hardhat/config'
import { getDeploymentProperty, DeploymentProperty } from '../../../.deployment/deploymentManager'
import postToIPFS from '../../utils/ipfs'

/**
 * @notice This task is used to create a new service
 * @usage npx hardhat create-service --network mumbai
 */
task('create-service', 'Create a new open service').setAction(async (args, { ethers, network }) => {
  const [deployer] = await ethers.getSigners()

  console.log('network', network.name)
  console.log('Create new service for:', deployer.address)

  /* ----------- Post Job data on IPFS -------------- */
  const jobDataCid = await postToIPFS(
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

  if (!jobDataCid) throw new Error('Job Data CID is not defined')

  console.log('Job Data CID', jobDataCid)

  /* ----------- Create an open service -------------- */
  const TalentLayerService = await ethers.getContractFactory('TalentLayerServiceV2')

  const talentLayerServiceAddress = getDeploymentProperty(
    network.name,
    DeploymentProperty['TalentLayerService'],
  )
  const talentLayerService = await TalentLayerService.attach(talentLayerServiceAddress)
  const tx = await talentLayerService.createService(1, jobDataCid)

  console.log('Service created on tx:', tx.hash)
})

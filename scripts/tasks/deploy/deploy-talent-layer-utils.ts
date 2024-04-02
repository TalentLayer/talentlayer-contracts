import {formatEther} from 'ethers/lib/utils'
import {task} from 'hardhat/config'
import {DeploymentProperty, getDeploymentProperty, setDeploymentProperty} from '../../../.deployment/deploymentManager'
import {verifyAddress} from './utils'

/**
 * @notice Task created only for test purposes of the upgradable process
 * @usage npx hardhat deploy-talent-layer-utils --verify --network mumbai
 */
task('deploy-talent-layer-utils', 'Deploy utils contract')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    try {
      const { verify } = args
      const [deployer] = await ethers.getSigners()

      console.log('Network')
      console.log(network.name)
      console.log('Task Args')
      console.log(args)

      console.log('Signer')
      console.log('  at', deployer.address)
      console.log('  ETH', formatEther(await deployer.getBalance()))

      await run('compile')

      const talentLayerID = await ethers.getContractAt(
          'TalentLayerID',
          getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
      )

      console.log('Deploying TalentLayerIdUtils...');

      const TalentLayerIdUtils = await ethers.getContractFactory("TalentLayerIdUtils");
      const talentLayerIdUtils = await TalentLayerIdUtils.deploy(talentLayerID.address);

      await talentLayerIdUtils.deployTransaction.wait(1)

      if (verify) {
        await verifyAddress(talentLayerIdUtils.address, [talentLayerID.address])
      }

      console.log('TalentLayerIdUtils address:', {
        implementation: talentLayerIdUtils.address,
      })

      setDeploymentProperty(
        network.name,
        DeploymentProperty.TalentLayerIdUtils,
        talentLayerIdUtils.address,
      )
    } catch (e) {
      console.log('------------------------')
      console.log('FAILED')
      console.error(e)
      console.log('------------------------')
      return 'FAILED'
    }
  })

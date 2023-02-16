import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task allow to update the platform id minting status
 * @param {uint256} mintstatus - The platform id minting status (0 = ON_PAUSE, 1 = ONLY_WHITELIST, 2 = PUBLIC)
 * @dev Example of script use: "npx hardhat update-platform-whitelist-status --status ONLY_WHITELIST --network mumbai"
 */
task('update-platform-whitelist-status', 'change the platform id minting status')
  .addParam('mintstatus', 'The platform id minting status')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { mintstatus } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerPlatformID),
      deployer,
    )

    await platformIdContract.updateMintStatus(mintstatus)
    console.log(`the platform id minting mintstatus is ${mintstatus}`)
  })

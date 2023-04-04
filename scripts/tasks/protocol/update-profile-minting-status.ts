import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to disable the whitelist period for minting reserved handles
 * @param {uint256} mintstatus - The platform id minting status (0 = ON_PAUSE, 1 = ONLY_WHITELIST, 2 = PUBLIC)
 * @dev Example of script use: "npx hardhat update-profile-minting-status --mintstatus 0 --network mumbai"
 */
task('update-profile-minting-status', 'Updates the minting status for minting TalentLayer IDs')
  .addParam('mintstatus', 'The platform id minting status')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { mintstatus } = taskArgs

    console.log('network', network.name)

    const talentLayerIdContract = await ethers.getContractAt(
      'TalentLayerID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
    )

    const tx = await talentLayerIdContract.updateMintStatus(mintstatus)
    await tx.wait()

    console.log(`The TalentLayer ID minting status is ${mintstatus}`)
  })

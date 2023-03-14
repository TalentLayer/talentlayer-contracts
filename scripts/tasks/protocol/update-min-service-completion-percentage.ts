import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to update the minimum percentage of released amount to consider a service completed
 * @param {string} percentage - The new minimum completion percentage
 * @dev Example of script use: "npx hardhat update-min-service-completion-percentage --percentage 30 --network mumbai"
 */
task(
  'update-min-service-completion-percentage',
  'update the minimum percentage of released amount to consider a service completed',
)
  .addParam('percentage', 'The new minimum completion percentage')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { percentage } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const talentLayerService = await ethers.getContractAt(
      'TalentLayerService',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerService),
      deployer,
    )

    const tx = await talentLayerService.updateMinCompletionPercentage(percentage)
    await tx.wait()

    const minCompletionPercentage = await talentLayerService.minCompletionPercentage()
    console.log('Updated minimum service completion percentage, value: ', minCompletionPercentage)
  })

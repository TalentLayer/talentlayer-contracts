import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to update the minimum timeout to pay the arbitration fee
 * @param {string} timeout - The new minimum arbitration fee timeout
 * @dev Example of script use: "npx hardhat update-min-arbitration-fee-timeout --timeout 14400 --network mumbai"
 */
task('update-min-arbitration-fee-timeout', 'update the minimum timeout to pay the arbitration fee')
  .addParam('timeout', 'The new minimum arbitration fee timeout')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { timeout } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerPlatformID),
      deployer,
    )

    const tx = await platformIdContract.updateMinArbitrationFeeTimeout(timeout)
    await tx.wait()

    const minArbitrationFeeTimeout = await platformIdContract.minArbitrationFeeTimeout()
    console.log('Updated minimum arbitration fee timeout, value: ', minArbitrationFeeTimeout)
  })

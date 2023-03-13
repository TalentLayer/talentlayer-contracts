import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to update the signer address of a platform
 * @param {string} signer - The address of the signer
 * @dev Example of script use: "npx hardhat update-signer --signer 0x5FbDB2315678afecb367f032d93F642f64180aa3 --network mumbai"
 */
task('update-signer', 'Updates the signer address of a platform')
  .addParam('signer', 'The address of the signer')
  .setAction(async (taskArgs, { ethers, network }) => {
    const platformId = process.env.PLATFORM_ID
    if (!platformId) {
      throw new Error('Please set your PLATFORM_ID in a .env file')
    }

    const { signer } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerPlatformID),
      deployer,
    )

    const tx = await platformIdContract.connect(deployer).updateSigner(platformId, signer)
    await tx.wait()

    console.log(`Updated signer for platform id ${platformId}: ${signer}`)
  })

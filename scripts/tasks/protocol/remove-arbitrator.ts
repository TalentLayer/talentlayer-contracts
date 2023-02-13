import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used remove an arbitrator from the list of available arbitrators
 *         in all the ERC-2771 compatible contracts
 * @param {string} address - The address of the arbitrator to remove
 * @dev Example of script use: "npx hardhat remove-arbitrator --address 0x9e1d8f9Ad75F6fF624D925C313b80C1a98071C89 --network mumbai"
 */
task('remove-arbitrator', 'Removes an available arbitrator')
  .addParam('address', 'The address of the arbitrator')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { address } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerPlatformID),
      deployer,
    )

    const tx = await platformIdContract.removeArbitrator(address)
    await tx.wait()

    console.log(`Removed arbitrator with address: `, address)
  })

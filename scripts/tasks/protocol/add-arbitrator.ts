import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to add a new arbitrator to the list of available arbitrators
 * @param {string} address - The address of the arbitrator
 * @dev Example of script use: "npx hardhat add-arbitrator --address 0x9e1d8f9Ad75F6fF624D925C313b80C1a98071C89 --is-internal --network mumbai"
 */
task('add-arbitrator', 'Adds a new available arbitrator')
  .addParam('address', 'The address of the arbitrator')
  .addFlag('isInternal', 'Whether the arbitrator is internal or not')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { address, isInternal } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerPlatformID),
      deployer,
    )

    const tx = await platformIdContract.addArbitrator(address, isInternal)
    await tx.wait()

    console.log(`Added ${isInternal ? 'internal' : 'external'} arbitrator with address: `, address)
  })

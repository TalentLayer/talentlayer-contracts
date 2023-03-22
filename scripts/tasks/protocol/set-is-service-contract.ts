import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to set whether an address is a service contract on the TalentLayerID contract
 * @param {address} address - The address of the contract
 * @param {boolean} isServiceContract - Whether the address is a service contract
 * @dev Example of script use:
 * npx hardhat set-is-service-contract --address 0xF5b45162b92407dC1A6baF5e9316E5FF9e29f824 --is-service-contract true --network mumbai
 */
task('set-is-service-contract', 'Sets whether an address is a service contract.')
  .addParam('address', "The user's address")
  .addParam('isServiceContract', "The user's handle")
  .setAction(async (taskArgs, { network, ethers }) => {
    const { address, isServiceContract } = taskArgs

    const talentLayerIdContract = await ethers.getContractAt(
      'TalentLayerID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
    )

    if (isServiceContract !== 'true' && isServiceContract !== 'false') {
      console.log(`Invalid input for isServiceContract: ${isServiceContract}`)
      return
    }

    const tx = await talentLayerIdContract.setIsServiceContract(
      address,
      isServiceContract === 'true',
    )
    await tx.wait()

    console.log(
      `Address ${address} is now ${
        isServiceContract === 'true' ? '' : 'not'
      } set as a service contract`,
    )
  })

import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to update the max price for minting short handles
 * @param {uint256} price - The max price for short handles, in Ether
 * @dev Example of script use: "npx hardhat update-short-handles-price --price 200 --network mumbai"
 */
task('update-short-handles-price', 'Updates max price for minting short handles')
  .addParam('price', 'The max price for short handles, in Ether')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { price } = taskArgs

    console.log('network', network.name)

    const talentLayerIdContract = await ethers.getContractAt(
      'TalentLayerID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
    )

    const tx = await talentLayerIdContract.updateShortHandlesMaxPrice(
      ethers.utils.parseEther(price),
    )
    await tx.wait()

    console.log(`The new max price for short handles is: ${price} Ether`)
  })

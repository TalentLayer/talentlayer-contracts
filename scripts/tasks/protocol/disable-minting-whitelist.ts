import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to disable the whitelist period for minting reserved handles
 * @dev Example of script use: "npx hardhat disable-minting-whitelist --network localhost"
 */
task(
  'disable-minting-whitelist',
  'Disables the whitelist period for minting reserved handles',
).setAction(async (_, { ethers, network }) => {
  console.log('network', network.name)

  const talentLayerIdContract = await ethers.getContractAt(
    'TalentLayerID',
    getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
  )

  const tx = await talentLayerIdContract.setWhitelistEnabled(false)
  await tx.wait()

  console.log(`Disabled whitelist period for minting reserved handles`)
})

import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to whitelist a user for platform ID minting
 * @param {string} address - The whitelisted address for platform ID minting
 * @dev Example of script use: "npx hardhat whitelist-platform-address --address 0x822e7287e61aDC163d0DB665c4b4c662518A053f --network mumbai"
 */
task('whitelist-platform-address', 'we add an address to the whitelist for platform id minting')
  .addParam('address', "The whitelist's address")
  .setAction(async (taskArgs, { ethers, network }) => {
    const { address } = taskArgs
    const [deployer] = await ethers.getSigners()
    console.log('deployer', deployer.address)

    console.log('network', network.name)

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerPlatformID),
      deployer,
    )

    await platformIdContract.whitelistUser(address)
    console.log(`address ${address} is whitelisted for minting platform id `)

    // we check if the address is whitelisted
    const isAddressWhitelisted = await platformIdContract.whitelist(address)
    console.log(`her status is ${isAddressWhitelisted}`)
  })

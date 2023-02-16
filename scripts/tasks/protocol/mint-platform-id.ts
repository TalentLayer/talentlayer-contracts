import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to mint a new platform ID for a given address
 * @param {string} name - The name of the platform
 * @param {string} address - The address of the platform
 * @dev Example of script use: "npx hardhat mint-platform-id --name hirevibes --address 0x5FbDB2315678afecb367f032d93F642f64180aa3 --network mumbai"
 */
task('mint-platform-id', 'Mints platform Ids for an address')
  .addParam('name', "The platform's name")
  .addParam('address', "The platform's address")
  .setAction(async (taskArgs, { ethers, network }) => {
    const { name, address } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerPlatformID),
      deployer,
    )

    const tx = await platformIdContract.mintForAddress(name, address)
    await tx.wait()
    const platformId = await platformIdContract.ids(address)
    console.log(`Minted platform id: ${platformId} for address ${address}`)
  })

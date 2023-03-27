import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to mint a new TalentLayer ID for a user with a given address
 * @param {string} address - The wallet address of the user
 * @param {string} handle - The handle of the user
 * @dev Example of script use: "npx hardhat mint-for-address --address 0x5FbDB2315678afecb367f032d93F642f64180aa3 --handle miguel --network mumbai"
 */
task('mint-for-address', 'Mints a new TalentLayer ID for a given address')
  .addParam('address', "The user's address")
  .addParam('handle', "The user's handle")
  .setAction(async (taskArgs, { ethers, network }) => {
    const { address, handle } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerPlatformID),
      deployer,
    )
    const talentLayerIdContract = await ethers.getContractAt(
      'TalentLayerID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
      deployer,
    )

    const platformId = await platformIdContract.ids(deployer.address)

    const price = await talentLayerIdContract.getHandlePrice(handle)
    const tx = await talentLayerIdContract
      .connect(deployer)
      .mintForAddress(address, platformId, handle, {
        value: price,
      })
    await tx.wait()

    console.log(`Minted TalentLayer ID with handle ${handle} for address ${address}`)
  })

import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to mint a new TalentLayer ID for a given address
 * @param {uint} platformId - the id of the originating platform
 * @param {address} userAddress - The wallet address of the user
 * @param {string} userHandle - The handle of the user
 * @dev Example of script use:
 * npx hardhat mint-talentlayer-id --network localhost --platform 1 --address 0xF5b45162b92407dC1A6baF5e9316E5FF9e29f824 --handle zelda
 */
task('mint-talentlayer-id', 'Mints talentLayer Id to an address.')
  .addParam('platform', "The platform's id")
  .addParam('address', "The user's address")
  .addParam('handle', "The user's handle")
  .setAction(async (taskArgs, { network, ethers }) => {
    const { platform, address, handle } = taskArgs

    const talentLayerIdContract = await ethers.getContractAt(
      'TalentLayerID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
    )
    const tx = await talentLayerIdContract.freeMint(platform, address, handle)
    const talentLayerId = await talentLayerIdContract.ids(address)
    console.log(
      `Minted talentLayer id: ${talentLayerId} for address ${address} on network ${network.name}`,
    )
  })

import { BigNumber } from 'ethers'
import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to add or remove a token address to the whitelist
 * @param {string} tokenAddress - The address of the token to be added to the whitelist
 * @param {string} action - Input "add" to add the token address & "remove" to remove the token address from the whitelist
 * @dev Example of script use: "npx hardhat update-token-address-to-whitelist --address 0x5FbDB2315678afecb367f032d93F642f64180aa3 --action add --mintransactionamount 0.001 --network mumbai"
 * @dev Only contract owner can execute this task
 */
task('update-token-address-to-whitelist', 'Add or remove a token address to the whitelist')
  .addParam('address', "The token's address")
  .addParam('action', 'The action to perform: "add" or "remove"')
  .addParam(
    'mintransactionamount',
    'The minimum amount of tokens required to be sent in a transaction',
  )
  .setAction(async (taskArgs, { ethers, network }) => {
    const { address, action, mintransactionamount } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const talentLayerService = await ethers.getContractAt(
      'TalentLayerService',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerService),
      deployer,
    )

    const tx = await talentLayerService.updateAllowedTokenList(
      address,
      action === Actions.ADD,
      ethers.utils.parseUnits(mintransactionamount, 18),
    )
    await tx.wait()
    const isTokenRegistered = await talentLayerService.isTokenAllowed(address)
    console.log(
      `Updates token whitelist: ${address} was ${
        isTokenRegistered ? 'added to ' : 'removed from '
      }the whitelist`,
    )
  })

export enum Actions {
  ADD = 'add',
  REMOVE = 'remove',
}

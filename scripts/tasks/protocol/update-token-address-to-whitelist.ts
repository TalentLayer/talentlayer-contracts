import { task } from 'hardhat/config'
import { Network } from '../../utils/config'
import { ConfigProperty, get } from '../../../configManager'

/**
 * @notice This task is used to add or remove a token address to the whitelist
 * @param {string} tokenAddress - The address of the token to be added to the whitelist
 * @param {string} action - Input "add" to add the token address & "remove" to remove the token address from the whitelist
 * @dev Example of script use: "npx hardhat add-token-address-to-whitelist --address 0x5FbDB2315678afecb367f032d93F642f64180aa3 --action add --network goerli"
 * @dev Only contract owner can execute this task
 */
task('update-token-address-to-whitelist', 'Add or remove a token address to the whitelist')
  .addParam('address', "The token's address")
  .addParam('action', 'The action to perform: "add" or "remove"')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { address, action } = taskArgs
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)

    const serviceRegistry = await ethers.getContractAt(
      'ServiceRegistry',
      get(network.name as any as Network, ConfigProperty.ServiceRegistry),
      deployer,
    )

    const tx = await serviceRegistry.updateAllowedTokenList(address, action === Actions.ADD)
    await tx.wait()
    const isTokenRegistered = await serviceRegistry.isTokenAllowed(address)
    console.log(
      `Updates token whitelist: ${address} was ${isTokenRegistered ? 'added to ' : 'removed from '}the whitelist`,
    )
  })

export enum Actions {
  ADD = 'add',
  REMOVE = 'remove',
}

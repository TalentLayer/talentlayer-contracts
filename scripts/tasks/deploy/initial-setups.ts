import { formatEther } from 'ethers/lib/utils'
import { subtask, task } from 'hardhat/config'
import { getConfig, Network, NetworkConfig } from '../../../networkConfig'

/**
 * @notice Setup the contracts deployed based on the networkConfig.ts for the defined network
 * @usage npx hardhat initial-setup --network mumbai
 */
task(
  'initial-setup',
  'Setup the contracts deployed based on the networkConfig.ts for the defined network',
).setAction(async (args, { ethers, run, network }) => {
  try {
    const [deployer] = await ethers.getSigners()
    const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
    const networkConfig: NetworkConfig = getConfig(chainId)

    console.log('Network')
    console.log(network.name)
    console.log('Task Args')
    console.log(networkConfig)

    await run('print', { message: 'Hello, World!' })

    console.log('------------------------')
    console.log('Platform ID Whitelist')
    for (const [name, address] of Object.entries(networkConfig.whitelist)) {
      await run('add-address-whitelist', { address })
    }
    console.log('------------------------')

    console.log('------------------------')
    console.log('Mint Platform IDs')
    for (const [name, address] of Object.entries(networkConfig.platformList)) {
      await run('mint-platform-id', { name, address })
    }
    console.log('------------------------')

    console.log('------------------------')
    console.log('Add Token Addresses to Allowed Token List')
    for (const [name, address] of Object.entries(networkConfig.allowedTokenList)) {
      await run('update-token-address-to-whitelist', { action: 'add', address })
    }
    console.log('------------------------')

    console.log('Signer')
    console.log('  at', deployer.address)
    console.log('  ETH', formatEther(await deployer.getBalance()))
  } catch (e) {
    console.log('------------------------')
    console.log('FAILED')
    console.error(e)
    console.log('------------------------')
    return 'FAILED'
  }
})

subtask('print', 'Prints a message')
  .addParam('message', 'The message to print')
  .setAction(async (taskArgs) => {
    console.log(taskArgs.message)
  })

import { formatEther } from 'ethers/lib/utils'
import { subtask, task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'
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

    // we set up the whitelist status to whitelist only
    const mintstatus = '1'
    await run('update-platform-whitelist-status', { mintstatus })

    console.log('------------------------')
    console.log('Whitelist address in PlatformID contract')
    await run('whitelist-platform-address', { address: deployer.address })
    for (const [name, address] of Object.entries(networkConfig.platformList)) {
      await run('whitelist-platform-address', { address })
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
    for (const [name, { address, minTransactionAmount, decimals }] of Object.entries(
      networkConfig.allowedTokenList,
    )) {
      await run('update-token-address-to-whitelist', {
        address,
        action: 'add',
        minTransactionAmount,
        decimals: decimals.toString(),
      })
    }
    console.log('------------------------')

    console.log('------------------------')
    console.log('Set service contract address on TalentLayerID')
    const talentLayerServiceAddress = getDeploymentProperty(
      network.name,
      DeploymentProperty.TalentLayerService,
    )
    await run('set-is-service-contract', {
      address: talentLayerServiceAddress,
      isServiceContract: 'true',
    })
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

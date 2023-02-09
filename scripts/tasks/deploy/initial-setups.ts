import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { getConfig, Network, NetworkConfig } from '../../../networkConfig'

/**
 * @notice Setup the contracts deployed based on the network configuration
 * @usage npx hardhat initial-setup --network mumbai
 */
task('initial-setup', 'Setup the contracts deployed based on the network configuration').setAction(
  async (args, { ethers, run, network }) => {
    try {
      const [deployer] = await ethers.getSigners()
      const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
      const networkConfig: NetworkConfig = getConfig(chainId)

      console.log('Network')
      console.log(network.name)
      console.log('Task Args')
      console.log(args)

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
  },
)

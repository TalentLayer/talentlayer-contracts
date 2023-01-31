import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { getConfig, Network, NetworkConfig } from '../../config'
import { set, ConfigProperty, get } from '../../../configManager'

/**
 * @notice Task created only for test purposes of the upgradable process
 * @usage npx hardhat deploy-service-registry-v2 --verify --network goerli
 */
task('deploy-service-registry-v2')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    try {
      const { verify } = args
      const [deployer] = await ethers.getSigners()

      console.log('Network')
      console.log(network.name)
      console.log('Task Args')
      console.log(args)

      console.log('Signer')
      console.log('  at', deployer.address)
      console.log('  ETH', formatEther(await deployer.getBalance()))

      await run('compile')

      // Deploy Service Registry Contract V2
      const ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
      const serviceRegistry = await ServiceRegistry.attach(
        get((network.name as any) as Network, ConfigProperty.ServiceRegistry),
      )
      const ServiceRegistryV2 = await ethers.getContractFactory('ServiceRegistryV2')
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const serviceRegistryV2 = await upgrades.upgradeProxy(serviceRegistry.address, ServiceRegistryV2, {
        timeout: 0,
        pollingInterval: 10000,
      })

      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(serviceRegistryV2.address)

      if (verify) {
        await serviceRegistryV2.deployTransaction.wait(5)
        await run('verify:verify', {
          address: implementationAddress,
          constructorArguments: [],
        })
      }
      console.log('ServiceRegistry upgraded', {
        proxy: serviceRegistryV2.address,
        implementation: implementationAddress,
      })
      set((network.name as any) as Network, ConfigProperty.ServiceRegistry, serviceRegistryV2.address)
    } catch (e) {
      console.log('------------------------')
      console.log('FAILED')
      console.error(e)
      console.log('------------------------')
      return 'FAILED'
    }
  })

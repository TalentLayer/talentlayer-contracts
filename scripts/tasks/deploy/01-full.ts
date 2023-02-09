import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { getConfig, Network, NetworkConfig } from '../../utils/config'
import { set, ConfigProperty } from '../../../configManager'

/**
 * @notice Task created only for test purposes of the upgradable process
 * @usage npx hardhat deploy-full --use-test-erc20 --verify --network goerli
 */
task('deploy-full', 'Deploy all the contracts on their first version')
  .addFlag('useTestErc20', 'deploy a mock ERC20 contract')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    try {
      const { verify, useTestErc20 } = args
      const [deployer, bob, carol, dave] = await ethers.getSigners()
      const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
      const networkConfig: NetworkConfig = getConfig(chainId)

      console.log('Network')
      console.log(network.name)
      console.log('Task Args')
      console.log(args)

      console.log('Signer')
      console.log('  at', deployer.address)
      console.log('  ETH', formatEther(await deployer.getBalance()))

      await run('compile')

      // Deploy TalentLayerPlatformID contract
      const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerPlatformID = await upgrades.deployProxy(TalentLayerPlatformID, {
        timeout: 0,
        pollingInterval: 10000,
      })
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerPlatformIDImplementationAddress = await upgrades.erc1967.getImplementationAddress(
        talentLayerPlatformID.address,
      )
      if (verify) {
        await talentLayerPlatformID.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerPlatformID.address,
        })
        await run('verify:verify', {
          address: talentLayerPlatformIDImplementationAddress,
        })
      }
      console.log('TalentLayerPlatformID addresses:', {
        proxy: talentLayerPlatformID.address,
        implementation: talentLayerPlatformIDImplementationAddress,
      })

      set(network.name as any as Network, ConfigProperty.TalentLayerPlatformID, talentLayerPlatformID.address)

      // Deploy ID contract
      const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
      const talentLayerIDArgs: [string] = [talentLayerPlatformID.address]
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerID = await upgrades.deployProxy(TalentLayerID, talentLayerIDArgs)
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerIDImplementationAddress = await upgrades.erc1967.getImplementationAddress(talentLayerID.address)
      if (verify) {
        await talentLayerID.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerID.address,
          constructorArguments: talentLayerIDArgs,
        })
        await run('verify:verify', {
          address: talentLayerIDImplementationAddress,
        })
      }
      console.log('talentLayerID addresses:', {
        proxy: talentLayerID.address,
        implementation: talentLayerIDImplementationAddress,
      })

      set(network.name as any as Network, ConfigProperty.TalentLayerID, talentLayerID.address)

      // Deploy Service Registry Contract
      const ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
      const serviceRegistryArgs: [string, string] = [talentLayerID.address, talentLayerPlatformID.address]
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const serviceRegistry = await upgrades.deployProxy(ServiceRegistry, serviceRegistryArgs, {
        timeout: 0,
        pollingInterval: 10000,
      })
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const serviceRegistryImplementationAddress = await upgrades.erc1967.getImplementationAddress(
        serviceRegistry.address,
      )

      if (verify) {
        await serviceRegistry.deployTransaction.wait(5)
        await run('verify:verify', {
          address: serviceRegistry.address,
          constructorArguments: serviceRegistryArgs,
        })
        await run('verify:verify', {
          address: serviceRegistryImplementationAddress,
        })
      }
      console.log('Service Registry addresses:', {
        proxy: serviceRegistry.address,
        implementation: serviceRegistryImplementationAddress,
      })
      set(network.name as any as Network, ConfigProperty.ServiceRegistry, serviceRegistry.address)

      // Deploy Review contract
      const TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
      const talentLayerReviewArgs: [string, string, string, string, string] = [
        'TalentLayer Reviews',
        'TLR',
        talentLayerID.address,
        serviceRegistry.address,
        talentLayerPlatformID.address,
      ]
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerReview = await upgrades.deployProxy(TalentLayerReview, talentLayerReviewArgs, {
        timeout: 0,
        pollingInterval: 10000,
      })
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerReviewImplementationAddress = await upgrades.erc1967.getImplementationAddress(
        talentLayerReview.address,
      )
      if (verify) {
        await talentLayerReview.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerReview.address,
        })
        await run('verify:verify', {
          address: talentLayerReviewImplementationAddress,
        })
      }
      console.log('TalentLayerReview addresses:', {
        proxy: talentLayerReview.address,
        implementation: talentLayerReviewImplementationAddress,
      })

      set(network.name as any as Network, ConfigProperty.Reviewscontract, talentLayerReview.address)

      // Deploy TalentLayerArbitrator
      const TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
      const talentLayerArbitrator = await TalentLayerArbitrator.deploy(talentLayerPlatformID.address)
      if (verify) {
        await talentLayerArbitrator.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerArbitrator.address,
          constructorArguments: [talentLayerPlatformID.address],
        })
      }
      console.log('TalentLayerArbitrator contract address:', talentLayerArbitrator.address)

      set(network.name as any as Network, ConfigProperty.TalentLayerArbitrator, talentLayerArbitrator.address)

      // Add TalentLayerArbitrator to platform available arbitrators
      await talentLayerPlatformID.addArbitrator(talentLayerArbitrator.address, true)

      const TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrow')
      const talentLayerEscrowArgs: [string, string, string, string | undefined] = [
        serviceRegistry.address,
        talentLayerID.address,
        talentLayerPlatformID.address,
        networkConfig.multisigAddress,
      ]
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerEscrow = await upgrades.deployProxy(TalentLayerEscrow, talentLayerEscrowArgs, {
        timeout: 0,
        pollingInterval: 10000,
      })
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerEscrowImplementationAddress = await upgrades.erc1967.getImplementationAddress(
        talentLayerEscrow.address,
      )
      if (verify) {
        await talentLayerEscrow.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerEscrow.address,
          constructorArguments: talentLayerEscrowArgs,
        })
        await run('verify:verify', {
          address: talentLayerEscrowImplementationAddress,
        })
      }
      console.log('TalentLayerEscrow contract addresses:', {
        proxy: talentLayerEscrow.address,
        implementation: talentLayerEscrowImplementationAddress,
      })

      set(network.name as any as Network, ConfigProperty.TalentLayerEscrow, talentLayerEscrow.address)

      if (useTestErc20) {
        // Deploy ERC20 contract

        // amount transfered to bob, dave and carol
        const amount = ethers.utils.parseUnits('10', 18)
        const SimpleERC20 = await ethers.getContractFactory('SimpleERC20')
        const simpleERC20 = await SimpleERC20.deploy()
        await simpleERC20.transfer(bob.address, amount)
        await simpleERC20.transfer(carol.address, amount)
        await simpleERC20.transfer(dave.address, amount)

        console.log('simpleERC20 address:', simpleERC20.address)

        // get the SimpleERC20 balance in wallet of bob, carol and dave
        const balance = await simpleERC20.balanceOf(bob.address)
        console.log('SimpleERC20 balance:', balance.toString())
        const balance2 = await simpleERC20.balanceOf(carol.address)
        console.log('SimpleERC20 balance2:', balance2.toString())
        const balance3 = await simpleERC20.balanceOf(dave.address)
        console.log('SimpleERC20 balance3:', balance3.toString())

        set(network.name as any as Network, ConfigProperty.SimpleERC20, simpleERC20.address)
      }

      // Grant escrow role
      const escrowRole = await serviceRegistry.ESCROW_ROLE()
      await serviceRegistry.grantRole(escrowRole, talentLayerEscrow.address)
    } catch (e) {
      console.log('------------------------')
      console.log('FAILED')
      console.error(e)
      console.log('------------------------')
      return 'FAILED'
    }
  })

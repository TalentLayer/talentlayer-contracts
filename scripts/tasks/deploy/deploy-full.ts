import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { getConfig, Network, NetworkConfig } from '../../../networkConfig'
import { setDeploymentProperty, DeploymentProperty } from '../../../.deployment/deploymentManager'
import { verifyAddress } from './utils'

/**
 * @notice Task created only for test purposes of the upgradable process
 * @usage npx hardhat deploy-full --use-test-erc20 --verify --network mumbai
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
      const talentLayerPlatformID = await (upgrades as HardhatUpgrades).deployProxy(
        TalentLayerPlatformID,
        {
          timeout: 0,
          pollingInterval: 10000,
        },
      )

      if (verify) {
        await verifyAddress(talentLayerPlatformID.address)
      }

      const talentLayerPlatformIDImplementationAddress =
        await // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
        (upgrades as HardhatUpgrades).erc1967.getImplementationAddress(
          talentLayerPlatformID.address,
        )
      console.log('TalentLayerPlatformID addresses:', {
        proxy: talentLayerPlatformID.address,
        implementation: talentLayerPlatformIDImplementationAddress,
      })

      setDeploymentProperty(
        network.name,
        DeploymentProperty.TalentLayerPlatformID,
        talentLayerPlatformID.address,
      )

      // Deploy ID contract
      const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
      const talentLayerIDArgs: [string] = [talentLayerPlatformID.address]
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerID = await (upgrades as HardhatUpgrades).deployProxy(
        TalentLayerID,
        talentLayerIDArgs,
      )
      if (verify) {
        await verifyAddress(talentLayerID.address)
      }
      const talentLayerIDImplementationAddress =
        await // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
        (upgrades as HardhatUpgrades).erc1967.getImplementationAddress(talentLayerID.address)
      console.log('talentLayerID addresses:', {
        proxy: talentLayerID.address,
        implementation: talentLayerIDImplementationAddress,
      })

      setDeploymentProperty(network.name, DeploymentProperty.TalentLayerID, talentLayerID.address)

      // Deploy TalentLayerService Contract
      const TalentLayerService = await ethers.getContractFactory('TalentLayerService')
      const talentLayerServiceArgs: [string, string] = [
        talentLayerID.address,
        talentLayerPlatformID.address,
      ]
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerService = await (upgrades as HardhatUpgrades).deployProxy(
        TalentLayerService,
        talentLayerServiceArgs,
        {
          timeout: 0,
          pollingInterval: 10000,
        },
      )

      if (verify) {
        await verifyAddress(talentLayerService.address)
      }
      const talentLayerServiceImplementationAddress =
        await // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
        (upgrades as HardhatUpgrades).erc1967.getImplementationAddress(talentLayerService.address)
      console.log('TalentLayerService addresses:', {
        proxy: talentLayerService.address,
        implementation: talentLayerServiceImplementationAddress,
      })
      setDeploymentProperty(
        network.name,
        DeploymentProperty.TalentLayerService,
        talentLayerService.address,
      )

      // Deploy Review contract
      const TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
      const talentLayerReviewArgs: [string, string, string, string, string] = [
        'TalentLayer Reviews',
        'TLR',
        talentLayerID.address,
        talentLayerService.address,
        talentLayerPlatformID.address,
      ]
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerReview = await (upgrades as HardhatUpgrades).deployProxy(
        TalentLayerReview,
        talentLayerReviewArgs,
        {
          timeout: 0,
          pollingInterval: 10000,
        },
      )
      if (verify) {
        await verifyAddress(talentLayerReview.address)
      }
      const talentLayerReviewImplementationAddress =
        await // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
        (upgrades as HardhatUpgrades).erc1967.getImplementationAddress(talentLayerReview.address)
      console.log('TalentLayerReview addresses:', {
        proxy: talentLayerReview.address,
        implementation: talentLayerReviewImplementationAddress,
      })

      setDeploymentProperty(
        network.name,
        DeploymentProperty.Reviewscontract,
        talentLayerReview.address,
      )

      // Deploy TalentLayerArbitrator
      const TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
      const talentLayerArbitrator = await TalentLayerArbitrator.deploy(
        talentLayerPlatformID.address,
      )
      if (verify) {
        await verifyAddress(talentLayerArbitrator.address, [talentLayerPlatformID.address])
      }
      console.log('TalentLayerArbitrator contract address:', talentLayerArbitrator.address)

      setDeploymentProperty(
        network.name,
        DeploymentProperty.TalentLayerArbitrator,
        talentLayerArbitrator.address,
      )

      // Add TalentLayerArbitrator to platform available arbitrators
      await talentLayerPlatformID.addArbitrator(talentLayerArbitrator.address, true)

      const TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrow')
      const talentLayerEscrowArgs: [string, string, string, string | undefined] = [
        talentLayerService.address,
        talentLayerID.address,
        talentLayerPlatformID.address,
        networkConfig.multisigAddressList.fee,
      ]
      // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
      const talentLayerEscrow = await (upgrades as HardhatUpgrades).deployProxy(
        TalentLayerEscrow,
        talentLayerEscrowArgs,
        {
          timeout: 0,
          pollingInterval: 10000,
        },
      )
      if (verify) {
        await verifyAddress(talentLayerEscrow.address)
      }
      const talentLayerEscrowImplementationAddress =
        await // @ts-ignore: upgrades is imported in hardhat.config.ts - HardhatUpgrades
        (upgrades as HardhatUpgrades).erc1967.getImplementationAddress(talentLayerEscrow.address)
      console.log('TalentLayerEscrow contract addresses:', {
        proxy: talentLayerEscrow.address,
        implementation: talentLayerEscrowImplementationAddress,
      })

      setDeploymentProperty(
        network.name,
        DeploymentProperty.TalentLayerEscrow,
        talentLayerEscrow.address,
      )

      if (useTestErc20) {
        // Deploy ERC20 contract

        // amount transferred to bob, dave and carol
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

        setDeploymentProperty(network.name, DeploymentProperty.SimpleERC20, simpleERC20.address)
      }

      // Grant escrow role
      const escrowRole = await talentLayerService.ESCROW_ROLE()
      await talentLayerService.grantRole(escrowRole, talentLayerEscrow.address)
    } catch (e) {
      console.log('------------------------')
      console.log('FAILED')
      console.error(e)
      console.log('------------------------')
      return 'FAILED'
    }
  })

import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { getConfig, Network, NetworkConfig } from './config'
import { set, ConfigProperty } from '../configManager'

// npx hardhat deploy --use-pohmock --use-test-erc20  --verify --network goerli
task('deploy')
  .addFlag('usePohmock', 'deploy a mock of POH')
  .addFlag('useTestErc20', 'deploy a mock ERC20 contract')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    try {
      const { verify, usePohmock, useTestErc20 } = args
      const [alice, bob, carol, dave] = await ethers.getSigners()
      const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
      const networkConfig: NetworkConfig = getConfig(chainId)

      console.log('Network')
      console.log(network.name)
      console.log('Task Args')
      console.log(args)

      console.log('Signer')
      console.log('  at', alice.address)
      console.log('  ETH', formatEther(await alice.getBalance()))

      await run('compile')

      let pohAddress, mockProofOfHumanity
      if (usePohmock) {
        // Deploy Mock proof of humanity contract
        const MockProofOfHumanity = await ethers.getContractFactory('MockProofOfHumanity')
        mockProofOfHumanity = await MockProofOfHumanity.deploy()
        if (verify) {
          await mockProofOfHumanity.deployTransaction.wait(5)
          await run('verify:verify', {
            address: mockProofOfHumanity.address,
          })
        }
        console.log('Mock proof of humanity address:', mockProofOfHumanity.address)
        pohAddress = mockProofOfHumanity.address
        set(network.name as any as Network, ConfigProperty.MockProofOfHumanity, pohAddress)
      } else {
        pohAddress = networkConfig.proofOfHumanityAddress
        set(network.name as any as Network, ConfigProperty.MockProofOfHumanity, pohAddress)
      }

      // Deploy TalentLayerPlatformID contract
      const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
      const talentLayerPlatformID = await upgrades.deployProxy(TalentLayerPlatformID, {
        timeout: 0,
        pollingInterval: 10000,
      })
      if (verify) {
        await talentLayerPlatformID.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerPlatformID.address,
        })
      }
      console.log('TalentLayerPlatformID address:', talentLayerPlatformID.address)

      set(network.name as any as Network, ConfigProperty.TalentLayerPlatformID, talentLayerPlatformID.address)

      // Deploy ID contract
      const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
      const talentLayerIDArgs: [string, string] = [pohAddress, talentLayerPlatformID.address]
      const talentLayerID = await upgrades.deployProxy(TalentLayerID, talentLayerIDArgs)
      if (verify) {
        await talentLayerID.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerID.address,
          constructorArguments: talentLayerIDArgs,
        })
      }
      console.log('talentLayerID address:', talentLayerID.address)

      set(network.name as any as Network, ConfigProperty.TalentLayerID, talentLayerID.address)

      // Deploy Service Registry Contract
      const ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
      const serviceRegistryArgs: [string, string] = [talentLayerID.address, talentLayerPlatformID.address]
      const serviceRegistry = await upgrades.deployProxy(ServiceRegistry, serviceRegistryArgs, {
        timeout: 0,
        pollingInterval: 10000,
      })

      if (verify) {
        await serviceRegistry.deployTransaction.wait(5)
        await run('verify:verify', {
          address: serviceRegistry.address,
          constructorArguments: serviceRegistryArgs,
        })
      }
      console.log('Service Registry address:', serviceRegistry.address)
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
      const talentLayerReview = await upgrades.deployProxy(TalentLayerReview, talentLayerReviewArgs, {
        timeout: 0,
        pollingInterval: 10000,
      })
      if (verify) {
        await talentLayerReview.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerReview.address,
          constructorArguments: talentLayerReviewArgs,
        })
      }
      console.log('Reviews contract address:', talentLayerReview.address)

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

      // Deploy TalentLayerEscrow
      const TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrow')
      const talentLayerEscrowArgs: [string, string, string] = [
        serviceRegistry.address,
        talentLayerID.address,
        talentLayerPlatformID.address,
      ]
      const talentLayerEscrow = await TalentLayerEscrow.deploy(...talentLayerEscrowArgs)
      if (verify) {
        await talentLayerEscrow.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerEscrow.address,
          constructorArguments: talentLayerEscrowArgs,
        })
      }
      console.log('TalentLayerEscrow contract address:', talentLayerEscrow.address)

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

      if (usePohmock && mockProofOfHumanity) {
        // Register Alice, Bob, Carol, Dave
        // const mockProofOfHumanity = await ethers.getContractAt('MockProofOfHumanity', "0x78939ABA66D1F73B0D76E9289BA79bc79dC079Dc")
        await mockProofOfHumanity.addSubmissionManually([alice.address, bob.address, carol.address, dave.address])
        console.log('Registered Alice:', alice.address)
        console.log('Registered Bob:', bob.address)
        console.log('Registered Carol:', carol.address)
        console.log('Registered Dave:', dave.address)
      }
    } catch (e) {
      console.log('------------------------')
      console.log('FAILED')
      console.error(e)
      console.log('------------------------')
      return 'FAILED'
    }
  })

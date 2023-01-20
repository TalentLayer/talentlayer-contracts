import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { getConfig, Network, NetworkConfig } from './config'
import { set, ConfigProperty } from '../configManager'

// npx hardhat deploy --use-pohmock --use-test-erc20  --verify --network goerli
task('deploy')
  .addFlag('usePohstrategy', 'deploy a mock of POH')
  .addFlag('useLensstrategy', 'deploy a mock ofLens')
  .addFlag('useTestErc20', 'deploy a mock ERC20 contract')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    try {
      const { verify, usePohstrategy, useTestErc20, useLensstrategy } = args
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

      console.log('\n')
      console.log('*************** Deploy Talent Layer contracts ***************')

      // *************** Deploy Talent Layer contracts *************** //
      //************************************************************** */

      // *********** Deploy TalentLayerPlatformID contract *********** //
      const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
      const talentLayerPlatformID = await TalentLayerPlatformID.deploy()
      if (verify) {
        await talentLayerPlatformID.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerPlatformID.address,
        })
      }
      console.log('TalentLayerPlatformID address:', talentLayerPlatformID.address)

      set(network.name as any as Network, ConfigProperty.TalentLayerPlatformID, talentLayerPlatformID.address)

      // *********** Deploy Talent layer ID contract *********** //
      const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
      const talentLayerIDArgs: [string] = [talentLayerPlatformID.address]
      const talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs)
      if (verify) {
        await talentLayerID.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerID.address,
          constructorArguments: talentLayerIDArgs,
        })
      }
      console.log('talentLayerID address:', talentLayerID.address)

      set(network.name as any as Network, ConfigProperty.TalentLayerID, talentLayerID.address)

      // *********** Deploy Service Registry Contract *********** //
      const ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
      const serviceRegistryArgs: [string, string] = [talentLayerID.address, talentLayerPlatformID.address]
      const serviceRegistry = await ServiceRegistry.deploy(...serviceRegistryArgs)
      if (verify) {
        await serviceRegistry.deployTransaction.wait(5)
        await run('verify:verify', {
          address: serviceRegistry.address,
          constructorArguments: serviceRegistryArgs,
        })
      }
      console.log('Service Registry address:', serviceRegistry.address)
      set(network.name as any as Network, ConfigProperty.ServiceRegistry, serviceRegistry.address)

      // *********** Deploy Review contract *********** //
      const TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
      const talentLayerReviewArgs: [string, string, string, string, string] = [
        'TalentLayer Reviews',
        'TLR',
        talentLayerID.address,
        serviceRegistry.address,
        talentLayerPlatformID.address,
      ]
      const talentLayerReview = await TalentLayerReview.deploy(...talentLayerReviewArgs)
      if (verify) {
        await talentLayerReview.deployTransaction.wait(5)
        await run('verify:verify', {
          address: talentLayerReview.address,
          constructorArguments: talentLayerReviewArgs,
        })
      }
      console.log('Reviews contract address:', talentLayerReview.address)

      set(network.name as any as Network, ConfigProperty.Reviewscontract, talentLayerReview.address)

      // *********** Deploy TalentLayerArbitrator contract *********** //
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

      // *********** Deploy TalentLayerEscrow contract *********** //
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

      // *********** Deploy ERC20 contract *********** //
      if (useTestErc20) {
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

      console.log('\n')
      console.log('*************** Deploy Third Parties Strategies ***************')

      // *************** Deploy Third Parties Strategies *************** //
      //**************************************************************** */
      console.log('==> proof of humanity strategy')
      // *********** Deploy Mock proof of humanity contract *********** //

      if (usePohstrategy) {
        let pohAddress, mockProofOfHumanity, proofOfHumanityID

        if (process.env.DEPLOY_NETWORK === 'mainnet') {
          pohAddress = process.env.POH_MAINNET as string
          set(network.name as any as Network, ConfigProperty.MainnetProofOfHumanity, pohAddress)
          console.log('POH mainnet contract address', pohAddress)
        } else {
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

          // Register Alice, Bob, Carol, Dave
          await mockProofOfHumanity.addSubmissionManually([alice.address, bob.address, carol.address, dave.address])
        }

        // ***********  Deploy Proof of humanity strategy contract *********** //
        const ProofOfHumanityID = await ethers.getContractFactory('ProofOfHumanityID')
        proofOfHumanityID = await ProofOfHumanityID.deploy(pohAddress)

        if (verify) {
          await proofOfHumanityID.deployTransaction.wait(5)
          await run('verify:verify', {
            address: proofOfHumanityID.address,
          })
        }

        const proofOfHumanityIDAddress = proofOfHumanityID.address
        set(network.name as any as Network, ConfigProperty.ProofOfHumanityID, proofOfHumanityID.address)

        // Set POH poh Strategies - STRAT 0
        const setPohStrategy = await talentLayerID.setThirdPartyStrategy(0, proofOfHumanityIDAddress)
        const getPohStrategy = await talentLayerID.getThirdPartyStrategy(0)
        console.log('Proof of Humanity Strategy address', getPohStrategy)
      }

      // *********** Deploy MockLensHub contract *********** //
      console.log('\n')
      console.log('==> Lens strategy')
      if (useLensstrategy) {
        let lensHubAddress
        if (process.env.DEPLOY_NETWORK === 'polygon') {
          lensHubAddress = process.env.LENS_PROXY_POLYGON as string
          set(network.name as any as Network, ConfigProperty.PolygonLensHub, process.env.LENS_PROXY_POLYGON || '')
          console.log('Lens Hub polygon address', lensHubAddress)
        } else if (process.env.DEPLOY_NETWORK === 'mumbai') {
          lensHubAddress = process.env.LENS_PROXY_MUMBAI as string
          set(network.name as any as Network, ConfigProperty.MumbaiLensHub, process.env.LENS_PROXY_MUMBAI || '')
          console.log('Lens Hub mumbai address', lensHubAddress)
        } else {
          const MockLensHub = await ethers.getContractFactory('MockLensHub')
          const mockLensHub = await MockLensHub.deploy()
          lensHubAddress = mockLensHub.address
          set(network.name as any as Network, ConfigProperty.MockLensHub, mockLensHub.address)
          console.log('MockLensHub address:', mockLensHub.address)

          // Register Alice, Bob, Carol, Dave
          await mockLensHub.addLensProfileManually([alice.address, bob.address, carol.address, dave.address])
        }

        // ***********  Deploy LensID strategy contract *********** //
        const LensID = await ethers.getContractFactory('LensID')
        const lensID = await LensID.deploy(lensHubAddress)
        set(network.name as any as Network, ConfigProperty.LensID, lensID.address)
        // Set LensStrategies - STRAT 1
        await talentLayerID.setThirdPartyStrategy(1, lensID.address)
        const getLensStrategy = await talentLayerID.getThirdPartyStrategy(1)
        console.log('LensID Strategy address', getLensStrategy)
      }

      // *********** Grant escrow role to TalentLayerEscrow contract *********** //
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

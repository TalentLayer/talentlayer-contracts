import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { getConfig, Network, NetworkConfig } from './config'

// npx hardhat deploy --use-pohmock --verify --network goerli
task('deploy')
  .addFlag('usePohmock', 'deploy a mock of POH')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    try {
      const { verify, usePohmock } = args
      const [alice, bob, carol, dave] = await ethers.getSigners()
      const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL;
      const networkConfig:NetworkConfig = getConfig(chainId)

      console.log('Network')
      console.log(network.name)
      console.log('Task Args')
      console.log(args)

      console.log('Signer')
      console.log('  at', alice.address)
      console.log('  ETH', formatEther(await alice.getBalance()))
     
      await run('compile')

      let pohAddress, mockProofOfHumanity;
      if(usePohmock){
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
      } else {
        pohAddress = networkConfig.proofOfHumanityAddress
      }

      // Deploy ID contract
      const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
      const talentLayerIDArgs:[string] = [
        pohAddress
      ]
      const talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs)
      if (verify) {
        await talentLayerID.deployTransaction.wait(5)
        await run('verify:verify', {
            address: talentLayerID.address,
            constructorArguments: talentLayerIDArgs,
        })
      }
      console.log('talentLayerID address:', talentLayerID.address)
      
      // Deploy Job Registry Contract
      const JobRegistry = await ethers.getContractFactory('JobRegistry')
      const jobRegistryArgs:[string] = [
        talentLayerID.address
      ]
      const jobRegistry = await JobRegistry.deploy(...jobRegistryArgs)
      if (verify) {
        await jobRegistry.deployTransaction.wait(5)
        await run('verify:verify', {
            address: jobRegistry.address,
            constructorArguments: jobRegistryArgs,
        })
      }
      console.log('Job Registry address:', jobRegistry.address)

      // Deploy Review contract
      const TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
      const talentLayerReviewArgs:[string, string, string, string] = [
        "TalentLayer Reviews",
        "TLR",
        talentLayerID.address,
        jobRegistry.address
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

      // Deploy TalentLayerArbitrator
      const TalentLayerArbitrator = await ethers.getContractFactory("TalentLayerArbitrator");
      const talentLayerArbitratorArgs:[number] = [0]
      const talentLayerArbitrator = await TalentLayerArbitrator.deploy(...talentLayerArbitratorArgs);
      if (verify) {
        await talentLayerArbitrator.deployTransaction.wait(5)
        await run('verify:verify', {
            address: talentLayerArbitrator.address,
            constructorArguments: talentLayerArbitratorArgs,
        })
      }
      console.log('TalentLayerArbitrator contract address:', talentLayerArbitrator.address)

      // Deploy TalentLayerMultipleArbitrableTransaction
      const TalentLayerMultipleArbitrableTransaction = await ethers.getContractFactory("TalentLayerMultipleArbitrableTransaction");
      const talentLayerMultipleArbitrableTransactionArgs:[string, string, any, number] = [
        jobRegistry.address,
        talentLayerArbitrator.address,
        [],
        3600*24*30
      ]
      const talentLayerMultipleArbitrableTransaction = await TalentLayerMultipleArbitrableTransaction.deploy(
        ...talentLayerMultipleArbitrableTransactionArgs
      );
      if (verify) {
        await talentLayerMultipleArbitrableTransaction.deployTransaction.wait(5)
        await run('verify:verify', {
            address: talentLayerMultipleArbitrableTransaction.address,
            constructorArguments: talentLayerMultipleArbitrableTransactionArgs,
        })
      }
      console.log('TalentLayerMultipleArbitrableTransaction contract address:', talentLayerMultipleArbitrableTransaction.address)

      // Grant escrow role 
      const escrowRole = await jobRegistry.ESCROW_ROLE()
      await jobRegistry.grantRole(escrowRole, talentLayerMultipleArbitrableTransaction.address)

      if(usePohmock && mockProofOfHumanity){
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
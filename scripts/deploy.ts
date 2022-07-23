import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

// npx hardhat deploy --base-u-r-i ipfs://CID/ --poh-address 0xa3ebdcaecb63baab11084e4B73B5fAa0d8e14Ac9
task('deploy')
  .addParam('baseURI', 'ipfs Base URI')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    try {
      const { baseURI, verify } = args
      const [alice, bob, carol, dave] = await ethers.getSigners()

      console.log('Network')
      console.log(network.name)
      console.log('Task Args')
      console.log(args)

      console.log('Signer')
      console.log('  at', alice.address)
      console.log('  ETH', formatEther(await alice.getBalance()))
     
      await run('compile')

      // Deploy Mock proof of humanity contract
      const MockProofOfHumanity = await ethers.getContractFactory('MockProofOfHumanity')
      const mockProofOfHumanity = await MockProofOfHumanity.deploy()
      if (verify) {
        await mockProofOfHumanity.deployTransaction.wait(5)
        await run('verify:verify', {
            address: mockProofOfHumanity.address,
        })
      }
      console.log('Mock proof of humanity address:', mockProofOfHumanity.address)

      // Deploy ID contract
      const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
      const talentLayerIDArgs:[string, string] = [
        baseURI,
        mockProofOfHumanity.address
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
            constructorArguments: talentLayerIDArgs,
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

      // Register Alice, Bob, Carol, Dave
      await mockProofOfHumanity.addSubmissionManually([alice.address, bob.address, carol.address, dave.address])
      console.log('Registered Alice:', alice.address)
      console.log('Registered Bob:', bob.address)
      console.log('Registered Carol:', carol.address)
      console.log('Registered Dave:', dave.address)
    } catch (e) {
      console.log('------------------------')
      console.log('FAILED')
      console.error(e)
      console.log('------------------------')
      return 'FAILED'
    }
  })
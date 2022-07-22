import { formatEther } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

// npx hardhat deploy --base-u-r-i ipfs://CID/ --poh-address 0xa3ebdcaecb63baab11084e4B73B5fAa0d8e14Ac9
task('deploy')
  .addParam('baseURI', 'ipfs Base URI')
  .addParam('pohAddress', 'poh contract address')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    try {
      const { baseURI, pohAddress, verify } = args
      const [signer] = await ethers.getSigners()

      console.log('Network')
      console.log(network.name)
      console.log('Task Args')
      console.log(args)

      console.log('Signer')
      console.log('  at', signer.address)
      console.log('  ETH', formatEther(await signer.getBalance()))
     
      await run('compile')
      const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
      const talentLayerIDArgs:[string, string] = [
        baseURI,
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
    } catch (e) {
      console.log('------------------------')
      console.log('FAILED')
      console.error(e)
      console.log('------------------------')
      return 'FAILED'
    }
  })
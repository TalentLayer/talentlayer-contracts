// import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../configManager'
// import { Network } from '../config'

// require("@nomicfoundation/hardhat-toolbox");

// const hre = require('hardhat')

// task('keywords', 'Script for interacting with the keyword registry')
// .addFlag('add', '[Default] Adds the keywords to the registry')
// .addFlag('remove', 'Removes the keywords from the registry')
// .addParam('keywords', 'List of keywords to add or remove')
// .setAction(
//   async (taskArgs, hre) => {
//     console.log("Hello from keywords!")
//     // const network = await hre.network.name
//     // console.log('Create keywords start---------------------')
//     // console.log(network)

//     // const keywordRegistry = await ethers.getContractAt(
//     //   'KeywordRegistry',
//     //   get(network as Network, ConfigProperty.KeywordRegistry),
//     // )

//     // await keywordRegistry.addKeywords(["keyword1", "keyword2", "keyword3"])
    
//   }
// );

// /** @type import('hardhat/config').HardhatUserConfig */
// module.exports = {
//   solidity: "0.8.9",
// };

// require("@nomicfoundation/hardhat-toolbox");

// keywords --rm asdfasdf
// keywords --add asdfasdfasd
// talentlayer --keywords --add keyword1,keyword2,keyword3





task("keywords", "Manage keywords signaling")
.addFlag('add', 'Signals to network to add keywords to the registry')
.addFlag('remove', 'Signals to the network to remove keywords from the registry')
.addPositionalParam('keywords', 'Comma separated string of keywords ex. keyword1,keyword2', types.String)
.setAction(async (taskArgs, { ethers, network }) => {
  const { add, remove, keywords } = taskArgs
  const [deployer] = await ethers.getSigners()

  if(add && remove){
    console.log("--add and --remove are exclusive. Please choose one.")
    return
  }

  if(!add && !remove){
    console.log("Either --add or --remove flag must be set.")
    return
  }

  let keywordRegistry;
  try{
    keywordRegistry = await ethers.getContractAt(
      'KeywordRegistry',
      get((network.name as any) as Network, ConfigProperty.KeywordRegistry),
      deployer
    )
  } catch (e) {
    console.log("Could not find KeywordRegistry. Please make sure that it's deployed to " + network.name + ".")
    console.log("You can specify which network to target using --network <network>")
    console.log(e)
  }


  if(add){
    console.log('Adding keywords...')
    await keywordRegistry.add(keywords)
    // tx.wait()
    console.log('Add keywords event emitted by KeywordRegistry on ' + network.name)
    return
  }

  if(remove){
    console.log('Removing keywords...')
    await keywordRegistry.remove(keywords)
    console.log('Remove keywords event emitted by KeywordRegistry on ' + network.name)
    return
  }
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.9",
};
import { task } from 'hardhat/config'
import { Network } from './config'
import {ConfigProperty, get} from "../configManager";

task("mint-platform-id", "Mints platform Ids to addresses")
  .addParam("name", "The platform's name")
  .addParam("address", "The platform's address")
  .setAction(async (taskArgs, { ethers, network }) => {
    const { name, address } = taskArgs;
    const [deployer] = await ethers.getSigners();

    console.log('network', network.name);

    const platformIdContract = await ethers.getContractAt(
      'TalentLayerPlatformID',
      get(network.name as Network, ConfigProperty.TalentLayerPlatformID),
      deployer)

    const mintRole = await platformIdContract.MINT_ROLE();
    await platformIdContract.grantRole(mintRole, deployer.address);


    const tx = await platformIdContract.mintForAddress(name, address);
      await tx.wait();
      const platformId = await platformIdContract.getPlatformIdFromAddress(address);
    console.log(`Minted platform id: ${platformId} for address ${address}`);
    });
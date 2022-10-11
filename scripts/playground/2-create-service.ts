import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

async function main() {
  const network = await hre.network.name;
  console.log(network);
  console.log("Create service Test start");

  const [alice] = await ethers.getSigners();
  const serviceRegistry = await ethers.getContractAt(
    "ServiceRegistry",
    get(network as Network, ConfigProperty.ServiceRegistry)
  );

  await serviceRegistry.connect(alice).createOpenServiceFromBuyer("ipfs://ssss");
  console.log("Open Service created");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

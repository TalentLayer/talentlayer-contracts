import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

async function main() {
  const network = await hre.network.name;
  console.log(network);

  const [alice, bob, carol] = await ethers.getSigners();
  console.log({ alice: alice.address, bob: bob.address, carol: carol.address });

  const tlID = await ethers.getContractAt(
    "TalentLayerID",
    get(network as Network, ConfigProperty.TalentLayerID)
  );

  console.log(
    `"on ${network} network, the TalentLayerID contract is deployed at ${tlID.address}"`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

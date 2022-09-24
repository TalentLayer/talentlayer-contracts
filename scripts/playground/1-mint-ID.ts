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

  await tlID.connect(alice).mint("alice.lens");
  console.log("alice.lens registered");

  await tlID.connect(bob).mintWithPoh("bob.lens");
  console.log("Bob.lens registered");

  await tlID.connect(carol).mintWithPoh("carol.lens");
  console.log("carol.lens registered");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

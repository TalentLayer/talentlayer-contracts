import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

async function main() {
  const network = await hre.network.name;
  console.log(network);
  console.log("Mint test ID start");

  const [alice, bob, carol, dave] = await ethers.getSigners();
  console.log({
    alice: alice.address,
    bob: bob.address,
    carol: carol.address,
    dave: dave.address,
  });

  const talentLayerIdContract = await ethers.getContractAt(
    "TalentLayerID",
    get(network as Network, ConfigProperty.TalentLayerID)
  );

  const platformIdContrat = await ethers.getContractAt(
    "TalentLayerPlatformID",
    get(network as Network, ConfigProperty.TalentLayerPlatformID)
  );

  // Dave is a TalentLayer Platform and a TalentLayer User
  const daveTalentLayerIdPLatform =
    await platformIdContrat.getPlatformIdFromAddress(dave.address);
  console.log("Dave talentLayerIdPLatform", daveTalentLayerIdPLatform);

  await talentLayerIdContract
    .connect(alice)
    .mint(daveTalentLayerIdPLatform, "alice.lens");
  console.log("alice.lens registered");

  await talentLayerIdContract
    .connect(bob)
    .mintWithPoh(daveTalentLayerIdPLatform, "bob.lens");
  console.log("Bob.lens registered");

  await talentLayerIdContract
    .connect(carol)
    .mintWithPoh(daveTalentLayerIdPLatform, "carol.lens");
  console.log("carol.lens registered");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

async function main() {
  const network = await hre.network.name;
  console.log(network);
  console.log("Mint HireVibes plateform ID start");

  const [alice, bob, carol, dave] = await ethers.getSigners();

  const platformIdContrat = await ethers.getContractAt(
    "TalentLayerPlatformID",
    get(network as Network, ConfigProperty.TalentLayerPlatformID)
  );

  await platformIdContrat.connect(dave).mint("HireVibes");

  const daveTalentLayerIdPLatform =
    await platformIdContrat.getPlatformIdFromAddress(dave.address);
  console.log("Alice talentLayerIdPLatform", daveTalentLayerIdPLatform);

  await platformIdContrat
    .connect(dave)
    .updateProfileData(daveTalentLayerIdPLatform, "newCid");

  const platformName = await platformIdContrat.names(daveTalentLayerIdPLatform);
  const platformCid = await platformIdContrat.platformUri(
    daveTalentLayerIdPLatform
  );

  console.log("platformName", platformName);
  console.log("platformName", platformCid);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

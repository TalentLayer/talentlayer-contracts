import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

async function main() {
  const network = await hre.network.name;
  console.log(network);
  console.log("Mint HireVibes plateform ID start");

  const [alice] = await ethers.getSigners();

  const platformIdContrat = await ethers.getContractAt(
    "TalentLayerPlatformID",
    get(network as Network, ConfigProperty.TalentLayerPlatformID)
  );

  await platformIdContrat.connect(alice).mint("HireVibes");

  const aliceTalentLayerIdPLatform =
    await platformIdContrat.getPlatformIdFromAddress(alice.address);
  console.log("Alice talentLayerIdPLatform", aliceTalentLayerIdPLatform);

  await platformIdContrat
    .connect(alice)
    .updateProfileData(aliceTalentLayerIdPLatform, "newCid");

  const platformName = await platformIdContrat.names(
    aliceTalentLayerIdPLatform
  );
  const platformCid = await platformIdContrat.platformUri(
    aliceTalentLayerIdPLatform
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

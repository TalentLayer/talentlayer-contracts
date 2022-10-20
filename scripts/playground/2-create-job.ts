import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");
import postToIPFS from "../ipfs";

async function main() {
  const network = await hre.network.name;
  console.log(network);
  console.log("Create job Test start");

  const [alice, bob, carol, dave] = await ethers.getSigners();
  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    get(network as Network, ConfigProperty.JobRegistry)
  );

  const platformIdContrat = await ethers.getContractAt(
    "TalentLayerPlatformID",
    get(network as Network, ConfigProperty.TalentLayerPlatformID)
  );

  const daveTalentLayerIdPLatform =
    await platformIdContrat.getPlatformIdFromAddress(dave.address);
  console.log("Dave talentLayerIdPLatform", daveTalentLayerIdPLatform);

  const aliceCreateJobData = await postToIPFS(
    JSON.stringify({
      title: "Full Stack Developer Job",
      about: "Looking for Full Stack Developer",
      keywords: "BlockChain",
      role: "developer",
      rateToken: "0x00",
      rateAmount: 1,
      recipient: "0x00",
    })
  );

  console.log("AliceJobDataUri", aliceCreateJobData);

  await jobRegistry
    .connect(alice)
    .createOpenJobFromEmployer(daveTalentLayerIdPLatform, aliceCreateJobData);
  console.log("Open Job created");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

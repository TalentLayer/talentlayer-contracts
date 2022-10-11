import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

// Then Alice create a service, and others add proposals
async function main() {
  const network = await hre.network.name;
  console.log(network);

  const [alice, bob, carol, dave] = await ethers.getSigners();
  const serviceRegistry = await ethers.getContractAt(
    "ServiceRegistry",
    get(network as Network, ConfigProperty.ServiceRegistry)
  );

  let serviceId = await serviceRegistry.nextServiceId();
  serviceId = serviceId.sub(1);
  console.log("serviceId", serviceId.toString());

  //Bob make a proposal
  const rateTokenBob = "0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10";
  await serviceRegistry
    .connect(bob)
    .createProposal(serviceId, rateTokenBob, 10, "ipfs://bob");

  //Carol make a proposal
  // const rateTokenCarol = "0xba401cdac1a3b6aeede21c9c4a483be6c29f88c5";
  const rateTokenCarol = "0x0000000000000000000000000000000000000000";
  await serviceRegistry
    .connect(carol)
    .createProposal(serviceId, rateTokenCarol, 200, "ipfs://carol");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

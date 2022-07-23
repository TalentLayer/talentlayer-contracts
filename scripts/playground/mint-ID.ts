import { ethers } from "hardhat";

async function main() {
  const [alice, bob, carol, dave] = await ethers.getSigners()
  const tlID = await ethers.getContractAt('TalentLayerID', "0x25DFc905884be839eCF2dE0e760C28BA6B8070e6")
  tlID.connect(bob).mintWithPoh("bob.lens")
  console.log("Bob.lens registered");
  tlID.connect(carol).mintWithPoh("carol.lens")
  console.log("carol.lens registered");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
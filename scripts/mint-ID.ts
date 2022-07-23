import { ethers } from "hardhat";

async function main() {
  const [alice, bob, carol, dave] = await ethers.getSigners()
  const tlID = await ethers.getContractAt('TalentLayerID', "0x931dA829f06c02fCD683a9153bBD40EF7Ce1E907")
  tlID.connect(bob).mintWithPoh("bob.lens")


  console.log("Bob.lens registered");

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
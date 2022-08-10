import { ethers } from "hardhat";

async function main() {

  const tlId = await ethers.getContractAt('TalentLayerID', "0x45Cd9E9C04d0701b23089C44Faa807932996717E")


  const [alice, bob, carol, dave, eve, frank, grace, heidi] = await ethers.getSigners()
  const tokenId = await tlId.walletOfOwner(grace.address)
  await tlId.connect(grace).activatePoh(tokenId)
  console.log("Linked TalentLayer ID to PoH", tokenId)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
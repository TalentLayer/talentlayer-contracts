import { ethers } from "hardhat";

async function main() {

  const ProofOfHumanity = await ethers.getContractFactory("MockProofOfHumanity");
  const proofOfHumanity = await ProofOfHumanity.deploy();

  // await proofOfHumanity.deployed();
  // console.log("Proof of humanity deployed to:", proofOfHumanity.address);
  const mockProofOfHumanity = await ethers.getContractAt('MockProofOfHumanity', "0xc7729F499f3D81643597a1e1666E9b6F8D702F8D")


  const [signer] = await ethers.getSigners()
  await proofOfHumanity.addSubmissionManually(
    [signer.address],
  )
  console.log("Added user to PoH Registry:", signer.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
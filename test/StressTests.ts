import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract, ContractFactory } from "ethers";

describe("Stress tests", function () {
	let deployer: SignerWithAddress,
		alice: SignerWithAddress,
		bob: SignerWithAddress,
		platform: SignerWithAddress,
		ServiceRegistry: ContractFactory,
		MockProofOfHumanity: ContractFactory,
		TalentLayerPlatformID: ContractFactory,
		TalentLayerID: ContractFactory,
		serviceRegistry: Contract,
		mockProofOfHumanity: Contract,
		talentLayerPlatformID: Contract,
		talentLayerID: Contract,
		platformId: string,
		platformName: string;


	before(async function () {
		[deployer, alice, bob, platform] = await ethers.getSigners();

		// Deploy MockProofOfHumanity
		MockProofOfHumanity = await ethers.getContractFactory(
	      "MockProofOfHumanity"
	    );
	    mockProofOfHumanity = await MockProofOfHumanity.deploy();
	    // mockProofOfHumanity.addSubmissionManually([alice.address, bob.address]);

	    // Deploy PlatformId
	    TalentLayerPlatformID = await ethers.getContractFactory(
	      "TalentLayerPlatformID"
	    );
	    talentLayerPlatformID = await TalentLayerPlatformID.deploy();

	    // Deploy TalenLayerID
	    TalentLayerID = await ethers.getContractFactory("TalentLayerID");
	    const talentLayerIDArgs: [string, string] = [
	      mockProofOfHumanity.address,
	      talentLayerPlatformID.address,
	    ];
	    talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs);

		// Deploy service registry
		ServiceRegistry = await ethers.getContractFactory("ServiceRegistry");
	    const serviceRegistryArgs: [string, string] = [
	      talentLayerID.address,
	      talentLayerPlatformID.address,
	    ];
	    serviceRegistry = await ServiceRegistry.deploy(...serviceRegistryArgs);

	    // Grant Platform Id Mint role to Alice
	   	const mintRole = await talentLayerPlatformID.MINT_ROLE();
	    await talentLayerPlatformID.connect(deployer).grantRole(
		    mintRole,
		    platform.address);

	    // platform mints a Platform Id
	    platformName ='HireVibes';
	    await talentLayerPlatformID.connect(platform).mint(platformName);
	});

	describe("Service mass registration", function () {
		it("Creates 1000 services with 40 proposals each", async function () {
			
		});
	});
});
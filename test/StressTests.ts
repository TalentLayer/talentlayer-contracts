import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
import { Contract, ContractFactory } from "ethers";

describe("Stress tests", function () {
	let deployer: SignerWithAddress,
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
		signers: SignerWithAddress[];

	const AMOUNT_OF_SERVICES_PER_BUYER: number = 2,
		AMOUNT_OF_BUYERS: number = 10,
		AMOUNT_OF_SERVICES: number = AMOUNT_OF_BUYERS * AMOUNT_OF_SERVICES_PER_BUYER,
		AMOUNT_OF_PROPOSALS_PER_SELLER: number = AMOUNT_OF_SERVICES,
		AMOUNT_OF_SELLERS: number = 10,
		AMOUNT_OF_PROPOSALS: number = AMOUNT_OF_PROPOSALS_PER_SELLER * AMOUNT_OF_SELLERS,
		AMOUNT_OF_SIGNERS: number = AMOUNT_OF_BUYERS + AMOUNT_OF_SELLERS,
		TOKEN: string = "0x0000000000000000000000000000000000000000",
		VALUE: number = 10,
		MOCK_DATA: string = "mock_data";


	before(async function () {
		signers = await ethers.getSigners();
		deployer = signers[0];
		platform = signers[1];
		signers = signers.slice(2);
		
		// Deploy MockProofOfHumanity
		MockProofOfHumanity = await ethers.getContractFactory(
			"MockProofOfHumanity"
		);
		mockProofOfHumanity = await MockProofOfHumanity.deploy();

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
		await talentLayerPlatformID.connect(platform).mint("someName");
		platformId = await talentLayerPlatformID.connect(platform)
				.getPlatformIdFromAddress(platform.address);
	});

	describe("Creating " + AMOUNT_OF_SIGNERS + " TalentLayerIDs", async function () {
		it(AMOUNT_OF_SIGNERS + " TalentLayerIDs minted", async function () {
			for(var i = 0; i < AMOUNT_OF_SIGNERS; i++){
				await expect(await mockProofOfHumanity.addSubmissionManually([signers[i].address])
				).to.not.be.reverted;
				await expect(await talentLayerID.connect(signers[i])
					.mintWithPoh(platformId, "handle_" + i)
				).to.not.be.reverted;

			}
		});		
	});

	describe("Creating " + AMOUNT_OF_SERVICES + " services", async function() {
		const createServices = (signerIndex: number) =>
			async function () {
				for(var i = 0; i < AMOUNT_OF_SERVICES_PER_BUYER; i++){
					await expect(
						await serviceRegistry.connect(signers[signerIndex])
						.createOpenServiceFromBuyer(platformId, MOCK_DATA + "_" + i)
					).to.emit(serviceRegistry, "ServiceCreated");
				}
			};

		for(var signerIndex = 0; signerIndex < AMOUNT_OF_BUYERS; signerIndex++){
			it("Signer " + signerIndex + " created " + AMOUNT_OF_SERVICES_PER_BUYER + " services", createServices(signerIndex));
		}
	});

	describe("Creating " + AMOUNT_OF_PROPOSALS + " proposals", async function () {
		const createProposals = (signerIndex:number) =>
			async function () {
				for(var serviceId = 1; serviceId <= AMOUNT_OF_SERVICES; serviceId++){
					await expect(
						await serviceRegistry.connect(signers[signerIndex])
						.createProposal(serviceId, TOKEN, VALUE, MOCK_DATA)
					).to.emit(serviceRegistry, "ProposalCreated");
				}
			};

		for(var i = 0; i < AMOUNT_OF_SELLERS; i++){
			var signerIndex = AMOUNT_OF_BUYERS + i;
			it("Signer " + signerIndex + " created " + AMOUNT_OF_PROPOSALS_PER_SELLER + " proposals", createProposals(signerIndex));
		}
	});
});
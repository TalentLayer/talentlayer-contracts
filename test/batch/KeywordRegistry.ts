import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract, ContractFactory } from 'ethers'

describe('TalentLayer', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    ServiceRegistry: ContractFactory,
    TalentLayerID: ContractFactory,
    TalentLayerPlatformID: ContractFactory,
    MockProofOfHumanity: ContractFactory,
    KeywordRegistry: ContractFactory,
    serviceRegistry: Contract,
    talentLayerID: Contract,
    talentLayerPlatformID: Contract,
    mockProofOfHumanity: Contract,
    keywordRegistry: Contract,
    platformName: string,
    platformId: string;

  before(async function () {
    [deployer, alice, bob] = await ethers.getSigners()

    // Deploy MockProofOfHumanity
    MockProofOfHumanity = await ethers.getContractFactory('MockProofOfHumanity')
    mockProofOfHumanity = await MockProofOfHumanity.deploy()
    mockProofOfHumanity.addSubmissionManually([alice.address, bob.address])

    // Deploy PlatformId
    TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
    talentLayerPlatformID = await TalentLayerPlatformID.deploy()

    // Deploy TalenLayerID
    TalentLayerID = await ethers.getContractFactory('TalentLayerID')
    const talentLayerIDArgs: [string, string] = [mockProofOfHumanity.address, talentLayerPlatformID.address]
    talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs)

    // Deploy ServiceRegistry
    ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
    const serviceRegistryArgs: [string, string] = [talentLayerID.address, talentLayerPlatformID.address]
    serviceRegistry = await ServiceRegistry.deploy(...serviceRegistryArgs)

    // Grant Platform Id Mint role to Alice
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, alice.address)

    // Alice mints a Platform Id
    platformName = 'HireVibes'
    await talentLayerPlatformID.connect(alice).mint(platformName)

    KeywordRegistry = await ethers.getContractFactory('KeywordRegistry')
    keywordRegistry = await KeywordRegistry.deploy()
  })
  
  describe('Keyword registry unit tests', async function () {
    it("Adding new keywords emits an event", async function () {
      await expect(await keywordRegistry.add("solidity,typescript,rust"))
      .to.emit(keywordRegistry, "KeywordsAdded")
      .withArgs("solidity,typescript,rust")
    });

    it("Removing keywords emits an event", async function () {
      await expect(await keywordRegistry.remove("typescript,rust"))
      .to.emit(keywordRegistry, "KeywordsRemoved")
      .withArgs("typescript,rust")
    });

    it("Only the owner can add keywords", async function () {
      await expect(keywordRegistry.connect(alice).add("c++,clojure"))
      .to.be.revertedWith("Ownable: caller is not the owner")
    });

    it("Only the owner can remove keywords", async function () {
      await expect(keywordRegistry.connect(alice).remove("solidity,typescript"))
      .to.be.revertedWith("Ownable: caller is not the owner")
    });
  });
})

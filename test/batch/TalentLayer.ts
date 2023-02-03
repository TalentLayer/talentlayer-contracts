import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber, Contract, ContractFactory } from 'ethers'
import { TalentLayerID } from '../../typechain-types'

describe('TalentLayer', function () {
  // we dedine the types of the variables we will use
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    eve: SignerWithAddress,
    frank: SignerWithAddress,
    lili: SignerWithAddress,
    ServiceRegistry: ContractFactory,
    TalentLayerID: ContractFactory,
    TalentLayerPlatformID: ContractFactory,
    TalentLayerReview: ContractFactory,
    TalentLayerEscrow: ContractFactory,
    TalentLayerArbitrator: ContractFactory,
    ProofOfHumanityID: ContractFactory,
    MockProofOfHumanity: ContractFactory,
    SimpleERC20: ContractFactory,
    LensID: ContractFactory,
    MockLensHub: ContractFactory,
    serviceRegistry: Contract,
    talentLayerID: Contract,
    talentLayerPlatformID: Contract,
    talentLayerReview: Contract,
    talentLayerEscrow: Contract,
    talentLayerArbitrator: Contract,
    mockProofOfHumanity: Contract,
    proofOfHumanityID: Contract,
    lensID: Contract,
    mockLensHub: Contract,
    token: Contract,
    platformName: string,
    platformId: string,
    mintFee: number

  before(async function () {
    // Get the Signers
    ;[deployer, alice, bob, carol, dave, eve, frank, lili] = await ethers.getSigners()

    // *********** Deploy PlatformId ***********
    TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
    talentLayerPlatformID = await TalentLayerPlatformID.deploy()

    // *********** Deploy TalenLayerID ***********
    TalentLayerID = await ethers.getContractFactory('TalentLayerID')
    const talentLayerIDArgs: [string] = [talentLayerPlatformID.address]
    talentLayerID = (await TalentLayerID.deploy(...talentLayerIDArgs)) as TalentLayerID

    // *********** Deploy ServiceRegistry ***********
    ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
    const serviceRegistryArgs: [string, string] = [talentLayerID.address, talentLayerPlatformID.address]
    serviceRegistry = await ServiceRegistry.deploy(...serviceRegistryArgs)

    // *********** Deploy TalentLayerReview ***********
    TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
    const talentLayerReviewArgs: [string, string, string, string, string] = [
      'TalentLayer Review',
      'TLR',
      talentLayerID.address,
      serviceRegistry.address,
      talentLayerPlatformID.address,
    ]
    talentLayerReview = await TalentLayerReview.deploy(...talentLayerReviewArgs)

    // *********** Deploy TalentLayerArbitrator ***********
    TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
    talentLayerArbitrator = await TalentLayerArbitrator.deploy(talentLayerPlatformID.address)

    // ***********  Deploy TalentLayerEscrow ***********
    TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrow')
    talentLayerEscrow = await TalentLayerEscrow.deploy(
      serviceRegistry.address,
      talentLayerID.address,
      talentLayerPlatformID.address,
    )

    // *********** Deploy SimpleERC20 Token ***********
    SimpleERC20 = await ethers.getContractFactory('SimpleERC20')
    token = await SimpleERC20.deploy()

    // *********** Deploy MockProofOfHumanity & ProofOfHumanity strategy ***********
    // Deploy Mock Proof Of humanity
    MockProofOfHumanity = await ethers.getContractFactory('MockProofOfHumanity')
    mockProofOfHumanity = await MockProofOfHumanity.deploy()
    const mockPohAddress = mockProofOfHumanity.address

    // Deploy ProofOfHumanityID strategy contract and setup strategy
    ProofOfHumanityID = await ethers.getContractFactory('ProofOfHumanityID')
    proofOfHumanityID = await ProofOfHumanityID.deploy(mockPohAddress)
    const proofOfHumanityIDStrategy = proofOfHumanityID.address

    await talentLayerID.setThirdPartyStrategy(0, proofOfHumanityIDStrategy)
    await talentLayerID.getThirdPartyStrategy(0)

    mockProofOfHumanity.addSubmissionManually([bob.address, frank.address])

    // *********** Deploy Mock & LensID contract and setup strategy ***********
    // Deploy Mock LensHub
    MockLensHub = await ethers.getContractFactory('MockLensHub')
    mockLensHub = await MockLensHub.deploy()

    // Deploy LensID contract and setup strategy
    LensID = await ethers.getContractFactory('LensID')
    lensID = await LensID.deploy(mockLensHub.address)
    const lensIDStrategy = lensID.address

    mockLensHub.addLensProfileManually([
      deployer.address, // id 0
      alice.address, // id 1
      bob.address, // id 2
      carol.address, // id 3
      dave.address, // id 4
      eve.address, // id 5
      frank.address, // id 6
      //lili.address - lili is not register in Lens
    ])
    // Setup Lens strategy
    await talentLayerID.setThirdPartyStrategy(1, lensIDStrategy)
    await talentLayerID.getThirdPartyStrategy(1)

    // ==> We check if both strategies are set
    const pohStrategies0 = await talentLayerID.getThirdPartyStrategy(0)
    const lensStrategies1 = await talentLayerID.getThirdPartyStrategy(1)

    // *********** Grant escrow role to TalentLayerEscrow ***********
    const escrowRole = await serviceRegistry.ESCROW_ROLE()
    await serviceRegistry.grantRole(escrowRole, talentLayerEscrow.address)

    // *********** Grant Platform Id Mint role to Deployer and Bob ***********
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, bob.address)

    // ***********  Deployer mints Platform Id for Alice ***********
    platformName = 'HireVibes'
    await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, alice.address)
    mintFee = 100
  })

  // *************** Talent Layer PLatform Id tests *************** //
  //**************************************************************** */

  describe('Platform Id contract test', async function () {
    it('Alice successfully minted a PlatformId Id', async function () {
      platformId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address)
      expect(platformId).to.be.equal('1')
    })

    it('Alice can check the number of id minted', async function () {
      await talentLayerPlatformID.connect(alice).numberMinted(alice.address)
      expect(await talentLayerPlatformID.numberMinted(alice.address)).to.be.equal('1')
    })

    it('Alice can update the platform Data', async function () {
      await talentLayerPlatformID.connect(alice).updateProfileData('1', 'newPlatId')

      const aliceUserId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address)
      const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
      expect(alicePlatformData.dataUri).to.be.equal('newPlatId')
    })

    it('Alice should not be able to transfer her PlatformId Id to Bob', async function () {
      expect(talentLayerPlatformID.transferFrom(alice.address, bob.address, 1)).to.be.revertedWith('Not allowed')
    })

    it('Alice should not be able to mint a new PlatformId ID', async function () {
      expect(talentLayerPlatformID.connect(alice).mint('SecPlatId')).to.be.revertedWith(
        'You already have a Platform ID',
      )
    })

    it("ALice can't mint a platformId for someone else", async function () {
      const mintRole = await talentLayerPlatformID.MINT_ROLE()
      expect(talentLayerPlatformID.connect(alice).mintForAddress('platId2', dave.address)).to.be.revertedWith(
        `Error: VM Exception while processing transaction: reverted with reason string 'AccessControl: account ${alice.address.toLowerCase()} is missing role ${mintRole.toLowerCase()}'`,
      )
    })

    it('Alice should not be able to mint a PlatformId ID with the same name', async function () {
      expect(talentLayerPlatformID.connect(alice).mint('PlatId')).to.be.revertedWith('You already have a Platform ID')
    })

    it("Alice's PlatformID ownership data is coherent", async function () {
      const aliceUserId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address)
      const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
      const name = alicePlatformData.name
      const isNameTaken = await talentLayerPlatformID.takenNames(platformName)
      const idOwner = await talentLayerPlatformID.ownerOf(platformId)
      expect(platformName).to.equal(name)
      expect(isNameTaken).to.equal(true)
      expect(platformName).to.equal(platformName)
      expect(idOwner).to.equal(alice.address)
    })

    it('Alice should be able to set up and update platform fee', async function () {
      const aliceUserId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address)
      const adminRole = await talentLayerPlatformID.DEFAULT_ADMIN_ROLE()

      await talentLayerPlatformID.grantRole(adminRole, alice.address)
      await talentLayerPlatformID.connect(alice).updatePlatformFee(aliceUserId, 1)

      const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
      expect(alicePlatformData.fee).to.be.equal(1)

      await talentLayerPlatformID.connect(alice).updatePlatformFee(aliceUserId, 6)

      const newAlicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
      expect(newAlicePlatformData.fee).to.be.equal(6)
    })

    it('The deployer can update the mint fee', async function () {
      await talentLayerPlatformID.connect(deployer).updateMintFee(mintFee)
      const updatedMintFee = await talentLayerPlatformID.mintFee()

      expect(updatedMintFee).to.be.equal(mintFee)
    })

    it('Bob can mint a platform id by paying the mint fee', async function () {
      const bobBalanceBefore = await bob.getBalance()
      const contractBalanceBefore = await ethers.provider.getBalance(talentLayerPlatformID.address)

      // Mint fails if not enough ETH is sent
      expect(talentLayerPlatformID.connect(bob).mint('BobPlat')).to.be.revertedWith(
        'Incorrect amount of ETH for mint fee',
      )

      // Mint is successful if the correct amount of ETH for mint fee is sent
      await talentLayerPlatformID.connect(bob).mint('BobPlat', { value: mintFee })
      const bobPlatformId = await talentLayerPlatformID.getPlatformIdFromAddress(bob.address)
      expect(bobPlatformId).to.be.equal('2')

      // Bob balance is decreased by the mint fee (+ gas fees)
      const bobBalanceAfter = await bob.getBalance()
      expect(bobBalanceAfter).to.be.lte(bobBalanceBefore.sub(mintFee))

      // Platform id contract balance is increased by the mint fee
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerPlatformID.address)
      expect(contractBalanceAfter).to.be.equal(contractBalanceBefore.add(mintFee))
    })

    it("The deployer can withdraw the contract's balance", async function () {
      const deployerBalanceBefore = await deployer.getBalance()
      const contractBalanceBefore = await ethers.provider.getBalance(talentLayerPlatformID.address)

      // Withdraw fails if the caller is not an admin
      expect(talentLayerPlatformID.connect(bob).withdraw()).to.be.revertedWith('Ownable: caller is not the owner')

      // Withdraw is successful if the caller is the deployer
      const tx = await talentLayerPlatformID.connect(deployer).withdraw()
      const receipt = await tx.wait()
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

      const deployerBalanceAfter = await deployer.getBalance()
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerPlatformID.address)

      // Deployer balance is increased by the contract balance (- gas fees)s
      expect(deployerBalanceAfter).to.be.equal(deployerBalanceBefore.add(contractBalanceBefore).sub(gasUsed))

      // Contract balance is 0
      expect(contractBalanceAfter).to.be.equal(0)
    })

    it('The deployer can add a new available arbitrator', async function () {
      await talentLayerPlatformID.connect(deployer).addArbitrator(talentLayerArbitrator.address, true)
      const isValid = await talentLayerPlatformID.validArbitrators(talentLayerArbitrator.address)
      expect(isValid).to.be.true

      const isInternal = await talentLayerPlatformID.internalArbitrators(talentLayerArbitrator.address)
      expect(isInternal).to.be.true
    })

    it('The platform owner can update the arbitrator only if is a valid one', async function () {
      const tx = talentLayerPlatformID.connect(alice).updateArbitrator(1, dave.address, [])
      expect(tx).to.be.revertedWith('The address must be of a valid arbitrator')

      await talentLayerPlatformID.connect(alice).updateArbitrator(1, talentLayerArbitrator.address, [])
      const arbitrator = (await talentLayerPlatformID.getPlatform(1)).arbitrator
      expect(arbitrator).to.be.equal(talentLayerArbitrator.address)

      // Extra data is updated and is equal to the platform id since the arbitrator is internal
      const arbitratorExtraData = (await talentLayerPlatformID.getPlatform(1)).arbitratorExtraData
      const platformId = BigNumber.from(arbitratorExtraData)
      expect(platformId).to.be.equal(1)
    })

    it('The platform owner can update the arbitration fee timeout', async function () {
      const timeout = 3600 * 24
      const tx = talentLayerPlatformID.connect(alice).updateArbitrationFeeTimeout(1, timeout - 1)
      expect(tx).to.be.revertedWith('The timeout must be greater than the minimum timeout')

      await talentLayerPlatformID.connect(alice).updateArbitrationFeeTimeout(1, timeout)
      const arbitrationFeeTimeout = (await talentLayerPlatformID.getPlatform(1)).arbitrationFeeTimeout
      expect(arbitrationFeeTimeout).to.be.equal(timeout)
    })

    it('Only the owner of the platform can update its arbitrator', async function () {
      const tx = talentLayerPlatformID.connect(bob).updateArbitrator(1, talentLayerArbitrator.address, [])
      expect(tx).to.be.revertedWith("You're not the owner of this platform")
    })

    it('The deployer can remove an available arbitrator', async function () {
      await talentLayerPlatformID.connect(deployer).removeArbitrator(talentLayerArbitrator.address)
      const isValid = await talentLayerPlatformID.validArbitrators(talentLayerArbitrator.address)
      expect(isValid).to.be.false

      const isInternal = await talentLayerPlatformID.internalArbitrators(talentLayerArbitrator.address)
      expect(isInternal).to.be.false
    })
  })

  // *************** Talent Layer ID  tests *************** //
  //********************************************************/

  describe('Talent Layer ID contract test', function () {
    // Alice and Carol can mint a TlID  with Lens ID and Bob with POh ID
    it('Alice, Bob and Carol can mint a talentLayerId with Lens strategies', async function () {
      await talentLayerID.connect(alice).mint('1', 'alice', [1]) // Lens strategy 1
      await talentLayerID.connect(bob).mint('1', 'bob', [0]) // Poh strategy 0
      await talentLayerID.connect(carol).mint('1', 'carol', [1]) // Lens strategy 1

      expect(await talentLayerID.walletOfOwner(alice.address)).to.be.equal('1')
      expect(await talentLayerID.walletOfOwner(bob.address)).to.be.equal('2')
      expect(await talentLayerID.walletOfOwner(carol.address)).to.be.equal('3')
      const carolUserId = await talentLayerID.walletOfOwner(carol.address)
      const profileData = await talentLayerID.profiles(carolUserId)
      expect(profileData.platformId).to.be.equal('1')
    })

    // Lili should not be able to mint a TlID with Lens ID as she is not registered on Lens
    it('IsRegisted should revert as Lili is not registerd on Lens', async function () {
      expect(lensID.isRegistered(lili.address)).to.be.revertedWith('User not registered')
    })

    it('Lili cannot mint a TalentLayer ID with the Lens strategie', async function () {
      // we check if lili is registered on Lens
      expect(await lensID.isRegistered(lili.address)).to.deep.equal([false, '0x'])

      expect(talentLayerID.connect(lili).mint('1', 'lili', [1])).to.be.revertedWith(
        'You need to use an address registered on the selected third party platform',
      )
    })

    // ROMAIN - this test should not work if i change something
    it('Carol should not be able to activate POH strat as she is not registered', async function () {
      // We get the carol talentLayerID
      const carolUserId = await talentLayerID.walletOfOwner(carol.address)

      await expect(talentLayerID.connect(carol).associateThirdPartiesIDs(carolUserId, [0])).to.be.revertedWith(
        'You need to use an address registered on the selected third party platform',
      )
    })

    it('Carol should be registered on POH', async function () {
      mockProofOfHumanity.addSubmissionManually([carol.address])
      await proofOfHumanityID.isRegistered(carol.address)
      const carolAddress = ethers.utils.defaultAbiCoder.encode(['address'], [carol.address])
      expect(await proofOfHumanityID.isRegistered(carol.address)).to.deep.equal([true, carolAddress])
    })

    it('Carol can now associate her Tlid and her POH id (address)', async function () {
      // she can now activate POH on her talentLayerID
      const carolUserId = await talentLayerID.walletOfOwner(carol.address)
      await talentLayerID.connect(carol).associateThirdPartiesIDs(carolUserId, [0])

      const carolAddress = carol.address.toLocaleLowerCase()
      const thirdPartyCarolPohId = await talentLayerID.getThirdPartyId(carolUserId, 0)

      expect(await thirdPartyCarolPohId).to.be.equal(carolAddress)
    })

    it('The deployer can update the mint fee', async function () {
      await talentLayerID.connect(deployer).updateMintFee(mintFee)
      const updatedMintFee = await talentLayerID.mintFee()

      expect(updatedMintFee).to.be.equal(mintFee)
    })

    it('Eve can mint a talentLayerId without strategies and by paying the mint fee', async function () {
      const eveBalanceBefore = await eve.getBalance()
      const contractBalanceBefore = await ethers.provider.getBalance(talentLayerID.address)

      // Mint fails if not enough ETH is sent
      expect(talentLayerID.connect(eve).mint('1', 'eve', [])).to.be.revertedWith('Incorrect amount of ETH for mint fee')

      // Mint is successful if the correct amount of ETH for mint fee is sent
      await talentLayerID.connect(eve).mint('1', 'eve', [], { value: mintFee })
      expect(await talentLayerID.walletOfOwner(eve.address)).to.be.equal('4')

      // Eve balance is decreased by the mint fee (+ gas fees)
      const eveBalanceAfter = await eve.getBalance()
      expect(eveBalanceAfter).to.be.lte(eveBalanceBefore.sub(mintFee))

      // TalentLayer id contract balance is increased by the mint fee
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerID.address)
      expect(contractBalanceAfter).to.be.equal(contractBalanceBefore.add(mintFee))
    })

    it("The deployer can withdraw the contract's balance", async function () {
      const deployerBalanceBefore = await deployer.getBalance()
      const contractBalanceBefore = await ethers.provider.getBalance(talentLayerID.address)

      // Withdraw fails if the caller is not the owner
      expect(talentLayerID.connect(alice).withdraw()).to.be.revertedWith('Ownable: caller is not the owner')

      // Withdraw is successful if the caller is the owner
      const tx = await talentLayerID.connect(deployer).withdraw()
      const receipt = await tx.wait()
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

      const deployerBalanceAfter = await deployer.getBalance()
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerID.address)

      // Deployer balance is increased by the contract balance (- gas fees)s
      expect(deployerBalanceAfter).to.be.equal(deployerBalanceBefore.add(contractBalanceBefore).sub(gasUsed))

      // Contract balance is 0
      expect(contractBalanceAfter).to.be.equal(0)
    })

    // frank can't mint a TalentLayerId with a wrong Strategy Id
    it('frank cant mint a TalentLayerId with a wrong strategy Id', async function () {
      const strategiesID = [3]
      expect(talentLayerID.connect(frank).mint('1', 'frank', strategiesID, { value: mintFee })).to.be.revertedWith(
        'Invalid strategy ID',
      )
    })

    // frank can mint a TalentLayerId with an POH Id as he is registered on POH
    it('frank can mint a talentLayerId linked to an POH Id and the event is well emitted', async function () {
      const strategiesID = [0]
      // Frank mint his TalentLayerId with an external Id with fee
      const mint = await talentLayerID.connect(frank).mint('1', 'frank', strategiesID, { value: mintFee })

      const frankUserId = await talentLayerID.walletOfOwner(frank.address)
      expect(await talentLayerID.walletOfOwner(frank.address)).to.be.equal(frankUserId)

      const thirdPartyId = await talentLayerID.getThirdPartyId(frankUserId, strategiesID)
      const frankIdAddress = frank.address.toLocaleLowerCase()
      expect(thirdPartyId).to.be.equal(frankIdAddress)

      // we check if the event is well emitted
      await expect(mint).to.emit(talentLayerID, 'ThirdPartyLinked').withArgs(frankUserId, strategiesID[0], thirdPartyId)
    })

    // we check if Frank Lens registering return the right data
    it('we check if Frank registered return the right data', async function () {
      const frankIdBytes = ethers.utils.defaultAbiCoder.encode(['uint256'], [6])
      const frankIsRegisteredData = await lensID.isRegistered(frank.address)
      await expect(frankIsRegisteredData[0]).to.be.equal(true)
      await expect(frankIsRegisteredData[1]).to.be.equal(frankIdBytes)
    })

    // Alice can't mint a TalentLayerId with a wrong External Id
    it('lili cant mint a TalentLayerId with a wrong External strategy Id', async function () {
      const strategiesID = [1]
      expect(talentLayerID.connect(lili).mint('1', 'lili', strategiesID, { value: mintFee })).to.be.revertedWith(
        'User not registered',
      )
    })

    // Alice can link an external Id to her TalentLayerId
    it('Alice can link her Lens Id to her TalentLayerId', async function () {
      const strategiesID = 1
      const aliceUserId = await talentLayerID.walletOfOwner(alice.address)
      const linkToThirdPartiesId = await talentLayerID.connect(alice).associateThirdPartiesIDs(aliceUserId, [1])
      const thirdPartyId = await talentLayerID.getThirdPartyId(aliceUserId, 1)
      const aliceIdBytes = ethers.utils.defaultAbiCoder.encode(['uint256'], [1])

      // Alice is registered on Lens
      const AliceIsRegisteredData = await lensID.isRegistered(alice.address)

      expect(thirdPartyId).to.be.equal(aliceIdBytes)
      // we check if the event is well emitted
      await expect(linkToThirdPartiesId)
        .to.emit(talentLayerID, 'ThirdPartyLinked')
        .withArgs(aliceUserId, strategiesID, thirdPartyId)
    })
  })

  // ********** SimpleERC20 contract tests ********** //
  //**************************************************/

  describe('SimpleERC20  contract test', function () {
    describe('Deployment', function () {
      // it("Should be accessible", async function () {
      //   await loadFixture(deployTokenFixture);
      //   expect(await token.ping()).to.equal(1);
      // });

      it('Should set the right deployer', async function () {
        expect(await token.owner()).to.equal(deployer.address)
      })

      it('Should assign the total supply of tokens to the deployer', async function () {
        // await loadFixture(deployTokenFixture);
        const deployerBalance = await token.balanceOf(deployer.address)
        const totalSupply = await token.totalSupply()
        expect(totalSupply).to.equal(deployerBalance)
      })

      it('Should transfer 10000000 tokens to alice', async function () {
        // await loadFixture(deployTokenFixture);
        expect(token.transfer(alice.address, 10000000)).to.changeTokenBalances(token, [deployer, alice], [-1000, 1000])
      })
    })

    describe('Token transactions.', function () {
      it('Should transfer tokens between accounts', async function () {
        // await loadFixture(deployTokenFixture);

        // Transfer 50 tokens from deployer to alice
        expect(token.transfer(alice.address, 50)).to.changeTokenBalances(token, [deployer, alice], [-50, 50])

        // Transfer 50 tokens from alice to bob
        expect(token.connect(alice).transfer(bob.address, 50)).to.changeTokenBalances(token, [alice, bob], [-50, 50])
      })

      it('Should emit Transfer events.', async function () {
        // await loadFixture(deployTokenFixture);

        // Transfer 50 tokens from deployer to alice
        expect(token.transfer(alice.address, 50))
          .to.emit(token, 'Transfer')
          .withArgs(deployer.address, alice.address, 50)

        // Transfer 50 tokens from alice to bob
        expect(token.connect(alice).transfer(bob.address, 50))
          .to.emit(token, 'Transfer')
          .withArgs(alice.address, bob.address, 50)
      })

      it("Should revert when sender doesn't have enough tokens.", async function () {
        // await loadFixture(deployTokenFixture);

        const initialdeployerBalance = await token.balanceOf(deployer.address)

        // Try to send 1 token from dave (0 tokens) to deployer (1000 tokens).
        expect(token.connect(dave).transfer(deployer.address, 1)).to.be.revertedWith(
          'ERC20: transfer amount exceeds balance',
        )

        // deployer balance shouldn't have changed.
        expect(await token.balanceOf(deployer.address)).to.equal(initialdeployerBalance)
      })
    })
  })

  // *************** Service Registry & Proposal contract test **** //
  //*****************************************************************/

  describe('Service Registry & Proposal contract test', function () {
    it("Dave, who doesn't have TalentLayerID, can't create a service", async function () {
      expect(serviceRegistry.connect(dave).createOpenServiceFromBuyer(1, 'haveNotTlid')).to.be.revertedWith(
        'You sould have a TalentLayerId',
      )
    })

    it("Alice can't create a new service with a talentLayerId 0", async function () {
      expect(serviceRegistry.connect(alice).createOpenServiceFromBuyer(0, 'cid0')).to.be.revertedWith(
        'Seller 0 is not a valid TalentLayerId',
      )
      expect(serviceRegistry.connect(alice).createOpenServiceFromBuyer(0, 'cid0')).to.be.revertedWith(
        'Buyer 0 is not a valid TalentLayerId',
      )
    })

    it('Alice the buyer can create a few Open service', async function () {
      // Alice will create 4 Open services fo the whole unit test process
      await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'CID1')
      const serviceData = await serviceRegistry.services(1)

      // service 2
      await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'CID2')
      const serviceData2 = await serviceRegistry.services(2)

      // service 3
      await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'CID3')
      const serviceData3 = await serviceRegistry.services(3)

      // service 4
      await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'CID4')
      const serviceData4 = await serviceRegistry.services(4)

      expect(serviceData.status.toString()).to.be.equal('4')
      expect(serviceData.buyerId.toString()).to.be.equal('1')
      expect(serviceData.initiatorId.toString()).to.be.equal('1')
      expect(serviceData.serviceDataUri).to.be.equal('CID1')
      expect(serviceData.platformId).to.be.equal(1)
    })

    it("Alice can't create a new open service with wrong TalentLayer Platform ID", async function () {
      expect(serviceRegistry.connect(alice).createOpenServiceFromBuyer(5, 'wrongTlPid')).to.be.revertedWith(
        'Invalid platform ID',
      )
    })

    it('Alice can update her service data', async function () {
      await serviceRegistry.connect(alice).updateServiceData(1, 'aliceUpdateHerFirstService')
      const serviceData = await serviceRegistry.services(1)
      expect(serviceData.serviceDataUri).to.be.equal('aliceUpdateHerFirstService')
    })

    it('Bob can create his first proposal for an Open service n°1 from Alice', async function () {
      // Proposal on the Open service n 1
      const bobTid = await talentLayerID.walletOfOwner(bob.address)
      const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'

      // Proposal data check before the proposal
      const proposalDataBefore = await serviceRegistry.getProposal(1, bobTid)
      expect(proposalDataBefore.sellerId.toString()).to.be.equal('0')

      await serviceRegistry.connect(bob).createProposal(1, rateToken, 1, 'proposal1FromBobToAlice1Service')

      const serviceData = await serviceRegistry.services(1)
      const proposalDataAfter = await serviceRegistry.getProposal(1, bobTid)

      // Service data check
      expect(serviceData.status.toString()).to.be.equal('4')
      expect(serviceData.buyerId.toString()).to.be.equal('1')

      // Proposal data check after the proposal

      expect(proposalDataAfter.rateToken).to.be.equal(rateToken)
      expect(proposalDataAfter.rateAmount.toString()).to.be.equal('1')
      expect(proposalDataAfter.proposalDataUri).to.be.equal('proposal1FromBobToAlice1Service')
      expect(proposalDataAfter.sellerId.toString()).to.be.equal('2')
      expect(proposalDataAfter.status.toString()).to.be.equal('0')
    })

    it('Carol can create her first proposal (will be rejected by Alice) ', async function () {
      const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
      await serviceRegistry.connect(carol).createProposal(1, rateToken, 2, 'proposal1FromCarolToAlice1Service')
      const serviceData = await serviceRegistry.services(1)
      // get proposal info
      const carolTid = await talentLayerID.walletOfOwner(carol.address)
      const proposalData = await serviceRegistry.getProposal(1, carolTid)
    })

    it('Bob can update his first proposal ', async function () {
      const bobTid = await talentLayerID.walletOfOwner(bob.address)
      const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'

      const proposalDataBefore = await serviceRegistry.getProposal(1, bobTid)
      expect(proposalDataBefore.rateAmount.toString()).to.be.equal('1')

      await serviceRegistry.connect(bob).updateProposal(1, rateToken, 2, 'updateProposal1FromBobToAlice1Service')

      const proposalDataAfter = await serviceRegistry.getProposal(1, bobTid)
      expect(proposalDataAfter.rateAmount.toString()).to.be.equal('2')
      expect(proposalDataAfter.proposalDataUri).to.be.equal('updateProposal1FromBobToAlice1Service')
    })

    it('Alice can validate Bob proposal', async function () {
      const bobTid = await talentLayerID.walletOfOwner(bob.address)
      const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'

      const proposalDataBefore = await serviceRegistry.getProposal(1, bobTid)
      expect(proposalDataBefore.status.toString()).to.be.equal('0')

      await serviceRegistry.connect(alice).validateProposal(1, bobTid)

      const proposalDataAfter = await serviceRegistry.getProposal(1, bobTid)
      expect(proposalDataAfter.status.toString()).to.be.equal('1')
    })

    it('Alice can reject Carol proposal ', async function () {
      const carolTid = await talentLayerID.walletOfOwner(carol.address)
      await serviceRegistry.connect(alice).rejectProposal(1, carolTid)

      const proposalDataAfter = await serviceRegistry.getProposal(1, carolTid)
      expect(proposalDataAfter.status.toString()).to.be.equal('2')
    })
  })

  // ********** Escrow Contract tests ********** //
  //***************************************************/

  describe('Escrow Contract test.', function () {
    describe('Successful use of Escrow for a service using an ERC20 token.', function () {
      const amountBob = 1000000
      const amountCarol = 2000
      const serviceId = 2
      const transactionId = 0
      let proposalIdBob = 0 //Will be set later
      let proposalIdCarol = 0 //Will be set later
      let totalAmount = 0 //Will be set later

      it('Alice can NOT deposit tokens to escrow yet.', async function () {
        await token.connect(alice).approve(talentLayerEscrow.address, amountBob)
        expect(
          talentLayerEscrow
            .connect(alice)
            .createTokenTransaction(3600 * 24 * 7, '_metaEvidence', serviceId, proposalIdBob),
        ).to.be.reverted
      })

      it('Bob can make a second proposal on the Alice service n°2', async function () {
        proposalIdBob = await talentLayerID.walletOfOwner(bob.address)
        await serviceRegistry
          .connect(bob)
          .createProposal(serviceId, token.address, amountBob, 'proposal2FromBobToAlice2Service')
      })

      it('Carol can make her second proposal on the Alice service n°2', async function () {
        proposalIdCarol = await talentLayerID.walletOfOwner(carol.address)
        await serviceRegistry
          .connect(carol)
          .createProposal(serviceId, token.address, amountCarol, 'proposal2FromCarolToAlice2Service')
      })

      it('Alice cannot update originPlatformFee, protocolFee or protocolWallet', async function () {
        await expect(talentLayerEscrow.connect(alice).updateProtocolFee(4000)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        )
        await expect(talentLayerEscrow.connect(alice).updateOriginPlatformFee(4000)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        )
        await expect(talentLayerEscrow.connect(alice).updateProtocolWallet(dave.address)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        )
      })

      it('The Deployer can update originPlatformFee, protocolFee and protocolWallet', async function () {
        let protocolWallet = await talentLayerEscrow.connect(deployer).getProtocolWallet()
        expect(protocolWallet).to.equal(deployer.address)
        await talentLayerEscrow.connect(deployer).updateProtocolWallet(dave.address)
        protocolWallet = await talentLayerEscrow.connect(deployer).getProtocolWallet()
        expect(protocolWallet).to.equal(dave.address)

        await talentLayerEscrow.connect(deployer).updateProtocolFee(800)
        await talentLayerEscrow.connect(deployer).updateOriginPlatformFee(1400)
        const protocolFee = await talentLayerEscrow.protocolFee()
        const originPlatformFee = await talentLayerEscrow.originPlatformFee()
        expect(protocolFee).to.equal(800)
        expect(originPlatformFee).to.equal(1400)
      })

      it("Alice can deposit funds for Bob's proposal, which will emit an event.", async function () {
        const aliceUserId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address)
        await talentLayerPlatformID.connect(alice).updatePlatformFee(aliceUserId, 1100)
        const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
        const protocolFee = await talentLayerEscrow.protocolFee()
        const originPlatformFee = await talentLayerEscrow.originPlatformFee()
        const platformFee = alicePlatformData.fee

        totalAmount = amountBob + (amountBob * (protocolFee + originPlatformFee + platformFee)) / 10000

        await token.connect(alice).approve(talentLayerEscrow.address, totalAmount)

        const transaction = await talentLayerEscrow
          .connect(alice)
          .createTokenTransaction('_metaEvidence', serviceId, proposalIdBob)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice, bob],
          [totalAmount, -totalAmount, 0],
        )

        await expect(transaction)
          .to.emit(talentLayerEscrow, 'ServiceProposalConfirmedWithDeposit')
          .withArgs(serviceId, proposalIdBob, transactionId)
      })

      it('The deposit should also validate the proposal.', async function () {
        const proposal = await serviceRegistry.getProposal(serviceId, proposalIdBob)
        await expect(proposal.status.toString()).to.be.equal('1')
      })

      it('The deposit should also update the service with transactionId, proposalId, and status.', async function () {
        const service = await serviceRegistry.getService(serviceId)
        await expect(service.status.toString()).to.be.equal('1')
        await expect(service.transactionId.toString()).to.be.equal('0')
        await expect(service.sellerId.toString()).to.be.equal(proposalIdBob)
      })

      it("Alice can NOT deposit funds for Carol's proposal.", async function () {
        await token.connect(alice).approve(talentLayerEscrow.address, amountCarol)
        await expect(
          talentLayerEscrow.connect(alice).createTokenTransaction('_metaEvidence', serviceId, proposalIdCarol),
        ).to.be.reverted
      })

      it('Carol should not be allowed to release escrow the service.', async function () {
        await expect(talentLayerEscrow.connect(carol).release(transactionId, 10)).to.be.revertedWith('Access denied.')
      })

      it('Alice can release half of the escrow to bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolFee = transactionDetails.protocolFee
        const originPlatformFee = transactionDetails.originPlatformFee
        const platformFee = transactionDetails.platformFee

        const transaction = await talentLayerEscrow.connect(alice).release(transactionId, amountBob / 2)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice, bob],
          [-amountBob / 2, 0, amountBob / 2],
        )
        const platformBalance = await talentLayerEscrow.connect(alice).getClaimableFeeBalance(token.address)
        const deployerBalance = await talentLayerEscrow.connect(deployer).getClaimableFeeBalance(token.address)
        // Alice gets both platformFee & OriginPlatformFee as her platform onboarded the seller & handled the transaction
        await expect(platformBalance.toString()).to.be.equal(
          (((amountBob / 2) * (platformFee + originPlatformFee)) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal((((amountBob / 2) * protocolFee) / 10000).toString())
      })

      it('Alice can release a quarter of the escrow to Bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolFee = transactionDetails.protocolFee
        const originPlatformFee = transactionDetails.originPlatformFee
        const platformFee = transactionDetails.platformFee

        const transaction = await talentLayerEscrow.connect(alice).release(transactionId, amountBob / 4)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice, bob],
          [-amountBob / 4, 0, amountBob / 4],
        )

        const platformBalance = await talentLayerEscrow.connect(alice).getClaimableFeeBalance(token.address)
        const deployerBalance = await talentLayerEscrow.connect(deployer).getClaimableFeeBalance(token.address)
        // Alice gets both platformFee & OriginPlatformFee as her platform onboarded the seller & handled the transaction
        await expect(platformBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * (platformFee + originPlatformFee)) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal(((((3 * amountBob) / 4) * protocolFee) / 10000).toString())
      })

      it('Carol can NOT reimburse alice.', async function () {
        await expect(talentLayerEscrow.connect(carol).reimburse(transactionId, totalAmount / 4)).to.revertedWith(
          'Access denied.',
        )
      })

      it('Bob can NOT reimburse alice for more than what is left in escrow.', async function () {
        await expect(talentLayerEscrow.connect(bob).reimburse(transactionId, totalAmount)).to.revertedWith(
          'Insufficient funds.',
        )
      })

      it('Bob can reimburse alice for what is left in the escrow, an emit will be sent.', async function () {
        const transaction = await talentLayerEscrow.connect(bob).reimburse(transactionId, amountBob / 4)
        /* When asking for the reimbursement of a fee-less amount,
         * we expect the amount reimbursed to include all fees (calculated by the function,
         * hence the 'totalAmount / 4' expected.
         */
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice, bob],
          [-totalAmount / 4, totalAmount / 4, 0],
        )
        await expect(transaction).to.emit(talentLayerEscrow, 'PaymentCompleted').withArgs(serviceId)
      })

      it('Alice can not release escrow because there is none left. ', async function () {
        await expect(talentLayerEscrow.connect(alice).release(transactionId, 1)).to.be.revertedWith(
          'Insufficient funds.',
        )
      })

      it('Alice can claim her token balance.', async function () {
        const platformBalance = await talentLayerEscrow.connect(alice).getClaimableFeeBalance(token.address)
        const transaction = await talentLayerEscrow.connect(alice).claim(platformId, token.address)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice.address],
          [-platformBalance, platformBalance],
        )
      })

      it('The protocol owner can claim his token balance.', async function () {
        let protocolOwnerBalance = await talentLayerEscrow.connect(deployer).getClaimableFeeBalance(token.address)
        // await talentLayerEscrow.updateProtocolWallet(alice.address);
        const transaction = await talentLayerEscrow.connect(deployer).claim(0, token.address)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, dave.address],
          [-protocolOwnerBalance, protocolOwnerBalance],
        )
      })
    })

    describe('Successful use of Escrow for a service using ETH.', function () {
      const amountBob = 1000000
      const amountCarol = 200
      const serviceId = 3
      const transactionId = 1
      let proposalIdBob = 0 //Will be set later
      let proposalIdCarol = 0 //Will be set later
      let totalAmount = 0 //Will be set later
      const ethAddress = '0x0000000000000000000000000000000000000000'

      it('Alice can NOT deposit eth to escrow yet.', async function () {
        const aliceUserId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address)
        await talentLayerPlatformID.connect(alice).updatePlatformFee(aliceUserId, 1100)
        const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
        const protocolFee = await talentLayerEscrow.protocolFee()
        const originPlatformFee = await talentLayerEscrow.originPlatformFee()
        const platformFee = alicePlatformData.fee

        totalAmount = amountBob + (amountBob * (protocolFee + originPlatformFee + platformFee)) / 10000

        await token.connect(alice).approve(talentLayerEscrow.address, totalAmount)
        await expect(talentLayerEscrow.connect(alice).createETHTransaction('_metaEvidence', serviceId, proposalIdBob))
          .to.be.reverted
      })

      it('Bob can register a proposal.', async function () {
        proposalIdBob = await talentLayerID.walletOfOwner(bob.address)
        await serviceRegistry
          .connect(bob)
          .createProposal(serviceId, ethAddress, amountBob, 'proposal3FromBobToAlice3Service')
      })

      it('Carol can register a proposal.', async function () {
        proposalIdCarol = await talentLayerID.walletOfOwner(carol.address)
        await serviceRegistry
          .connect(carol)
          .createProposal(serviceId, ethAddress, amountCarol, 'proposal3FromCarolToAlice3Service')
      })

      it("Alice can deposit funds for Bob's proposal, which will emit an event.", async function () {
        const transaction = await talentLayerEscrow
          .connect(alice)
          .createETHTransaction('_metaEvidence', serviceId, proposalIdBob, { value: totalAmount })
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice, bob],
          [totalAmount, -totalAmount, 0],
        )

        await expect(transaction)
          .to.emit(talentLayerEscrow, 'ServiceProposalConfirmedWithDeposit')
          .withArgs(serviceId, proposalIdBob, transactionId)
      })

      it('The deposit should also validate the proposal.', async function () {
        const proposal = await serviceRegistry.getProposal(serviceId, proposalIdBob)
        await expect(proposal.status.toString()).to.be.equal('1')
      })

      it('The deposit should also update the service with transactionId, proposalId, and status.', async function () {
        const service = await serviceRegistry.getService(serviceId)
        await expect(service.status.toString()).to.be.equal('1')
        await expect(service.transactionId).to.be.equal(transactionId)
        await expect(service.sellerId).to.be.equal(proposalIdBob)
      })

      it("Alice can NOT deposit funds for Carol's proposal, and NO event should emit.", async function () {
        await token.connect(alice).approve(talentLayerEscrow.address, amountCarol)
        expect(
          talentLayerEscrow
            .connect(alice)
            .createETHTransaction('_metaEvidence', serviceId, proposalIdCarol, { value: amountCarol }),
        ).to.be.reverted
      })

      it('Carol should not be allowed to release escrow the service.', async function () {
        await expect(talentLayerEscrow.connect(carol).release(transactionId, 10)).to.be.revertedWith('Access denied.')
      })

      it('Alice can release half of the escrow to bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolFee = transactionDetails.protocolFee
        const originPlatformFee = transactionDetails.originPlatformFee
        const platformFee = transactionDetails.platformFee

        const transaction = await talentLayerEscrow.connect(alice).release(transactionId, amountBob / 2)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice, bob],
          [-amountBob / 2, 0, amountBob / 2],
        )

        const platformBalance = await talentLayerEscrow.connect(alice).getClaimableFeeBalance(ethAddress)
        const deployerBalance = await talentLayerEscrow.connect(deployer).getClaimableFeeBalance(ethAddress)
        // Alice gets both platformFee & OriginPlatformFee as her platform onboarded the seller & handled the transaction
        await expect(platformBalance.toString()).to.be.equal(
          (((amountBob / 2) * (platformFee + originPlatformFee)) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal((((amountBob / 2) * protocolFee) / 10000).toString())
      })

      it('Alice can release a quarter of the escrow to Bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolFee = transactionDetails.protocolFee
        const originPlatformFee = transactionDetails.originPlatformFee
        const platformFee = transactionDetails.platformFee

        const transaction = await talentLayerEscrow.connect(alice).release(transactionId, amountBob / 4)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice, bob],
          [-amountBob / 4, 0, amountBob / 4],
        )
        const platformBalance = await talentLayerEscrow.connect(alice).getClaimableFeeBalance(ethAddress)
        const deployerBalance = await talentLayerEscrow.connect(deployer).getClaimableFeeBalance(ethAddress)
        // Alice gets both platformFee & OriginPlatformFee as her platform onboarded the seller & handled the transaction
        await expect(platformBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * (platformFee + originPlatformFee)) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal(((((3 * amountBob) / 4) * protocolFee) / 10000).toString())
      })

      it('Carol can NOT reimburse alice.', async function () {
        await expect(talentLayerEscrow.connect(carol).reimburse(transactionId, totalAmount / 4)).to.revertedWith(
          'Access denied.',
        )
      })

      it('Bob can NOT reimburse alice for more than what is left in escrow.', async function () {
        await expect(talentLayerEscrow.connect(bob).reimburse(transactionId, totalAmount)).to.revertedWith(
          'Insufficient funds.',
        )
      })

      it('Bob can reimburse alice for what is left in the escrow, an emit will be sent.', async function () {
        const transaction = await talentLayerEscrow.connect(bob).reimburse(transactionId, amountBob / 4)
        /* When asking for the reimbursement of a fee-less amount,
         * we expect the amount reimbursed to include all fees (calculated by the function,
         * hence the 'totalAmount / 4' expected.
         */
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice, bob],
          [-totalAmount / 4, totalAmount / 4, 0],
        )
        await expect(transaction).to.emit(talentLayerEscrow, 'PaymentCompleted').withArgs(serviceId)
      })

      it('Alice can not release escrow because there is none left.', async function () {
        await expect(talentLayerEscrow.connect(alice).release(transactionId, 10)).to.be.revertedWith(
          'Insufficient funds.',
        )
      })

      it('Alice can claim her ETH balance.', async function () {
        const platformEthBalance = await talentLayerEscrow.connect(alice).getClaimableFeeBalance(ethAddress)
        const transaction = await talentLayerEscrow.connect(alice).claim(platformId, ethAddress)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice.address],
          [-platformEthBalance, platformEthBalance],
        )
      })

      it('The Protocol owner can claim his ETH balance.', async function () {
        const protocolEthBalance = await talentLayerEscrow.connect(deployer).getClaimableFeeBalance(ethAddress)
        const transaction = await talentLayerEscrow.connect(deployer).claim(0, ethAddress)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, dave.address],
          [-protocolEthBalance, protocolEthBalance],
        )
      })
    })
  })

  // ********** Talent Layer Review contract ********** //
  //*****************************************************/

  describe('Talent Layer Review contract test', function () {
    it("Bob can't write a review yet", async function () {
      expect(talentLayerReview.connect(bob).addReview(1, 'cidReview', 3, 1)).to.be.revertedWith(
        'The service is not finished yet',
      )
    })

    it("Carol can't write a review as she's not linked to this service", async function () {
      expect(talentLayerReview.connect(carol).addReview(1, 'cidReview', 5, 1)).to.be.revertedWith(
        "You're not an actor of this service",
      )
    })

    it("Alice and Bob can't write a review for the same Service", async function () {
      expect(talentLayerReview.connect(alice).addReview(1, 'cidReview', 0)).to.be.revertedWith('ReviewAlreadyMinted()')
      expect(talentLayerReview.connect(bob).addReview(1, 'cidReview', 3)).to.be.revertedWith('ReviewAlreadyMinted()')
    })

    it('Alice and Bob can write a review now and we can get review data', async function () {
      await talentLayerReview.connect(alice).addReview(2, 'cidReview1', 2, 1)
      await talentLayerReview.connect(bob).addReview(2, 'cidReview2', 4, 1)

      const reviewData1 = await talentLayerReview.getReview(0)
      const reviewData2 = await talentLayerReview.getReview(1)

      expect(reviewData1.dataUri).to.be.equal('cidReview1')
      expect(reviewData2.dataUri).to.be.equal('cidReview2')

      expect(await reviewData1.platformId).to.be.equal(1)
    })
  })

  // ********** Talent Layer Arbitrator contract test ********** //
  //**************************************************************/

  describe('Talent Layer Arbitrator contract test', function () {
    it('the owner of the platform can update the arbitration price', async function () {
      const newArbitrationPrice = 1000
      const platformId = 1

      // It fails if the caller is not the owner of the platform
      const tx = talentLayerArbitrator.connect(bob).setArbitrationPrice(platformId, newArbitrationPrice)
      expect(tx).to.be.revertedWith("You're not the owner of the platform")

      // It succeeds if the caller is the owner of the platform
      await talentLayerArbitrator.connect(alice).setArbitrationPrice(platformId, newArbitrationPrice)
      const extraData = ethers.utils.hexZeroPad(ethers.utils.hexlify(platformId), 32)
      const updatedArbitrationPrice = await talentLayerArbitrator.arbitrationCost(extraData)
      expect(updatedArbitrationPrice).to.be.equal(newArbitrationPrice)
    })
  })
})

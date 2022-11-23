import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract, ContractFactory } from 'ethers'

describe('TalentLayer', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    eve: SignerWithAddress,
    ServiceRegistry: ContractFactory,
    TalentLayerID: ContractFactory,
    TalentLayerPlatformID: ContractFactory,
    TalentLayerReview: ContractFactory,
    TalentLayerMultipleArbitrableTransaction: ContractFactory,
    TalentLayerArbitrator: ContractFactory,
    MockProofOfHumanity: ContractFactory,
    SimpleERC20: ContractFactory,
    serviceRegistry: Contract,
    talentLayerID: Contract,
    talentLayerPlatformID: Contract,
    talentLayerReview: Contract,
    talentLayerMultipleArbitrableTransaction: Contract,
    talentLayerArbitrator: Contract,
    mockProofOfHumanity: Contract,
    token: Contract,
    platformName: string,
    platformId: string,
    mintFee: number

  before(async function () {
    ;[deployer, alice, bob, carol, dave, eve] = await ethers.getSigners()

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

    // Deploy TalentLayerReview
    TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
    const talentLayerReviewArgs: [string, string, string, string, string] = [
      'TalentLayer Review',
      'TLR',
      talentLayerID.address,
      serviceRegistry.address,
      talentLayerPlatformID.address,
    ]
    talentLayerReview = await TalentLayerReview.deploy(...talentLayerReviewArgs)

    // Deploy TalentLayerArbitrator
    TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
    talentLayerArbitrator = await TalentLayerArbitrator.deploy(0)

    // Deploy TalentLayerMultipleArbitrableTransaction
    TalentLayerMultipleArbitrableTransaction = await ethers.getContractFactory(
      'TalentLayerMultipleArbitrableTransaction',
    )
    talentLayerMultipleArbitrableTransaction = await TalentLayerMultipleArbitrableTransaction.deploy(
      serviceRegistry.address,
      talentLayerID.address,
      talentLayerPlatformID.address,
      talentLayerArbitrator.address,
      [],
      3600 * 24 * 30,
    )

    // Deploy SimpleERC20 Token
    SimpleERC20 = await ethers.getContractFactory('SimpleERC20')
    token = await SimpleERC20.deploy()

    // Grant escrow role
    const escrowRole = await serviceRegistry.ESCROW_ROLE()
    await serviceRegistry.grantRole(escrowRole, talentLayerMultipleArbitrableTransaction.address)

    // Grant Platform Id Mint role to Alice and Bob
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, alice.address)
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, bob.address)

    // Alice mints a Platform Id
    platformName = 'HireVibes'
    await talentLayerPlatformID.connect(alice).mint(platformName)

    mintFee = 100
  })

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
      await talentLayerPlatformID.connect(alice).updatePlatformfee(aliceUserId, 1)

      const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)

      expect(alicePlatformData.fee).to.be.equal(1)

      await talentLayerPlatformID.connect(alice).updatePlatformfee(aliceUserId, 6)

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

      // Mint fails is not enough ETH is sent
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
  })

  it('Alice, Bob and Carol can mint a talentLayerId', async function () {
    await talentLayerID.connect(alice).mintWithPoh('1', 'alice')
    await talentLayerID.connect(bob).mintWithPoh('1', 'bob')

    expect(talentLayerID.connect(carol).mintWithPoh('1', 'carol')).to.be.revertedWith(
      'You need to use an address registered on Proof of Humanity',
    )
    await talentLayerID.connect(carol).mint('1', 'carol')
    expect(await talentLayerID.walletOfOwner(alice.address)).to.be.equal('1')
    expect(await talentLayerID.walletOfOwner(bob.address)).to.be.equal('2')
    expect(await talentLayerID.walletOfOwner(carol.address)).to.be.equal('3')
    const carolUserId = await talentLayerID.walletOfOwner(carol.address)
    const profileData = await talentLayerID.profiles(carolUserId)
    expect(profileData.platformId).to.be.equal('1')
  })

  it('Carol can activate POH on her talentLayerID', async function () {
    expect(talentLayerID.connect(carol).mintWithPoh(1, 'carol')).to.be.revertedWith(
      "You're address is not registerd for poh",
    )
    await mockProofOfHumanity.addSubmissionManually([carol.address])
    await talentLayerID.connect(carol).activatePoh(3)
    const profileData = await talentLayerID.profiles(3)

    expect(await talentLayerID.isTokenPohRegistered(3)).to.be.equal(true)
    expect(await profileData.pohAddress).to.be.equal(carol.address)
  })

  it('Alice, the buyer, can initiate a new service with Bob, the seller', async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    await serviceRegistry.connect(alice).createServiceFromBuyer(1, bobTid, 'cid')
    const serviceData = await serviceRegistry.services(1)

    expect(serviceData.status.toString()).to.be.equal('0')
    expect(serviceData.buyerId.toString()).to.be.equal('1')
    expect(serviceData.initiatorId.toString()).to.be.equal('1')
    expect(serviceData.sellerId.toString()).to.be.equal('2')
    expect(serviceData.serviceDataUri).to.be.equal('cid')
    expect(serviceData.platformId).to.be.equal(1)
  })

  it('Alice should be able to update the service data', async function () {
    await serviceRegistry.connect(alice).updateServiceData(1, 'New-service-data-Uri')
    const serviceData = await serviceRegistry.services(1)
    expect(serviceData.serviceDataUri).to.be.equal('New-service-data-Uri')
  })

  it("Alice can't create a new service with a talentLayerId 0", async function () {
    expect(serviceRegistry.connect(alice).createServiceFromBuyer(0, 'cid', 1)).to.be.revertedWith(
      'Seller 0 is not a valid TalentLayerId',
    )
    expect(serviceRegistry.connect(alice).createServiceFromSeller(0, 'cid', 1)).to.be.revertedWith(
      'Buyer 0 is not a valid TalentLayerId',
    )
  })

  it("Bob, the seller, can confirm the service, Alice can't, Carol can't", async function () {
    expect(serviceRegistry.connect(alice).confirmService(1)).to.be.revertedWith(
      "Only the user who didn't initate the service can confirm it",
    )
    expect(serviceRegistry.connect(carol).confirmService(1)).to.be.revertedWith("You're not an actor of this service")
    await serviceRegistry.connect(bob).confirmService(1)
    const serviceData = await serviceRegistry.services(1)
    expect(serviceData.status.toString()).to.be.equal('1')
    expect(serviceRegistry.connect(bob).confirmService(1)).to.be.revertedWith('Service has already been confirmed')
  })

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

  it('Alice can say that the service is finished', async function () {
    await serviceRegistry.connect(alice).finishService(1)
    const serviceData = await serviceRegistry.services(1)
    expect(serviceData.status.toString()).to.be.equal('2')
  })

  it('Alice and Bob can write a review now and we can get review data', async function () {
    await talentLayerReview.connect(alice).addReview(1, 'cidReview1', 2, 1)
    await talentLayerReview.connect(bob).addReview(1, 'cidReview2', 4, 1)

    expect(await talentLayerReview.reviewDataUri(0)).to.be.equal('cidReview1')
    expect(await talentLayerReview.reviewDataUri(1)).to.be.equal('cidReview2')
    expect(await talentLayerReview.reviewIdToPlatformId(1)).to.be.equal(1)
  })

  it("Alice and Bob can't write a review for the same Service", async function () {
    expect(talentLayerReview.connect(alice).addReview(1, 'cidReview', 0)).to.be.revertedWith('ReviewAlreadyMinted()')
    expect(talentLayerReview.connect(bob).addReview(1, 'cidReview', 3)).to.be.revertedWith('ReviewAlreadyMinted()')
  })

  it('Carol, a new buyer, can initiate a new service with Bob, the seller', async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    await serviceRegistry.connect(carol).createServiceFromBuyer(1, bobTid, 'cid2')
    const serviceData = await serviceRegistry.services(2)

    expect(serviceData.status.toString()).to.be.equal('0')
    expect(serviceData.buyerId.toString()).to.be.equal('3')
    expect(serviceData.initiatorId.toString()).to.be.equal('3')
    expect(serviceData.sellerId.toString()).to.be.equal('2')
    expect(serviceData.serviceDataUri).to.be.equal('cid2')
  })

  it("Bob can reject Carol new service as he's not agree with the service details", async function () {
    await serviceRegistry.connect(bob).rejectService(2)
    const serviceData = await serviceRegistry.services(2)
    expect(serviceData.status.toString()).to.be.equal('3')
    expect(serviceRegistry.connect(bob).confirmService(1)).to.be.revertedWith("You can't finish this service")
  })

  it('Bob can post another service with fixed service details, and Carol confirmed it', async function () {
    const carolId = await talentLayerID.walletOfOwner(carol.address)
    await serviceRegistry.connect(bob).createServiceFromSeller(1, carolId, 'cid3')
    let serviceData = await serviceRegistry.services(3)

    expect(serviceData.status.toString()).to.be.equal('0')
    expect(serviceData.buyerId.toString()).to.be.equal('3')
    expect(serviceData.initiatorId.toString()).to.be.equal('2')
    expect(serviceData.sellerId.toString()).to.be.equal('2')
    expect(serviceData.serviceDataUri).to.be.equal('cid3')
    expect(serviceData.platformId).to.be.equal(1)

    await serviceRegistry.connect(carol).confirmService(3)
    serviceData = await serviceRegistry.services(3)

    expect(serviceData.status.toString()).to.be.equal('1')
  })

  it("Dave, who doesn't have TalentLayerID, can't create a service", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    expect(serviceRegistry.connect(dave).createServiceFromBuyer(1, bobTid, 'cid')).to.be.revertedWith(
      'You sould have a TalentLayerId',
    )
  })

  it('Alice the buyer can create an Open service', async function () {
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
    const serviceData = await serviceRegistry.services(4)

    expect(serviceData.status.toString()).to.be.equal('4')
    expect(serviceData.buyerId.toString()).to.be.equal('1')
    expect(serviceData.initiatorId.toString()).to.be.equal('1')
    expect(serviceData.sellerId.toString()).to.be.equal('0')
    expect(serviceData.serviceDataUri).to.be.equal('cid')
    expect(serviceData.platformId).to.be.equal(1)
  })

  it('Alice can assign an seller to a Open service', async function () {
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    await serviceRegistry.connect(alice).assignSellerToService(5, bobTid)
    const serviceData = await serviceRegistry.services(5)

    expect(serviceData.status.toString()).to.be.equal('0')
    expect(serviceData.sellerId.toString()).to.be.equal(bobTid)
  })

  it('Bob can confirm the Open service', async function () {
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    await serviceRegistry.connect(alice).assignSellerToService(6, bobTid)
    await serviceRegistry.connect(bob).confirmService(6)
    const serviceData = await serviceRegistry.services(6)

    expect(serviceData.status.toString()).to.be.equal('1')
  })

  it('Bob can reject an Open service', async function () {
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    const carolId = await talentLayerID.walletOfOwner(carol.address)
    await serviceRegistry.connect(alice).assignSellerToService(7, bobTid)
    await serviceRegistry.connect(bob).rejectService(7)
    const serviceData = await serviceRegistry.services(7)

    expect(serviceData.status.toString()).to.be.equal('3')

    await serviceRegistry.connect(alice).assignSellerToService(7, carolId)
    await serviceRegistry.connect(carol).confirmService(7)
    const serviceDataNewAssignement = await serviceRegistry.services(7)

    expect(serviceDataNewAssignement.status.toString()).to.be.equal('1')
  })

  it('Bob can create a proposal for an Open service', async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')

    // Proposal data check before the proposal
    const proposalDataBefore = await serviceRegistry.getProposal(8, bobTid)
    expect(proposalDataBefore.sellerId.toString()).to.be.equal('0')

    await serviceRegistry.connect(bob).createProposal(8, rateToken, 1, 'cid')

    const serviceData = await serviceRegistry.services(8)
    const proposalDataAfter = await serviceRegistry.getProposal(8, bobTid)

    // Service data check
    expect(serviceData.status.toString()).to.be.equal('4')
    expect(serviceData.buyerId.toString()).to.be.equal('1')

    // Proposal data check after the proposal

    expect(proposalDataAfter.rateToken).to.be.equal(rateToken)
    expect(proposalDataAfter.rateAmount.toString()).to.be.equal('1')
    expect(proposalDataAfter.proposalDataUri).to.be.equal('cid')
    expect(proposalDataAfter.sellerId.toString()).to.be.equal('2')
    expect(proposalDataAfter.status.toString()).to.be.equal('0')
  })

  it('Bob can update a proposal ', async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
    await serviceRegistry.connect(bob).createProposal(9, rateToken, 1, 'cid')

    const proposalDataBefore = await serviceRegistry.getProposal(9, bobTid)
    expect(proposalDataBefore.rateAmount.toString()).to.be.equal('1')

    await serviceRegistry.connect(bob).updateProposal(9, rateToken, 2, 'cid2')

    const proposalDataAfter = await serviceRegistry.getProposal(9, bobTid)
    expect(proposalDataAfter.rateAmount.toString()).to.be.equal('2')
    expect(proposalDataAfter.proposalDataUri).to.be.equal('cid2')
  })

  it('Alice can validate a proposal', async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
    await serviceRegistry.connect(bob).createProposal(10, rateToken, 1, 'cid')

    const proposalDataBefore = await serviceRegistry.getProposal(10, bobTid)
    expect(proposalDataBefore.status.toString()).to.be.equal('0')

    await serviceRegistry.connect(alice).validateProposal(10, bobTid)

    const proposalDataAfter = await serviceRegistry.getProposal(10, bobTid)
    expect(proposalDataAfter.status.toString()).to.be.equal('1')
  })

  it('Alice can delete a proposal ', async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address)
    const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
    await serviceRegistry.connect(bob).createProposal(11, rateToken, 1, 'cid')

    await serviceRegistry.connect(alice).rejectProposal(11, bobTid)

    const proposalDataAfter = await serviceRegistry.getProposal(11, bobTid)
    expect(proposalDataAfter.status.toString()).to.be.equal('2')
  })

  it('The deployer can update the mint fee', async function () {
    await talentLayerID.connect(deployer).updateMintFee(mintFee)
    const updatedMintFee = await talentLayerID.mintFee()

    expect(updatedMintFee).to.be.equal(mintFee)
  })

  it('Eve can mint a talentLayerId by paying the mint fee', async function () {
    const eveBalanceBefore = await eve.getBalance()
    const contractBalanceBefore = await ethers.provider.getBalance(talentLayerID.address)

    // Mint fails is not enough ETH is sent
    expect(talentLayerID.connect(eve).mint('1', 'eve')).to.be.revertedWith('Incorrect amount of ETH for mint fee')

    // Mint is successful if the correct amount of ETH for mint fee is sent
    await talentLayerID.connect(eve).mint('1', 'eve', { value: mintFee })
    expect(await talentLayerID.walletOfOwner(eve.address)).to.be.equal('4')

    // Eve balance is decreased by the mint fee (+ gas fees)
    const eveBalanceAfter = await eve.getBalance()
    expect(eveBalanceAfter).to.be.lte(eveBalanceBefore.sub(mintFee))

    // Platform id contract balance is increased by the mint fee
    const contractBalanceAfter = await ethers.provider.getBalance(talentLayerID.address)
    expect(contractBalanceAfter).to.be.equal(contractBalanceBefore.add(mintFee))
  })

  describe('SimpleERC20 contract.', function () {
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

  describe('Escrow Contract.', function () {
    describe('Successful use of Escrow for a service using an ERC20 token.', function () {
      const amountBob = 1000000
      const amountCarol = 2000
      const serviceId = 12
      const transactionId = 0
      let proposalIdBob = 0 //Will be set later
      let proposalIdCarol = 0 //Will be set later
      let totalAmount = 0 //Will be set later

      it('Alice can create a service.', async function () {
        await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
      })

      it('Alice can NOT deposit tokens to escrow yet.', async function () {
        await token.connect(alice).approve(talentLayerMultipleArbitrableTransaction.address, amountBob)
        expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .createTokenTransaction(3600 * 24 * 7, '_metaEvidence', serviceId, proposalIdBob),
        ).to.be.reverted
      })

      it('Bob can register a proposal.', async function () {
        proposalIdBob = await talentLayerID.walletOfOwner(bob.address)
        await serviceRegistry.connect(bob).createProposal(serviceId, token.address, amountBob, 'cid')
      })

      it('Carol can register a proposal.', async function () {
        proposalIdCarol = await talentLayerID.walletOfOwner(carol.address)
        await serviceRegistry.connect(carol).createProposal(serviceId, token.address, amountCarol, 'cid')
      })

      it('Alice cannot update originPlatformFee, protocolFee or protocolWallet', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(alice).updateProtocolFee(4000),
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(alice).updateOriginPlatformFee(4000),
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(alice).updateProtocolWallet(dave.address),
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('The Deployer can update originPlatformFee, protocolFee and protocolWallet', async function () {
        let protocolWallet = await talentLayerMultipleArbitrableTransaction.connect(deployer).getProtocolWallet()
        expect(protocolWallet).to.equal(deployer.address)
        await talentLayerMultipleArbitrableTransaction.connect(deployer).updateProtocolWallet(dave.address)
        protocolWallet = await talentLayerMultipleArbitrableTransaction.connect(deployer).getProtocolWallet()
        expect(protocolWallet).to.equal(dave.address)

        await talentLayerMultipleArbitrableTransaction.connect(deployer).updateProtocolFee(800)
        await talentLayerMultipleArbitrableTransaction.connect(deployer).updateOriginPlatformFee(1400)
        const protocolFee = await talentLayerMultipleArbitrableTransaction.protocolFee()
        const originPlatformFee = await talentLayerMultipleArbitrableTransaction.originPlatformFee()
        expect(protocolFee).to.equal(800)
        expect(originPlatformFee).to.equal(1400)
      })

      it("Alice can deposit funds for Bob's proposal, which will emit an event.", async function () {
        const aliceUserId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address)
        await talentLayerPlatformID.connect(alice).updatePlatformfee(aliceUserId, 1100)
        const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
        const protocolFee = await talentLayerMultipleArbitrableTransaction.protocolFee()
        const originPlatformFee = await talentLayerMultipleArbitrableTransaction.originPlatformFee()
        const platformFee = alicePlatformData.fee

        totalAmount = amountBob + (amountBob * (protocolFee + originPlatformFee + platformFee)) / 10000

        await token.connect(alice).approve(talentLayerMultipleArbitrableTransaction.address, totalAmount)

        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .createTokenTransaction(3600 * 24 * 7, '_metaEvidence', serviceId, proposalIdBob)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [totalAmount, -totalAmount, 0],
        )

        await expect(transaction)
          .to.emit(talentLayerMultipleArbitrableTransaction, 'ServiceProposalConfirmedWithDeposit')
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
        await token.connect(alice).approve(talentLayerMultipleArbitrableTransaction.address, amountCarol)
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .createTokenTransaction(3600 * 24 * 7, '_metaEvidence', serviceId, proposalIdCarol),
        ).to.be.reverted
      })

      it('Carol should not be allowed to release escrow the service.', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(carol).release(transactionId, 10),
        ).to.be.revertedWith('Access denied.')
      })

      it('Alice can release half of the escrow to bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolFee = transactionDetails.protocolFee
        const originPlatformFee = transactionDetails.originPlatformFee
        const platformFee = transactionDetails.platformFee

        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .release(transactionId, amountBob / 2)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 2, 0, amountBob / 2],
        )
        const platformBalance = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getClaimableFeeBalance(token.address)
        const deployerBalance = await talentLayerMultipleArbitrableTransaction
          .connect(deployer)
          .getClaimableFeeBalance(token.address)
        // Alice gets both platformFee & OriginPlatformFee as her platform onboarded the seller & handled the transaction
        await expect(platformBalance.toString()).to.be.equal(
          (((amountBob / 2) * (platformFee + originPlatformFee)) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal((((amountBob / 2) * protocolFee) / 10000).toString())
      })

      it('Alice can release a quarter of the escrow to Bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolFee = transactionDetails.protocolFee
        const originPlatformFee = transactionDetails.originPlatformFee
        const platformFee = transactionDetails.platformFee

        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .release(transactionId, amountBob / 4)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 4, 0, amountBob / 4],
        )

        const platformBalance = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getClaimableFeeBalance(token.address)
        const deployerBalance = await talentLayerMultipleArbitrableTransaction
          .connect(deployer)
          .getClaimableFeeBalance(token.address)
        // Alice gets both platformFee & OriginPlatformFee as her platform onboarded the seller & handled the transaction
        await expect(platformBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * (platformFee + originPlatformFee)) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal(((((3 * amountBob) / 4) * protocolFee) / 10000).toString())
      })

      it('Carol can NOT reimburse alice.', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(carol).reimburse(transactionId, totalAmount / 4),
        ).to.revertedWith('Access denied.')
      })

      it('Bob can NOT reimburse alice for more than what is left in escrow.', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(bob).reimburse(transactionId, totalAmount),
        ).to.revertedWith('Insufficient funds.')
      })

      it('Bob can reimburse alice for what is left in the escrow, an emit will be sent.', async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(bob)
          .reimburse(transactionId, amountBob / 4)
        /* When asking for the reimbursement of a fee-less amount,
         * we expect the amount reimbursed to include all fees (calculated by the function,
         * hence the 'totalAmount / 4' expected.
         */
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-totalAmount / 4, totalAmount / 4, 0],
        )
        await expect(transaction)
          .to.emit(talentLayerMultipleArbitrableTransaction, 'PaymentCompleted')
          .withArgs(serviceId)
      })

      it('Alice can not release escrow because there is none left. ', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(alice).release(transactionId, 1),
        ).to.be.revertedWith('Insufficient funds.')
      })

      it('Alice can claim her token balance.', async function () {
        const platformBalance = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getClaimableFeeBalance(token.address)
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .claim(platformId, token.address)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice.address],
          [-platformBalance, platformBalance],
        )
      })

      it('The protocol owner can claim his token balance.', async function () {
        let protocolOwnerBalance = await talentLayerMultipleArbitrableTransaction
          .connect(deployer)
          .getClaimableFeeBalance(token.address)
        // await talentLayerMultipleArbitrableTransaction.updateProtocolWallet(alice.address);
        const transaction = await talentLayerMultipleArbitrableTransaction.connect(deployer).claim(0, token.address)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, dave.address],
          [-protocolOwnerBalance, protocolOwnerBalance],
        )
      })
    })

    describe('Successful use of Escrow for a service using ETH.', function () {
      const amountBob = 1000000
      const amountCarol = 200
      const serviceId = 13
      const transactionId = 1
      let proposalIdBob = 0 //Will be set later
      let proposalIdCarol = 0 //Will be set later
      let totalAmount = 0 //Will be set later
      const ethAddress = '0x0000000000000000000000000000000000000000'

      it('Alice can create a service.', async function () {
        await serviceRegistry.connect(alice).createOpenServiceFromBuyer(1, 'cid')
      })

      it('Alice can NOT deposit eth to escrow yet.', async function () {
        const aliceUserId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address)
        await talentLayerPlatformID.connect(alice).updatePlatformfee(aliceUserId, 1100)
        const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
        const protocolFee = await talentLayerMultipleArbitrableTransaction.protocolFee()
        const originPlatformFee = await talentLayerMultipleArbitrableTransaction.originPlatformFee()
        const platformFee = alicePlatformData.fee

        totalAmount = amountBob + (amountBob * (protocolFee + originPlatformFee + platformFee)) / 10000

        await token.connect(alice).approve(talentLayerMultipleArbitrableTransaction.address, totalAmount)
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .createETHTransaction(3600 * 24 * 7, '_metaEvidence', serviceId, proposalIdBob),
        ).to.be.reverted
      })

      it('Bob can register a proposal.', async function () {
        proposalIdBob = await talentLayerID.walletOfOwner(bob.address)
        await serviceRegistry.connect(bob).createProposal(serviceId, ethAddress, amountBob, 'cid')
      })

      it('Carol can register a proposal.', async function () {
        proposalIdCarol = await talentLayerID.walletOfOwner(carol.address)
        await serviceRegistry.connect(carol).createProposal(serviceId, ethAddress, amountCarol, 'cid')
      })

      it("Alice can deposit funds for Bob's proposal, which will emit an event.", async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .createETHTransaction(3600 * 24 * 7, '_metaEvidence', serviceId, proposalIdBob, { value: totalAmount })
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [totalAmount, -totalAmount, 0],
        )

        await expect(transaction)
          .to.emit(talentLayerMultipleArbitrableTransaction, 'ServiceProposalConfirmedWithDeposit')
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
        await token.connect(alice).approve(talentLayerMultipleArbitrableTransaction.address, amountCarol)
        expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .createETHTransaction(3600 * 24 * 7, '_metaEvidence', serviceId, proposalIdCarol, { value: amountCarol }),
        ).to.be.reverted
      })

      it('Carol should not be allowed to release escrow the service.', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(carol).release(transactionId, 10),
        ).to.be.revertedWith('Access denied.')
      })

      it('Alice can release half of the escrow to bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolFee = transactionDetails.protocolFee
        const originPlatformFee = transactionDetails.originPlatformFee
        const platformFee = transactionDetails.platformFee

        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .release(transactionId, amountBob / 2)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 2, 0, amountBob / 2],
        )

        const platformBalance = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getClaimableFeeBalance(ethAddress)
        const deployerBalance = await talentLayerMultipleArbitrableTransaction
          .connect(deployer)
          .getClaimableFeeBalance(ethAddress)
        // Alice gets both platformFee & OriginPlatformFee as her platform onboarded the seller & handled the transaction
        await expect(platformBalance.toString()).to.be.equal(
          (((amountBob / 2) * (platformFee + originPlatformFee)) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal((((amountBob / 2) * protocolFee) / 10000).toString())
      })

      it('Alice can release a quarter of the escrow to Bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolFee = transactionDetails.protocolFee
        const originPlatformFee = transactionDetails.originPlatformFee
        const platformFee = transactionDetails.platformFee

        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .release(transactionId, amountBob / 4)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 4, 0, amountBob / 4],
        )
        const platformBalance = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getClaimableFeeBalance(ethAddress)
        const deployerBalance = await talentLayerMultipleArbitrableTransaction
          .connect(deployer)
          .getClaimableFeeBalance(ethAddress)
        // Alice gets both platformFee & OriginPlatformFee as her platform onboarded the seller & handled the transaction
        await expect(platformBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * (platformFee + originPlatformFee)) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal(((((3 * amountBob) / 4) * protocolFee) / 10000).toString())
      })

      it('Carol can NOT reimburse alice.', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(carol).reimburse(transactionId, totalAmount / 4),
        ).to.revertedWith('Access denied.')
      })

      it('Bob can NOT reimburse alice for more than what is left in escrow.', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(bob).reimburse(transactionId, totalAmount),
        ).to.revertedWith('Insufficient funds.')
      })

      it('Bob can reimburse alice for what is left in the escrow, an emit will be sent.', async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(bob)
          .reimburse(transactionId, amountBob / 4)
        /* When asking for the reimbursement of a fee-less amount,
         * we expect the amount reimbursed to include all fees (calculated by the function,
         * hence the 'totalAmount / 4' expected.
         */
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-totalAmount / 4, totalAmount / 4, 0],
        )
        await expect(transaction)
          .to.emit(talentLayerMultipleArbitrableTransaction, 'PaymentCompleted')
          .withArgs(serviceId)
      })

      it('Alice can not release escrow because there is none left.', async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction.connect(alice).release(transactionId, 10),
        ).to.be.revertedWith('Insufficient funds.')
      })

      it('Alice can claim her ETH balance.', async function () {
        const platformEthBalance = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .getClaimableFeeBalance(ethAddress)
        const transaction = await talentLayerMultipleArbitrableTransaction.connect(alice).claim(platformId, ethAddress)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice.address],
          [-platformEthBalance, platformEthBalance],
        )
      })

      it('The Protocol owner can claim his ETH balance.', async function () {
        const protocolEthBalance = await talentLayerMultipleArbitrableTransaction
          .connect(deployer)
          .getClaimableFeeBalance(ethAddress)
        const transaction = await talentLayerMultipleArbitrableTransaction.connect(deployer).claim(0, ethAddress)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, dave.address],
          [-protocolEthBalance, protocolEthBalance],
        )
      })
    })
  })
})

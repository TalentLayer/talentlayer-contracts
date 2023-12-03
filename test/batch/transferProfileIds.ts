import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerID, TalentLayerService } from '../../typechain-types'
import {
  cid,
  minTokenWhitelistTransactionAmount,
  MintStatus,
  proposalExpirationDate,
} from '../utils/constant'
import { deploy } from '../utils/deploy'
import { getSignatureForProposal, getSignatureForService } from '../utils/signature'

const evePlatformId = 1
const serviceId = 1
const transactionAmount = ethers.utils.parseEther('1000')
const tokenAddress = ethers.constants.AddressZero

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<[TalentLayerID, TalentLayerService]> {
  const [talentLayerID, talentLayerPlatformID, , , talentLayerService] = await deploy(false)
  const [deployer, alice, bob, carol, , eve] = await ethers.getSigners()

  // Deployer whitelists a list of authorized tokens
  await talentLayerService
    .connect(deployer)
    .updateAllowedTokenList(tokenAddress, true, minTokenWhitelistTransactionAmount)

  // Deployer mints Platform Id for Carol
  const platformName = 'hirevibes'
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, eve.address)

  // Disable whitelist for reserved handles
  await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

  // Mint TL Id for Alice, Bob and Dave
  await talentLayerID.connect(alice).mint(evePlatformId, 'alice')
  await talentLayerID.connect(bob).mint(evePlatformId, 'bob__')
  await talentLayerID.connect(carol).mint(evePlatformId, 'carol')

  // Set service contract address on ID contract
  await talentLayerID.connect(deployer).setIsServiceContract(talentLayerService.address, true)

  return [talentLayerID, talentLayerService]
}

describe('Transfer of TalentLayer IDs', function () {
  let talentLayerID: TalentLayerID,
    talentLayerService: TalentLayerService,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    eve: SignerWithAddress

  before(async function () {
    ;[, alice, bob, carol, dave, eve] = await ethers.getSigners()
    ;[talentLayerID, talentLayerService] = await deployAndSetup()
  })

  it('A new TalentLayer ID can be initially transferred', async function () {
    // Alice transfers her TL Id to Dave, who doesn't have a TL Id yet
    const aliceTlId = await talentLayerID.ids(alice.address)
    await talentLayerID.connect(alice).transferFrom(alice.address, dave.address, 1)

    const daveTlId = await talentLayerID.ids(dave.address)
    const aliceTlIdAfter = await talentLayerID.ids(alice.address)

    // Check that Dave now owns Alice's TL Id
    expect(await talentLayerID.ownerOf(aliceTlId)).to.equal(dave.address)
    expect(daveTlId).to.equal(aliceTlId)

    // Check that Alice no longer owns her TL Id
    expect(await talentLayerID.balanceOf(alice.address)).to.equal(0)
    expect(aliceTlIdAfter).to.equal(0)
  })

  it("A TalentLayer ID can't be transferred to an address who already has a TalentLayer ID", async function () {
    // BOb tries to transfer his TL Id to Carol, who already has a TL Id
    const bobTlId = await talentLayerID.ids(bob.address)
    const tx = talentLayerID.connect(bob).transferFrom(bob.address, carol.address, bobTlId)

    expect(tx).to.be.revertedWith('Receiver already has a TalentLayer ID')
  })

  it("A TalentLayer ID can't be transferred anymore after it has created a service", async function () {
    const bobTlId = await talentLayerID.ids(bob.address)

    // Bob creates a new service
    const signature = await getSignatureForService(eve, bobTlId.toNumber(), 0, cid)
    await talentLayerService
      .connect(bob)
      .createService(bobTlId, evePlatformId, cid, signature, tokenAddress, 0)

    expect(await talentLayerID.hasActivity(bobTlId)).to.be.true

    // Bob tries to transfer his TL Id to Dave
    await expect(
      talentLayerID.connect(bob).transferFrom(bob.address, dave.address, bobTlId),
    ).to.be.revertedWith('Token transfer is not allowed')

    await expect(
      talentLayerID
        .connect(bob)
        ['safeTransferFrom(address,address,uint256)'](bob.address, dave.address, bobTlId),
    ).to.be.revertedWith('Token transfer is not allowed')

    await expect(
      talentLayerID
        .connect(bob)
        ['safeTransferFrom(address,address,uint256,bytes)'](bob.address, dave.address, bobTlId, []),
    ).to.be.revertedWith('Token transfer is not allowed')
  })

  it("A TalentLayer ID can't be transferred anymore after it has created a proposal", async function () {
    const carolTlId = await talentLayerID.ids(carol.address)

    // Carol creates a proposal
    const signature = await getSignatureForProposal(eve, carolTlId.toNumber(), 1, cid)
    await talentLayerService
      .connect(carol)
      .createProposal(
        carolTlId,
        serviceId,
        transactionAmount,
        evePlatformId,
        cid,
        proposalExpirationDate,
        signature,
        0,
      )

    expect(await talentLayerID.hasActivity(carolTlId)).to.be.true

    // Carol tries to transfer her TL Id to Dave
    await expect(
      talentLayerID.connect(carol).transferFrom(carol.address, dave.address, carolTlId),
    ).to.be.revertedWith('Token transfer is not allowed')

    await expect(
      talentLayerID
        .connect(carol)
        ['safeTransferFrom(address,address,uint256)'](carol.address, dave.address, carolTlId),
    ).to.be.revertedWith('Token transfer is not allowed')

    await expect(
      talentLayerID
        .connect(carol)
        ['safeTransferFrom(address,address,uint256,bytes)'](
          carol.address,
          dave.address,
          carolTlId,
          [],
        ),
    ).to.be.revertedWith('Token transfer is not allowed')
  })

  it('Only service contracts can set whether a user has done an activity', async function () {
    const carolTlId = await talentLayerID.ids(carol.address)

    // Carol tries to set her activity status
    await expect(talentLayerID.connect(carol).setHasActivity(carolTlId)).to.be.revertedWith(
      'Only service contracts can set whether a user has activity',
    )

    // Dave tries to set Carol's activity status
    await expect(talentLayerID.connect(dave).setHasActivity(carolTlId)).to.be.revertedWith(
      'Only service contracts can set whether a user has activity',
    )
  })
})

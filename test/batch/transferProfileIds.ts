import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerID } from '../../typechain-types'
import { MintStatus } from '../utils/constant'
import { deploy } from '../utils/deploy'

const evePlatformId = 1

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<[TalentLayerID]> {
  const [talentLayerID, talentLayerPlatformID] = await deploy(false)
  const [deployer, alice, bob, carol, , eve] = await ethers.getSigners()

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

  return [talentLayerID]
}

describe('Transfer of TalentLayer IDs', function () {
  let talentLayerID: TalentLayerID,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress

  before(async function () {
    ;[, alice, bob, carol, dave] = await ethers.getSigners()
    ;[talentLayerID] = await deployAndSetup()
  })

  it('A new TalentLayer ID can be initially transferred', async function () {
    const aliceTlId = await talentLayerID.ids(alice.address)
    await talentLayerID.connect(alice).transferFrom(alice.address, dave.address, 1)

    const daveTlId = await talentLayerID.ids(dave.address)
    const aliceTlIdAfter = await talentLayerID.ids(alice.address)

    expect(await talentLayerID.ownerOf(aliceTlId)).to.equal(dave.address)
    expect(daveTlId).to.equal(aliceTlId)

    expect(await talentLayerID.balanceOf(alice.address)).to.equal(0)
    expect(aliceTlIdAfter).to.equal(0)
  })

  it("A TalentLayer ID can't be transferred to an address who already has a TalentLayer ID", async function () {
    const bobTlId = await talentLayerID.ids(bob.address)
    const tx = talentLayerID.connect(bob).transferFrom(bob.address, carol.address, bobTlId)

    expect(tx).to.be.revertedWith('Receiver already has a TalentLayer ID')
  })

  it("A TalentLayer ID can't be transferred anymore after it has done some activity in the protocol", async function () {
    const bobTlId = await talentLayerID.ids(bob.address)
    await talentLayerID.connect(bob).setHasActivity(bobTlId)

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
})

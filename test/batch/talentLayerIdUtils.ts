import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { TalentLayerID, TalentLayerIdUtils, TalentLayerPlatformID } from '../../typechain-types'
import { MintStatus } from '../utils/constant'
import { deploy } from '../utils/deploy'

/**
 * Deploys contract and sets up the context for TalentLayerIdUtils tests.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<
  [TalentLayerPlatformID, TalentLayerID, TalentLayerIdUtils]
> {
  const [deployer, alice, backendDelegate, platformOwner] = await ethers.getSigners()
  const [talentLayerID, talentLayerPlatformID] = await deploy(false)

  // Deploy TalentLayerIdUtils contract with the address of TalentLayerID
  const TalentLayerIdUtils = await ethers.getContractFactory('TalentLayerIdUtils')
  const talentLayerIdUtils = await TalentLayerIdUtils.deploy(talentLayerID.address)

  // Grant Platform Id Mint role to Deployer and Bob
  const mintRole = await talentLayerPlatformID.MINT_ROLE()
  await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)

  // Deployer mints Platform Id for Carol
  const platformName = 'racoon-corp'
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, platformOwner.address)

  // Disable whitelist for reserved handles
  await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

  // Update mint fee
  await talentLayerID.connect(deployer).updateMintFee(ethers.utils.parseEther('0.01'))

  return [talentLayerPlatformID, talentLayerID, talentLayerIdUtils]
}

describe('TalentLayerIdUtils', function () {
  let alice: SignerWithAddress,
    backendDelegate: SignerWithAddress,
    platformOwner: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerId: TalentLayerID,
    talentLayerIdUtils: TalentLayerIdUtils

  const platformId = 1

  before(async function () {
    ;[, alice, backendDelegate, platformOwner] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerId, talentLayerIdUtils] = await deployAndSetup()
  })

  it('mintDelegateAndTransfer', async function () {
    const handle = 'pipou'
    const mintFee = await talentLayerId.getHandlePrice(handle)

    await expect(
      talentLayerIdUtils
        .connect(backendDelegate)
        .mintDelegateAndTransfer(alice.address, backendDelegate.address, platformId, 'pip'),
    ).to.be.reverted

    await talentLayerIdUtils
      .connect(backendDelegate)
      .mintDelegateAndTransfer(alice.address, backendDelegate.address, platformId, handle, {
        value: mintFee,
      })

    // Assert that the token balance of alice is 1
    const aliceBalance = await talentLayerId.balanceOf(alice.address)
    expect(aliceBalance).to.equal(1)

    // Assert that backendDelegate is delegate of alice
    const aliceTokenId = await talentLayerId.ids(alice.address)
    const aliceDelegate = await talentLayerId.isDelegate(aliceTokenId, backendDelegate.address)
    expect(aliceDelegate).to.equal(true)

    // Assert backend delegate balance is 0
    const backendDelegateBalance = await talentLayerId.balanceOf(backendDelegate.address)
    expect(backendDelegateBalance).to.equal(0)
  })
})

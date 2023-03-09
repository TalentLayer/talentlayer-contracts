import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { TalentLayerID, TalentLayerPlatformID } from '../../typechain-types'
import { MintStatus } from '../utils/constant'
import { deploy } from '../utils/deploy'

const handles = [
  {
    handle: 'a',
    price: 200,
  },
  {
    handle: 'ab',
    price: 100,
  },
  {
    handle: 'abc',
    price: 50,
  },
  {
    handle: 'abcd',
    price: 25,
  },
]

describe('Mint short handles', function () {
  let talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    deployer: SignerWithAddress,
    platformOwner: SignerWithAddress,
    users: SignerWithAddress[]

  before(async function () {
    ;[deployer, platformOwner, ...users] = await ethers.getSigners()
    ;[talentLayerID, talentLayerPlatformID] = await deploy(false)

    // Disable whitelist for reserved handles
    await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

    // Deployer mints Platform Id for Carol
    const platformName = 'hirevibes'
    await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
    await talentLayerPlatformID
      .connect(deployer)
      .mintForAddress(platformName, platformOwner.address)
  })

  it('The price for short handles is correct', async function () {
    for (const [, handle] of handles.entries()) {
      const price = await talentLayerID.getHandlePrice(handle.handle)
      expect(price).to.equal(ethers.utils.parseEther(handle.price.toString()))
    }
  })

  it('The price for regular handles is correct', async function () {
    const priceBefore = await talentLayerID.getHandlePrice('abcde')
    expect(priceBefore).to.equal(0)

    // Update mint fee
    const mintFee = 100
    await talentLayerID.connect(deployer).updateMintFee(mintFee)
    const priceAfter = await talentLayerID.getHandlePrice('abcde')
    expect(priceAfter).to.equal(mintFee)
  })

  it('Users can mint a short handle paying the fee', async function () {
    for (const [index, handle] of handles.entries()) {
      const user = users[index]
      const price = ethers.utils.parseEther(handle.price.toString())

      const failedTx = talentLayerID.connect(user).mint(1, handle.handle, { value: price.sub(1) })
      await expect(failedTx).to.be.revertedWith('Incorrect amount of ETH for mint fee')

      const tx = await talentLayerID.connect(user).mint(1, handle.handle, { value: price })
      await tx.wait()

      await expect(tx).to.changeEtherBalances(
        [talentLayerID.address, user],
        [price, (-price).toString()],
      )
    }
  })
})

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerID } from '../../typechain-types'
import { deploy } from '../utils/deploy'

const carolPlatformId = 1
const mintFee = 100

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<[TalentLayerID]> {
  const [deployer, , , carol] = await ethers.getSigners()
  const [talentLayerID, talentLayerPlatformID] = await deploy(false)

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Update mint fee
  await talentLayerID.connect(deployer).updateMintFee(100)

  return [talentLayerID]
}

describe.only('Delegation System', function () {
  let alice: SignerWithAddress, bob: SignerWithAddress, dave: SignerWithAddress, talentLayerID: TalentLayerID

  before(async function () {
    ;[, alice, bob, , dave] = await ethers.getSigners()
    ;[talentLayerID] = await deployAndSetup()
  })

  it('Alice can add Bob to her delegators', async function () {
    await talentLayerID.connect(alice).addDelegator(bob.address)
    const isDelegator = await talentLayerID.isDelegator(alice.address, bob.address)
    expect(isDelegator).to.be.true
  })

  it('Bob can mint a TalentLayerID for Alice paying the mint fee', async function () {
    const tx = await talentLayerID.connect(bob).mintByDelegator(carolPlatformId, alice.address, 'bob', {
      value: mintFee,
    })
    const tlId = await talentLayerID.walletOfOwner(alice.address)
    expect(tlId).to.be.equal(1)

    await expect(tx).to.changeEtherBalances([alice, bob], [0, -mintFee])
  })

  it("Bob cannot mint a TalentLayerID for Dave, since he's not his delegator", async function () {
    const tx = talentLayerID.connect(bob).mintByDelegator(carolPlatformId, dave.address, 'dave', {
      value: mintFee,
    })
    expect(tx).to.be.revertedWith('You are not a delegator for this user')
  })

  it('Alice can remove Bob from her delegators', async function () {
    await talentLayerID.connect(alice).removeDelegator(bob.address)
    const isDelegator = await talentLayerID.isDelegator(alice.address, bob.address)
    expect(isDelegator).to.be.false
  })
})

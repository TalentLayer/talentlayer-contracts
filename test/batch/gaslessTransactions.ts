import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { MockForwarder, TalentLayerID, TalentLayerPlatformID } from '../../typechain-types'
import { deploy } from '../utils/deploy'

describe('Gasless Transactions', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    relayer: SignerWithAddress,
    talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    mockForwarder: MockForwarder

  before(async function () {
    ;[deployer, alice, bob, relayer] = await ethers.getSigners()
    ;[talentLayerID, talentLayerPlatformID] = await deploy(false)

    const MockForwarder = await ethers.getContractFactory('MockForwarder')
    mockForwarder = await MockForwarder.deploy()

    // Mint platform id for Alice
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, alice.address)

    await talentLayerPlatformID.connect(alice).mint('AlicePlat')
  })

  it('Deployer can add and remove a trusted forwarder for meta-transactions', async function () {
    // Fails if is not the owner
    const tx = talentLayerID.connect(alice).addTrustedForwarder(mockForwarder.address)
    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner')

    await talentLayerID.connect(deployer).addTrustedForwarder(mockForwarder.address)
    expect(await talentLayerID.isTrustedForwarder(mockForwarder.address)).to.be.true
  })

  it('Can send transaction through forwarder', async function () {
    const req: MockForwarder.ForwardRequestStruct = {
      from: bob.address,
      to: talentLayerID.address,
      value: 0,
      gas: 29022296,
      nonce: 0,
      data: talentLayerID.interface.encodeFunctionData('mint', [1, 'bob']),
      validUntilTime: 0,
    }

    const tx = mockForwarder.connect(relayer).execute(req)
    await expect(tx).to.not.be.reverted

    expect(await talentLayerID.walletOfOwner(bob.address)).to.be.equal('1')
  })

  it('Deployer can remove a trusted forwarder for meta-transactions', async function () {
    await talentLayerID.connect(deployer).removeTrustedForwarder(mockForwarder.address)
    expect(await talentLayerID.isTrustedForwarder(mockForwarder.address)).to.be.false
  })
})

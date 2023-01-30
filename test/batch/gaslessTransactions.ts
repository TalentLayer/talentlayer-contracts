import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { MockForwarder, TalentLayerID, TalentLayerPlatformID } from '../../typechain-types'
import { deploy } from '../utils/deploy'

describe('Gasless Transactions', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    relayer: SignerWithAddress,
    talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    mockForwarder: MockForwarder,
    req: MockForwarder.ForwardRequestStruct

  before(async function () {
    ;[deployer, alice, bob, carol, relayer] = await ethers.getSigners()
    ;[talentLayerID, talentLayerPlatformID] = await deploy(false)

    // Deploy mock forwarder
    const MockForwarder = await ethers.getContractFactory('MockForwarder')
    mockForwarder = await MockForwarder.deploy()

    // Mint platform id for Alice
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, alice.address)
    await talentLayerPlatformID.connect(alice).mint('AlicePlat')

    // Meta-transaction to mint a TalentLayer ID for Bob
    req = {
      from: bob.address,
      to: talentLayerID.address,
      value: 0,
      gas: 29022296,
      nonce: 0,
      data: talentLayerID.interface.encodeFunctionData('mint', [1, 'bob']),
      validUntilTime: 0,
    }
  })

  it('Bob cannot mint a TalentLayer ID with a meta-transaction if the forwarder is not trusted', async function () {
    // Relayer sends the meta-transaction to the forwarder
    const tx = mockForwarder.connect(relayer).execute(req)

    // If the forwarder is not trusted, the recipient contract will see the transaction as coming from the forwarder.
    // So, the recipient contract will revert in the mint function, since the forwarder is not a valid ERC721Receiver.
    await expect(tx).to.be.revertedWith('ERC721: transfer to non ERC721Receiver implementer')

    // The TalentLayer ID has not been minted for Bob
    expect(await talentLayerID.walletOfOwner(bob.address)).to.be.equal('0')
  })

  it('Deployer can add a trusted forwarder for meta-transactions', async function () {
    // Fails if is not the owner
    const tx = talentLayerID.connect(alice).addTrustedForwarder(mockForwarder.address)
    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner')

    await talentLayerID.connect(deployer).addTrustedForwarder(mockForwarder.address)
    expect(await talentLayerID.isTrustedForwarder(mockForwarder.address)).to.be.true
  })

  it('Bob can mint a TalentLayer ID with a meta-transaction if the forwarder is trusted', async function () {
    // Relayer sends the meta-transaction to the forwarder
    const tx = mockForwarder.connect(relayer).execute(req)
    await expect(tx).to.not.be.reverted

    expect(await talentLayerID.walletOfOwner(bob.address)).to.be.equal('1')
  })

  it('Deployer can remove a trusted forwarder for meta-transactions', async function () {
    await talentLayerID.connect(deployer).removeTrustedForwarder(mockForwarder.address)
    expect(await talentLayerID.isTrustedForwarder(mockForwarder.address)).to.be.false

    // Meta-transactions with the removed forwarder won't work anymore
    const tx = mockForwarder.connect(relayer).execute({
      from: carol.address,
      to: talentLayerID.address,
      value: 0,
      gas: 29022296,
      nonce: 0,
      data: talentLayerID.interface.encodeFunctionData('mint', [1, 'carol']),
      validUntilTime: 0,
    })

    await expect(tx).to.be.revertedWith('ERC721: transfer to non ERC721Receiver implementer')
  })
})

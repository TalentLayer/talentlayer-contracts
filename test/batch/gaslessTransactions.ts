import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { MockForwarder, TalentLayerID, TalentLayerPlatformID } from '../../typechain-types'
import { MintStatus } from '../utils/constant'
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
    await talentLayerPlatformID.connect(deployer).whitelistUser(alice.address)
    await talentLayerPlatformID.connect(alice).mint('aliceplat')

    // Disable whitelist for reserved handles
    await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

    // Meta-transaction to mint a TalentLayer ID for Bob
    req = {
      from: bob.address,
      to: talentLayerID.address,
      value: 0,
      gas: 29022296,
      nonce: 0,
      data: talentLayerID.interface.encodeFunctionData('mint', [1, 'bob__']),
      validUntilTime: 0,
    }
  })

  it('If the forwarder is not trusted the tl ID will be received by the forwarder rather than bob', async function () {
    // Relayer sends the meta-transaction to the forwarder
    await mockForwarder.connect(relayer).execute(req)

    // If the forwarder is not trusted, the recipient contract will see the transaction as coming from the forwarder. So the ID will be minted for the forwarder
    // The TalentLayer ID has not been minted for Bob
    expect(await talentLayerID.ids(bob.address)).to.be.equal('0')
    expect(await talentLayerID.ids(mockForwarder.address)).to.be.equal('1')
  })

  it('Deployer can add a trusted forwarder for meta-transactions', async function () {
    // Fails if is not the owner
    const tx = talentLayerID.connect(alice).addTrustedForwarder(mockForwarder.address)
    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner')

    await talentLayerID.connect(deployer).addTrustedForwarder(mockForwarder.address)
    expect(await talentLayerID.isTrustedForwarder(mockForwarder.address)).to.be.true
  })

  it('Bob can mint a TalentLayer ID with a meta-transaction if the forwarder is trusted', async function () {
    req.data = talentLayerID.interface.encodeFunctionData('mint', [1, 'bob__2'])
    // Relayer sends the meta-transaction to the forwarder
    const tx = mockForwarder.connect(relayer).execute(req)
    await expect(tx).to.not.be.reverted

    expect(await talentLayerID.ids(bob.address)).to.be.equal('2')
  })

  it('Deployer can remove a trusted forwarder for meta-transactions', async function () {
    // Fails if is not the owner
    const tx = talentLayerID.connect(alice).removeTrustedForwarder(mockForwarder.address)
    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner')

    await talentLayerID.connect(deployer).removeTrustedForwarder(mockForwarder.address)
    expect(await talentLayerID.isTrustedForwarder(mockForwarder.address)).to.be.false

    // Meta-transactions with the removed forwarder won't work anymore
    const tx2 = mockForwarder.connect(relayer).execute({
      from: carol.address,
      to: talentLayerID.address,
      value: 0,
      gas: 29022296,
      nonce: 0,
      data: talentLayerID.interface.encodeFunctionData('mint', [1, 'carol']),
      validUntilTime: 0,
    })

    await expect(tx2).to.be.revertedWith('You already have a TalentLayerID')
  })
})

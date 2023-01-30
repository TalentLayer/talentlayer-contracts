import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { MockForwarder, TalentLayerID } from '../../typechain-types'
import { deploy } from '../utils/deploy'

describe('Gasless Transactions', function () {
  let deployer: SignerWithAddress, alice: SignerWithAddress, talentLayerID: TalentLayerID, mockForwarder: MockForwarder

  before(async function () {
    ;[deployer, alice] = await ethers.getSigners()
    ;[talentLayerID] = await deploy(false)

    const MockForwarder = await ethers.getContractFactory('MockForwarder')
    mockForwarder = await MockForwarder.deploy()
  })

  it('Deployer can add and remove a trusted forwarder for meta-transactions', async function () {
    // Fails if is not the owner
    const tx = talentLayerID.connect(alice).addTrustedForwarder(mockForwarder.address)
    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner')

    await talentLayerID.connect(deployer).addTrustedForwarder(mockForwarder.address)
    expect(await talentLayerID.isTrustedForwarder(mockForwarder.address)).to.be.true

    await talentLayerID.connect(deployer).removeTrustedForwarder(mockForwarder.address)
    expect(await talentLayerID.isTrustedForwarder(mockForwarder.address)).to.be.false
  })
})

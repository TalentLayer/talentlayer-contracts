import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerID } from '../../typechain-types'
import { deploy } from '../utils/deploy'

describe('Gasless Transactions', function () {
  let deployer: SignerWithAddress, alice: SignerWithAddress, talentLayerID: TalentLayerID

  before(async function () {
    ;[deployer, alice] = await ethers.getSigners()
    ;[talentLayerID] = await deploy(false)
  })

  it('Deployer can add and remove a trusted forwarder for meta-transactions', async function () {
    const forwarderAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'

    // Fails if is not the owner
    const tx = talentLayerID.connect(alice).addTrustedForwarder(forwarderAddress)
    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner')

    await talentLayerID.connect(deployer).addTrustedForwarder(forwarderAddress)
    expect(await talentLayerID.isTrustedForwarder(forwarderAddress)).to.be.true

    await talentLayerID.connect(deployer).removeTrustedForwarder(forwarderAddress)
    expect(await talentLayerID.isTrustedForwarder(forwarderAddress)).to.be.false
  })
})

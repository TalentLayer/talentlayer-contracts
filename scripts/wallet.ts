import { Wallet } from 'ethers'
import { formatEther, formatUnits, getAddress, parseEther, parseUnits } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

task('private', 'Prints the private key', async (args, { ethers }) => {
  let mnemonic = process.env.MNEMONIC || ''
  let mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic)
  console.log(mnemonicWallet.privateKey)
})

task('generate', 'Generate random mnemonic')
  .addOptionalPositionalParam('token', 'token address')
  .setAction(async (args, { ethers }) => {
    const wallet = Wallet.createRandom()

    console.log('New wallet created')
    console.log('  address: ', wallet.address)
    console.log('  mnemonic:', wallet.mnemonic.phrase)
  })

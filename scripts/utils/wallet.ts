import { Wallet } from 'ethers'
import { task } from 'hardhat/config'

task('private', 'Prints the private key', async (args, { ethers }) => {
  const mnemonic = process.env.MNEMONIC || ''
  const mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic)
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

// function to wait a few confirmation before continuing

import { ContractTransaction } from 'ethers'

export const waitConfirmations = (
  network: string,
  tx: ContractTransaction,
  confirmations?: number,
) => {
  if (network === 'localhost') {
    return tx.wait(0)
  } else {
    return tx.wait(confirmations)
  }
}

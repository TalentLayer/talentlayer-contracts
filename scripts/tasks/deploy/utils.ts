export async function verifyAddress(
  address: string,
  constructorArguments?: Array<any>,
): Promise<string> {
  let count = 0
  const maxTries = 15
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await delay(10000)
    try {
      console.log('Verifying contract at', address)
      // @ts-ignore
      await run('verify:verify', {
        address: address,
        constructorArguments: constructorArguments,
      })
      break
    } catch (error) {
      if (String(error).includes('Already Verified')) {
        console.log(`Already verified contract at address ${address}`)
        break
      }
      if (++count == maxTries) {
        console.log(`Failed to verify contract at address ${address}, error: ${error}`)
        break
      }
      console.log(`Retrying... Retry #${count}, last error: ${error}`)
    }
  }

  return address
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

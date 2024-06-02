/* eslint-disable no-console */
import { create, IPFSHTTPClient } from 'ipfs-http-client'

const postToIPFS = async (data: any): Promise<string> => {
  let ipfs: IPFSHTTPClient | undefined
  let uri = ''
  try {
    const authorization =
      'Basic ' +
      Buffer.from(process.env.INFURA_ID + ':' + process.env.INFURA_SECRET, 'utf8').toString(
        'base64',
      )

    ipfs = create({
      // url: 'http://localhost:5001/api/v0', // use this url if you want to work with your local docker ipfs node and test for the graph
      url: 'https://infura-ipfs.io:5001/api/v0',
      headers: {
        authorization,
      },
    })
    const result = await (ipfs as IPFSHTTPClient).add(data)
    uri = `${result.path}`
  } catch (error) {
    console.error('IPFS error ', error)
  }
  return uri
}

export default postToIPFS

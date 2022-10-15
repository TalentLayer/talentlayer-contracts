/* eslint-disable no-console */
import { create, IPFSHTTPClient } from "ipfs-http-client";

const postToIPFS = async (data: any): Promise<string> => {
  let ipfs: IPFSHTTPClient | undefined;
  let path = "";
  try {
    const authorization =
      //   "Basic " +
      //   Buffer.from(
      //     process.env.INFURA_ID + ":" + process.env.INFURA_SECRET
      //   ).toString("base64");
      "Basic " + btoa(process.env.INFURA_ID + ":" + process.env.INFURA_SECRET);
    ipfs = create({
      url: "https://infura-ipfs.io:5001/api/v0",
      headers: {
        authorization,
      },
    });
    const result = await (ipfs as IPFSHTTPClient).add(data);
    path = `https://infura-ipfs.io/ipfs/${result.path}`;
    console.log(path);
  } catch (error) {
    console.error("IPFS error ", error);
  }
  return path;
};

export default postToIPFS;

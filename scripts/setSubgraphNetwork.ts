import fs from "fs";
import hre from "hardhat";
import { getConfig } from "../configManager";

async function main() {
  const network = await hre.network.name;

  const config = getConfig(network);
  const subgraphNetwork = JSON.parse(loadJSON());

  if (network == "localhost") {
    subgraphNetwork.xdai.TalentLayerID.address = config.talentLayerIdAddress;
    subgraphNetwork.xdai.TalentLayerReview.address =
      config.talentLayerReviewAddress;
    subgraphNetwork.xdai.JobRegistry.address = config.jobRegistryAddress;
    subgraphNetwork.xdai.TalentLayerMultipleArbitrableTransaction.address =
      config.TalentLayerMultipleArbitrableTransaction;
  }
  if (network == "goerli") {
    subgraphNetwork.goerli.TalentLayerID.address = config.talentLayerIdAddress;
    subgraphNetwork.goerli.TalentLayerReview.address =
      config.talentLayerReviewAddress;
    subgraphNetwork.goerli.JobRegistry.address = config.jobRegistryAddress;
    subgraphNetwork.goerli.TalentLayerMultipleArbitrableTransaction.address =
      config.TalentLayerMultipleArbitrableTransaction;
    subgraphNetwork.goerli.proofOfHumanityAddress.address =
      config.proofOfHumanityAddress;
  }

  saveJSON(subgraphNetwork);
}

function loadJSON() {
  const filename = `${process.env.SUBGRAPH_FOLDER}/networks.json`;
  return fs.existsSync(filename) ? fs.readFileSync(filename).toString() : "{}";
}

function saveJSON(subgraphNetwork: any) {
  const filename = `${process.env.SUBGRAPH_FOLDER}/networks.json`;
  return fs.writeFileSync(filename, JSON.stringify(subgraphNetwork, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

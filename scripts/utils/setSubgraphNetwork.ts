import fs from 'fs'
import hre from 'hardhat'
import { getDeploymennt } from '../../.deployment/deploymentManager'

async function main() {
  const network = hre.network.name

  const config = getDeploymennt(network)
  const subgraphNetwork = JSON.parse(loadJSON())

  if (network == 'localhost') {
    subgraphNetwork.localhost.TalentLayerID.address = config.talentLayerIdAddress
    subgraphNetwork.localhost.TalentLayerReview.address = config.talentLayerReviewAddress
    subgraphNetwork.localhost.TalentLayerService.address = config.talentLayerServiceAddress
    subgraphNetwork.localhost.TalentLayerEscrow.address = config.talentLayerEscrowAddress
    subgraphNetwork.localhost.TalentLayerPlatformID.address = config.talentLayerPlatformIdAddress
  } else if (network == 'fuji') {
    subgraphNetwork.fuji.TalentLayerID.address = config.talentLayerIdAddress
    subgraphNetwork.fuji.TalentLayerReview.address = config.talentLayerReviewAddress
    subgraphNetwork.fuji.TalentLayerService.address = config.talentLayerServiceAddress
    subgraphNetwork.fuji.TalentLayerEscrow.address = config.talentLayerEscrowAddress
    subgraphNetwork.fuji.TalentLayerPlatformID.address = config.talentLayerPlatformIdAddress
  } else if (network == 'mumbai') {
    subgraphNetwork.mumbai.TalentLayerID.address = config.talentLayerIdAddress
    subgraphNetwork.mumbai.TalentLayerReview.address = config.talentLayerReviewAddress
    subgraphNetwork.mumbai.TalentLayerService.address = config.talentLayerServiceAddress
    subgraphNetwork.mumbai.TalentLayerEscrow.address = config.talentLayerEscrowAddress
    subgraphNetwork.mumbai.TalentLayerPlatformID.address = config.talentLayerPlatformIdAddress
  } else if (network == 'avalanche') {
    subgraphNetwork.avalanche.TalentLayerID.address = config.talentLayerIdAddress
    subgraphNetwork.avalanche.TalentLayerReview.address = config.talentLayerReviewAddress
    subgraphNetwork.avalanche.TalentLayerService.address = config.talentLayerServiceAddress
    subgraphNetwork.avalanche.TalentLayerEscrow.address = config.talentLayerEscrowAddress
    subgraphNetwork.avalanche.TalentLayerPlatformID.address = config.talentLayerPlatformIdAddress
  } else if (network == 'polygon') {
    subgraphNetwork.polygon.TalentLayerID.address = config.talentLayerIdAddress
    subgraphNetwork.polygon.TalentLayerReview.address = config.talentLayerReviewAddress
    subgraphNetwork.polygon.TalentLayerService.address = config.talentLayerServiceAddress
    subgraphNetwork.polygon.TalentLayerEscrow.address = config.talentLayerEscrowAddress
    subgraphNetwork.polygon.TalentLayerPlatformID.address = config.talentLayerPlatformIdAddress
  }

  saveJSON(subgraphNetwork)
}

function loadJSON() {
  const filename = `${process.env.SUBGRAPH_FOLDER}/networks.json`
  return fs.existsSync(filename) ? fs.readFileSync(filename).toString() : '{}'
}

function saveJSON(subgraphNetwork: any) {
  const filename = `${process.env.SUBGRAPH_FOLDER}/networks.json`
  return fs.writeFileSync(filename, JSON.stringify(subgraphNetwork, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

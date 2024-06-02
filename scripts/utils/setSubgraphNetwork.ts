import fs from 'fs'
import hre from 'hardhat'
import { getDeploymennt } from '../../.deployment/deploymentManager'

async function main() {
  const network = hre.network.name

  const config = getDeploymennt(network)
  const subgraphNetwork = JSON.parse(loadJSON())

  subgraphNetwork[network].TalentLayerID.address = config.talentLayerIdAddress
  subgraphNetwork[network].TalentLayerReview.address = config.talentLayerReviewAddress
  subgraphNetwork[network].TalentLayerService.address = config.talentLayerServiceAddress
  subgraphNetwork[network].TalentLayerEscrow.address = config.talentLayerEscrowAddress
  subgraphNetwork[network].TalentLayerPlatformID.address = config.talentLayerPlatformIdAddress

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

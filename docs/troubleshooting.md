# Troubleshooting

- use node version: v16.19 (lts/gallium) (some dependencies are not compatible with higher node version)

## Deploy

- Due to slow network on sometimes on testnet, there is a wait in the execution off `setup-allFakeData`
- Error `no such file or directory, open ... artifacts`: run `npx hardhat clean`
- Error: `IPFS error FetchError [...] connect ETIMEDOUT`: try to switch your Wi-Fi network

## Subgraph

- If you have some issues using Graph-CLI command, please install it globally
- if the `make regenerate` or npm command doesn't work correctly please launch the graph command individually

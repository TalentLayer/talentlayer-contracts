
## Workflow

> **Step 1 : Contract deployment**

- Check if all the .env variable is complete
- select the network by changing the variable DEPLOY_NETWORK =...
- Run the  make command you want
  - add : ``--use-pohmock`` will use the POH Mock
  - add : `` --use-test-erc20`` will deploy a ERC20 token
  - add : `` --verify `` will verify the contract on the network scan
 - Add the deployed contract address in the README.md file
 

> **Step 2 : Subgraph setup**
> > **Step 2.1 : Check list**

- Check if your abis are up to date and match with the deployed contract
- Add the deployed contract addresses to the network.json file (in the corresponding network object) & select your start block
- Check that the Graph-CLI is well install (if issue using graph command, please install it globally)
- Check the make file command (if the ``make regenerate`` command doesn't work correctly please launch the graph command individualy)
- If you deploy the subgraph for the first time, please create an account on The Graph platform then create a new subgraph then get your access token

>> **Step 2.2 : Deploying your subgraph**
>> 
WARN !! : if the npm command or make command doesn't work correctly please launch the full graph command
  
1) ``graph codegen`` (it will generate the generated folder)
2) `` graph build --network <your Network>`` (it will generate the build folder and add the network.json addresses in the subgraph.yaml)
3) if you deploy you graph for the first time please authenticated yourself with this command :
``graph auth --network <your Network> --product hosted-service <your access token>`` 
4) `` graph deploy --product hosted-service <path of your subgraph>``
  
 After the last command you should see on your subgraph dashboard some deployment logs
 
 
 > **Step 3 : update your front end**
 - Fill the .env varaibles 
 - Fill the network const with the right deployed addresses in the **src > config.ts** file
 - Select the chain you want in the const chain in the **src > App.tx** / ex : **const chains: any = [goerli]** to use the front on Goerli
 - Add the right network id in **Menu.Item** component in **component > NetworkSwitch.tsx**
 - Launch ``npm run dev`` to use the front end on the selected network
  
 
  

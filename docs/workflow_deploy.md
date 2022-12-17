
## Workflow

> **Step 1 : Contract deployment**

- Fill the .env file
- Select the network by changing the variable DEPLOY_NETWORK ="..."
- Run the command ``make deploy`` to deploy the contracts 

**INFO** : please check the others ``make command`` to custom your deployment

-------------
 

> **Step 2 : Subgraph setup**
> > **Step 2.1 : Check list**

- Check if your abis are up to date and match with the deployed contract
- Add the deployed contract addresses to the network.json file (in the corresponding network object) & select your start block
- Check if the graph-cli is properly installed
- Check the make file command 

**INFO** :  If you deploy the subgraph for the first time, please create an account on The Graph platform then create a new subgraph then get your access token


>> **Step 2.2 : Deploying your subgraph**
  
1) ``graph codegen`` (it will generate the generated folder)
2) `` graph build --network <your network>`` (it will generate the build folder and add the network.json addresses in the subgraph.yaml)
3) if you deploy you graph for the first time please authenticated yourself with this command :
``graph auth --network <your network> --product hosted-service <your access token>`` 
4) `` graph deploy --product hosted-service <path of your subgraph>``
  
 **INFO** : After the last command you should see on your subgraph dashboard some deployment logs
 
 -------------
 
 > **Step 3 : update the front end**
 - Fill the .env variables 
 - Fill the network const with the right deployed addresses in the **src > config.ts** file
 - Select the chain you want in the const chain in the **src > App.tx** / ex : **const chains: any = [goerli]** to use the front on Goerli
 - Add the right network id in **Menu.Item** component in **component > NetworkSwitch.tsx**
 - Launch ``npm run dev`` to use the front end on the selected network

 -------------

### Possible issues

> Subgraph
- If you have some issues using Graph-CLI command, please install it globally
- if the ``make regenerate`` or npm command doesn't work correctly please launch the graph command individualy
 
  

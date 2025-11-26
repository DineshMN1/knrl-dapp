// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/Ticketing.sol"; 

contract DeployTicketingScript is Script {
    function run() external {
        // Get private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get delegated account address from env - REQUIRED
        address delegatedAccountImpl = vm.envAddress("DELEGATED_ACCOUNT_ADDRESS");
        require(delegatedAccountImpl != address(0), "DELEGATED_ACCOUNT_ADDRESS must be set");

        console.log("Deploying TicketingTarget...");
        console.log("Deployer:", deployer);
        console.log("DelegatedAccountImpl:", delegatedAccountImpl);

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy TicketingTarget
        // Using deployer as masterKey, recoveryKey and owner (for now)
        TicketingTarget ticketing = new TicketingTarget(
            deployer,             // masterKey
            deployer,             // recoveryKey
            deployer,             // owner
            delegatedAccountImpl  // delegatedAccountImpl
        );

        console.log("TicketingTarget deployed at:", address(ticketing));

        // Stop broadcasting
        vm.stopBroadcast();

        
        console.log("TICKETING_ADDRESS=", address(ticketing));
    }
}

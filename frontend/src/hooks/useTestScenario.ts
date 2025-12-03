// // src/hooks/useTestScenario.ts
// import { useState } from 'react';
// import { useWallets } from '@privy-io/react-auth';
// import toast from 'react-hot-toast';
// import {
//   encodePacked,
//   keccak256,
//   createPublicClient,
//   http,
//   getContract
// } from 'viem';
// import { sepolia } from 'viem/chains';
// import { useKRNL, useNodeConfig, type TransactionIntentParams, type PrivyEmbeddedWallet } from '@krnl-dev/sdk-react-7702';
// import ticketCreateTemplate from '../workflows/ticket-create.json';
// import TicketingABI from '../contracts/TicketingTarget.json';
// import { RPC_URL, TICKETING_CONTRACT_ADDRESS, TARGET_CONTRACT_OWNER, ATTESTOR_IMAGE } from '../const';
// import type { ABIInput, ABIFunction } from '../types';

// const DEFAULT_NODE_RPC = 'https://node.krnl.xyz'; 

// export const useTestScenario = () => {
//   const { wallets } = useWallets();
//   const {
//     signTransactionIntent,
//     resetSteps,
//     error: sdkError,
//     statusCode,
//     steps,
//     currentStep
//   } = useKRNL();
//   const { getConfig } = useNodeConfig();
//   const [error, setError] = useState<string | null>(null);

//   const getEmbeddedWallet = (): PrivyEmbeddedWallet => {
//     const embeddedWallet = wallets.find(w => w.connectorType === 'embedded' && w.walletClientType === 'privy');
//     if (!embeddedWallet?.address) throw new Error('No embedded wallet found');
//     return embeddedWallet;
//   };

//   const getContractNonce = async (embeddedWallet: PrivyEmbeddedWallet): Promise<bigint> => {
//     try {
//       const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
//       const contract = getContract({ address: TICKETING_CONTRACT_ADDRESS as `0x${string}`, abi: TicketingABI, client });

//       if (contract.read && (contract.read as any).nonces) {
//         return await contract.read.nonces([embeddedWallet.address]) as bigint;
//       }

//       const nodeConfig = await getConfig();
//       if (nodeConfig && (nodeConfig.workflow as any).nonce) {
//         return BigInt((nodeConfig.workflow as any).nonce);
//       }

//       return BigInt(Math.floor(Date.now() / 1000));
//     } catch (err) {
//       console.warn('getContractNonce fallback due to:', err);
//       return BigInt(Math.floor(Date.now() / 1000));
//     }
//   };

//   const buildTypeString = (input: ABIInput): string => {
//     if (input.type === 'tuple') {
//       const components = input.components?.map((comp) => buildTypeString(comp)).join(',') || '';
//       return `(${components})`;
//     } else if (input.type === 'tuple[]') {
//       const components = input.components?.map((comp) => buildTypeString(comp)).join(',') || '';
//       return `(${components})[]`;
//     } else {
//       return input.type;
//     }
//   };

//   const getFunctionSelector = (): string => {
//     const targetFunctionName = 'createEvent';
//     const fn = (TicketingABI as ABIFunction[]).find(i => i.type === 'function' && i.name === targetFunctionName);
//     if (!fn) throw new Error(`Function ${targetFunctionName} not found in ABI`);
//     const functionSig = `${targetFunctionName}(${fn.inputs.map((input) => buildTypeString(input)).join(',')})`;
//     const sel = keccak256(encodePacked(['string'], [functionSig])).slice(0, 10);
//     if (!sel || sel.length !== 10) throw new Error(`Invalid function selector: ${sel}`);
//     return sel;
//   };

//   const createTransactionIntent = (embeddedWallet: PrivyEmbeddedWallet, nonce: bigint, nodeAddress: string): TransactionIntentParams => {
//     const deadline = Math.floor(Date.now() / 1000) + 3600;
//     const functionSelector = getFunctionSelector();

//     const intentId = keccak256(encodePacked(
//       ['address', 'uint256', 'uint256'],
//       [embeddedWallet.address as `0x${string}`, nonce, BigInt(deadline)]
//     )) as `0x${string}`;

//     return {
//       target: TICKETING_CONTRACT_ADDRESS as `0x${string}`,
//       value: BigInt(0),
//       id: intentId,
//       nodeAddress: nodeAddress as `0x${string}`,
//       delegate: TARGET_CONTRACT_OWNER as `0x${string}`,
//       targetFunction: functionSelector as `0x${string}`,
//       nonce,
//       deadline: BigInt(deadline)
//     };
//   };

//   const createTemplateReplacements = (
//     embeddedWallet: PrivyEmbeddedWallet,
//     transactionIntent: TransactionIntentParams,
//     signature: string,
//     eventName?: string,
//     eventDescription?: string,
//     eventHost?: string,
//     eventLocation?: string,
//     eventStartUnix?: string,
//     eventMaxPeople?: string,
//     eventPriceWei?: string
//   ): Record<string, string> => {
//     return {
//       '{{ENV.SENDER_ADDRESS}}': embeddedWallet.address,
//       '{{ENV.TARGET_CONTRACT}}': TICKETING_CONTRACT_ADDRESS,
//       '{{ENV.ATTESTOR_IMAGE}}': ATTESTOR_IMAGE || '',
//       '{{USER_SIGNATURE}}': signature,
//       '{{TRANSACTION_INTENT_VALUE}}': transactionIntent.value.toString(),
//       '{{TRANSACTION_INTENT_ID}}': transactionIntent.id,
//       '{{TRANSACTION_INTENT_DELEGATE}}': transactionIntent.delegate,
//       '{{TRANSACTION_INTENT_DEADLINE}}': transactionIntent.deadline.toString(),
//       '{{EVENT_NAME}}': eventName || 'Sample Event',
//       '{{EVENT_DESCRIPTION}}': eventDescription || 'Test event created via workflow',
//       '{{EVENT_HOST}}': eventHost || 'Organizer',
//       '{{EVENT_LOCATION}}': eventLocation || 'Venue Address',
//       '{{EVENT_START_UNIX}}': eventStartUnix ? eventStartUnix : String(Math.floor(Date.now() / 1000) + 86400),
//       '{{EVENT_MAX_PEOPLE}}': eventMaxPeople ? eventMaxPeople : '100',
//       '{{EVENT_PRICE_WEI}}': eventPriceWei ? eventPriceWei : '10000000000000000'
//     };
//   };

//   // Lightweight placeholder substitution (global)
//   const applyReplacementsToString = (templateStr: string, replacements: Record<string, string>) => {
//     let out = templateStr;
//     for (const [k, v] of Object.entries(replacements)) {
//       // escape regex chars in key
//       const keyEsc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//       out = out.replace(new RegExp(keyEsc, 'g'), String(v));
//     }
//     return out;
//   };

//   const executeTestWorkflow = async (
//     scenarioType: 'B' = 'B',
//     eventName?: string,
//     _eventLocation?: string,
//     _eventPriceHuman?: string,
//     eventDescription?: string,
//     eventHost?: string,
//     eventLocation?: string,
//     eventStartUnix?: string,
//     eventMaxPeople?: string,
//     eventPriceWei?: string
//   ) => {
//     setError(null);
//     resetSteps();

//     try {
//       const embeddedWallet = getEmbeddedWallet();
//       await embeddedWallet.switchChain?.(11155111);

//       const nodeConfig = await getConfig();
//       if (!nodeConfig || !nodeConfig.workflow || !nodeConfig.workflow.node_address) {
//         // still allow proceed — node RPC fallback will be used for URL, but we need node_address for intent
//         if (!nodeConfig || !nodeConfig.workflow || !nodeConfig.workflow.node_address) {
//           throw new Error('Node address not available from KRNL node configuration.');
//         }
//       }

//       const nonce = await getContractNonce(embeddedWallet);
//       const transactionIntent = createTransactionIntent(embeddedWallet, nonce, nodeConfig.workflow.node_address);
//       const signature = await signTransactionIntent(transactionIntent);

//       // Convert human price -> wei if provided as human string
//       let finalPriceWei = eventPriceWei;
//       if (!finalPriceWei && _eventPriceHuman) {
//         try {
//           const parts = (_eventPriceHuman || '').split('.');
//           const whole = BigInt(parts[0] || '0');
//           const frac = (parts[1] || '').padEnd(18, '0').slice(0, 18);
//           finalPriceWei = (whole * 10n ** 18n + BigInt(frac)).toString();
//         } catch {
//           finalPriceWei = '10000000000000000';
//         }
//       }

//       const replacements = createTemplateReplacements(
//         embeddedWallet,
//         transactionIntent,
//         signature,
//         eventName,
//         eventDescription,
//         eventHost,
//         eventLocation,
//         eventStartUnix ? String(Math.floor(Number(eventStartUnix))) : undefined,
//         eventMaxPeople ? String(Math.floor(Number(eventMaxPeople))) : undefined,
//         finalPriceWei
//       );

//       // Prepare payload by applying replacements into the imported template JSON (string-level replace)
//       let templateStr = JSON.stringify(ticketCreateTemplate || {});
//       templateStr = applyReplacementsToString(templateStr, replacements);
//       let payloadToSend: any = JSON.parse(templateStr);

//       // Force exact "steps": [] (empty array) — this guarantees the node receives steps: []
//       payloadToSend.workflow = {
//         ...(payloadToSend.workflow || {}),
//         steps: []
//       };

//       // Build JSON-RPC request body
//       const rpcBody = {
//         jsonrpc: '2.0',
//         method: 'krnl_executeWorkflow',
//         params: [payloadToSend],
//         id: 1
//       };

//       // Determine node RPC URL
//       const nodeRpcUrl =
//         (nodeConfig && ((nodeConfig.workflow as any)?.rpc_url || (nodeConfig.workflow as any)?.node_rpc)) ||
//         DEFAULT_NODE_RPC;

//       // DEBUG output (console)
//       console.log('Final workflow payload (will be sent):', JSON.stringify(payloadToSend, null, 2));
//       console.log('Node RPC URL:', nodeRpcUrl);

//       // Send JSON-RPC to node directly so serialization is controlled (ensures "steps": [])
//       const resp = await fetch(nodeRpcUrl, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(rpcBody)
//       });

//       const text = await resp.text();
//       let json;
//       try { json = JSON.parse(text); } catch { json = text; }

//       console.log('krnl_executeWorkflow response status:', resp.status, resp.statusText);
//       console.log('krnl_executeWorkflow response body:', json);

//       if (!resp.ok) {
//         const errMsg = typeof json === 'object' ? JSON.stringify(json) : String(json);
//         throw new Error(`Node returned HTTP ${resp.status}: ${errMsg}`);
//       }

//       // Optionally: you may want to set some UI state here, or poll the node for status.
//       // We log the node response and let your normal useKRNL hooks handle step tracking if configured.

//     } catch (err: any) {
//       const message = err?.message || String(err);
//       setError(message);
//       toast.error(message);
//       console.error('executeTestWorkflow error:', err);
//     }
//   };

//   return {
//     executeWorkflow: executeTestWorkflow,
//     resetSteps,
//     error: error || sdkError,
//     statusCode,
//     steps,
//     currentStep
//   };
// };


// src/hooks/useTestScenario.ts
import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import toast from 'react-hot-toast';
import {
  encodePacked,
  keccak256,
  createPublicClient,
  http,
  getContract
} from 'viem';
import { sepolia } from 'viem/chains';
import { useKRNL, useNodeConfig, type TransactionIntentParams, type PrivyEmbeddedWallet } from '@krnl-dev/sdk-react-7702';
import ticketCreateTemplate from '../workflows/ticket-create.json';
import TicketingABI from '../contracts/TicketingTarget.json';
import { RPC_URL, TICKETING_CONTRACT_ADDRESS, TARGET_CONTRACT_OWNER, ATTESTOR_IMAGE } from '../const';
import type { ABIInput, ABIFunction } from '../types';

const DEFAULT_NODE_RPC = 'https://node.krnl.xyz'; // change if required

export const useTestScenario = () => {
  const { wallets } = useWallets();
  const {
    signTransactionIntent,
    resetSteps,
    error: sdkError,
    statusCode,
    steps,
    currentStep
  } = useKRNL();
  const { getConfig } = useNodeConfig();
  const [error, setError] = useState<string | null>(null);

  const getEmbeddedWallet = (): PrivyEmbeddedWallet => {
    const embeddedWallet = wallets.find(w => w.connectorType === 'embedded' && w.walletClientType === 'privy');
    if (!embeddedWallet?.address) throw new Error('No embedded wallet found');
    return embeddedWallet;
  };

  const getContractNonce = async (embeddedWallet: PrivyEmbeddedWallet): Promise<bigint> => {
    try {
      const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
      const contract = getContract({ address: TICKETING_CONTRACT_ADDRESS as `0x${string}`, abi: TicketingABI, client });

      // If contract exposes nonces(address)
      if (contract.read && (contract.read as any).nonces) {
        return await contract.read.nonces([embeddedWallet.address]) as bigint;
      }

      // fallback: try node config
      const nodeCfg = await getConfig();
      if (nodeCfg && (nodeCfg.workflow as any)?.nonce) {
        return BigInt((nodeCfg.workflow as any).nonce);
      }

      // last resort: timestamp
      return BigInt(Math.floor(Date.now() / 1000));
    } catch (err) {
      console.warn('getContractNonce fallback due to:', err);
      return BigInt(Math.floor(Date.now() / 1000));
    }
  };

  const buildTypeString = (input: ABIInput): string => {
    if (input.type === 'tuple') {
      const components = input.components?.map((comp) => buildTypeString(comp)).join(',') || '';
      return `(${components})`;
    } else if (input.type === 'tuple[]') {
      const components = input.components?.map((comp) => buildTypeString(comp)).join(',') || '';
      return `(${components})[]`;
    } else {
      return input.type;
    }
  };

  const getFunctionSelector = (): string => {
    const targetFunctionName = 'createEvent';
    const fn = (TicketingABI as ABIFunction[]).find(i => i.type === 'function' && i.name === targetFunctionName);
    if (!fn) throw new Error(`Function ${targetFunctionName} not found in ABI`);
    const functionSig = `${targetFunctionName}(${fn.inputs.map((input) => buildTypeString(input)).join(',')})`;
    const sel = keccak256(encodePacked(['string'], [functionSig])).slice(0, 10);
    if (!sel || sel.length !== 10) throw new Error(`Invalid function selector: ${sel}`);
    return sel;
  };

  const createTransactionIntent = (embeddedWallet: PrivyEmbeddedWallet, nonce: bigint, nodeAddress: string): TransactionIntentParams => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const functionSelector = getFunctionSelector();

    const intentId = keccak256(encodePacked(
      ['address', 'uint256', 'uint256'],
      [embeddedWallet.address as `0x${string}`, nonce, BigInt(deadline)]
    )) as `0x${string}`;

    return {
      target: TICKETING_CONTRACT_ADDRESS as `0x${string}`,
      value: BigInt(0),
      id: intentId,
      nodeAddress: nodeAddress as `0x${string}`,
      delegate: TARGET_CONTRACT_OWNER as `0x${string}`,
      targetFunction: functionSelector as `0x${string}`,
      nonce,
      deadline: BigInt(deadline)
    };
  };

  const createTemplateReplacements = (
    embeddedWallet: PrivyEmbeddedWallet,
    transactionIntent: TransactionIntentParams,
    signature: string,
    eventName?: string,
    eventDescription?: string,
    eventHost?: string,
    eventLocation?: string,
    eventStartUnix?: string,
    eventMaxPeople?: string,
    eventPriceWei?: string
  ): Record<string, string> => {
    return {
      '{{ENV.SENDER_ADDRESS}}': embeddedWallet.address,
      '{{ENV.TARGET_CONTRACT}}': TICKETING_CONTRACT_ADDRESS,
      '{{ENV.ATTESTOR_IMAGE}}': ATTESTOR_IMAGE || '',
      '{{USER_SIGNATURE}}': signature,
      '{{TRANSACTION_INTENT_VALUE}}': transactionIntent.value.toString(),
      '{{TRANSACTION_INTENT_ID}}': transactionIntent.id,
      '{{TRANSACTION_INTENT_DELEGATE}}': transactionIntent.delegate,
      '{{TRANSACTION_INTENT_DEADLINE}}': transactionIntent.deadline.toString(),
      '{{EVENT_NAME}}': eventName || 'Sample Event',
      '{{EVENT_DESCRIPTION}}': eventDescription || 'Test event created via workflow',
      '{{EVENT_HOST}}': eventHost || 'Organizer',
      '{{EVENT_LOCATION}}': eventLocation || 'Venue Address',
      '{{EVENT_START_UNIX}}': eventStartUnix ? eventStartUnix : String(Math.floor(Date.now() / 1000) + 86400),
      '{{EVENT_MAX_PEOPLE}}': eventMaxPeople ? eventMaxPeople : '100',
      '{{EVENT_PRICE_WEI}}': eventPriceWei ? eventPriceWei : '10000000000000000'
    };
  };

  // simple global replacer (string-based)
  const applyReplacementsToString = (templateStr: string, replacements: Record<string, string>) => {
    let out = templateStr;
    for (const [k, v] of Object.entries(replacements)) {
      const keyEsc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(keyEsc, 'g'), String(v));
    }
    return out;
  };

  const executeTestWorkflow = async (
    scenarioType: 'B' = 'B',
    eventName?: string,
    _eventLocation?: string,
    _eventPriceHuman?: string,
    eventDescription?: string,
    eventHost?: string,
    eventLocation?: string,
    eventStartUnix?: string,
    eventMaxPeople?: string,
    eventPriceWei?: string
  ) => {
    setError(null);
    resetSteps();

    try {
      const embeddedWallet = getEmbeddedWallet();
      await embeddedWallet.switchChain?.(11155111);

      const nodeConfig = await getConfig();
      if (!nodeConfig || !nodeConfig.workflow || !nodeConfig.workflow.node_address) {
        throw new Error('Node address not available from KRNL node configuration.');
      }

      const nonce = await getContractNonce(embeddedWallet);
      const transactionIntent = createTransactionIntent(embeddedWallet, nonce, nodeConfig.workflow.node_address);
      const signature = await signTransactionIntent(transactionIntent);

      // convert human price string to wei if needed
      let finalPriceWei = eventPriceWei;
      if (!finalPriceWei && _eventPriceHuman) {
        try {
          const parts = (_eventPriceHuman || '').split('.');
          const whole = BigInt(parts[0] || '0');
          const frac = (parts[1] || '').padEnd(18, '0').slice(0, 18);
          finalPriceWei = (whole * 10n ** 18n + BigInt(frac)).toString();
        } catch {
          finalPriceWei = '10000000000000000';
        }
      }

      const replacements = createTemplateReplacements(
        embeddedWallet,
        transactionIntent,
        signature,
        eventName,
        eventDescription,
        eventHost,
        eventLocation,
        eventStartUnix ? String(Math.floor(Number(eventStartUnix))) : undefined,
        eventMaxPeople ? String(Math.floor(Number(eventMaxPeople))) : undefined,
        finalPriceWei
      );

      // apply replacements to imported JSON template (string-level)
      let templateStr = JSON.stringify(ticketCreateTemplate || {});
      templateStr = applyReplacementsToString(templateStr, replacements);
      let payloadToSend: any = JSON.parse(templateStr);

      // FORCE empty steps array (exactly []), preventing SDK/node from receiving a noop placeholder
      payloadToSend.workflow = {
        ...(payloadToSend.workflow || {}),
        steps: []
      };

      // build json-rpc body
      const rpcBody = {
        jsonrpc: '2.0',
        method: 'krnl_executeWorkflow',
        params: [payloadToSend],
        id: 1
      };

      // node RPC URL fallback
      const nodeRpcUrl =
        (nodeConfig && ((nodeConfig.workflow as any)?.rpc_url || (nodeConfig.workflow as any)?.node_rpc)) ||
        DEFAULT_NODE_RPC;

      console.log('Prepared payload (sent):', JSON.stringify(payloadToSend, null, 2));
      console.log('Node RPC URL:', nodeRpcUrl);

      // POST the JSON-RPC request directly so we control serialization (ensures "steps": [])
      const resp = await fetch(nodeRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcBody)
      });

      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch { json = text; }

      console.log('krnl_executeWorkflow response status:', resp.status, resp.statusText);
      console.log('krnl_executeWorkflow response body:', json);

      if (!resp.ok) {
        const errMsg = typeof json === 'object' ? JSON.stringify(json) : String(json);
        throw new Error(`Node returned HTTP ${resp.status}: ${errMsg}`);
      }

      // done — node accepted execution request. steps state will be updated via SDK/websocket/node polling if configured.
    } catch (err: any) {
      const message = err?.message || String(err);
      setError(message);
      toast.error(message);
      console.error('executeTestWorkflow error:', err);
    }
  };

  return {
    executeWorkflow: executeTestWorkflow,
    resetSteps,
    error: error || sdkError,
    statusCode,
    steps,
    currentStep
  };
};

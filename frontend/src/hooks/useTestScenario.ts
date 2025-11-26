import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import toast from 'react-hot-toast';
import {
  encodePacked,
  keccak256,
  createPublicClient,
  createWalletClient,
  http,
  custom,
  getContract,
  maxUint256
} from 'viem';
import { sepolia } from 'viem/chains';
import { useKRNL, useNodeConfig, type TransactionIntentParams, type PrivyEmbeddedWallet, type WorkflowObject } from '@krnl-dev/sdk-react-7702';
import ticketCreateTemplate from '../ticket-create.json'; 
import TicketingABI from '../contracts/TicketingTarget.json';
import ERC20ABI from '../contracts/ERC20.abi.json';
import { RPC_URL, TARGET_CONTRACT_OWNER, TICKETING_CONTRACT_ADDRESS, MOCK_USDC_ADDRESS, ATTESTOR_IMAGE, DEFAULT_CHAIN_ID } from '../const';
import type { ABIInput, ABIFunction } from '../types';

export const useTestScenario = () => {
  const { wallets } = useWallets();
  const {
    signTransactionIntent,
    executeWorkflowFromTemplate,
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

  // NOTE: createEvent is non-payable in many ABIs — USDC approval may not be required.
  const handleUSDCApproval = async (embeddedWallet: PrivyEmbeddedWallet) => {
    if (!MOCK_USDC_ADDRESS || !TICKETING_CONTRACT_ADDRESS) {
      throw new Error('Missing contract addresses');
    }

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL)
    });

    const usdcContract = getContract({
      address: MOCK_USDC_ADDRESS as `0x${string}`,
      abi: ERC20ABI,
      client: publicClient
    });

    const currentAllowance = await usdcContract.read.allowance([
      embeddedWallet.address as `0x${string}`,
      TICKETING_CONTRACT_ADDRESS as `0x${string}`
    ]) as bigint;

    if (currentAllowance === 0n) {
      const provider = await embeddedWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: embeddedWallet.address as `0x${string}`,
        chain: sepolia,
        transport: custom(provider)
      });

      const { request } = await publicClient.simulateContract({
        address: MOCK_USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [TICKETING_CONTRACT_ADDRESS as `0x${string}`, maxUint256],
        account: embeddedWallet.address as `0x${string}`
      });

      await walletClient.writeContract(request);
    }
  };

  const getContractNonce = async (embeddedWallet: PrivyEmbeddedWallet): Promise<bigint> => {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL)
    });

    const contract = getContract({
      address: TICKETING_CONTRACT_ADDRESS as `0x${string}`,
      abi: TicketingABI,
      client
    });


    if (contract.read && (contract.read as any).nonces) {
      return await contract.read.nonces([embeddedWallet.address]) as bigint;
    }

    // fallback: use block timestamp as weak nonce (not ideal — replace with on-chain nonce when available)
    return BigInt(Math.floor(Date.now() / 1000));
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

  const getFunctionSelector = (scenarioType: 'A' | 'B'): string => {
    // Scenario B => createEvent
    const targetFunctionName = scenarioType === 'B' ? 'createEvent' : 'submitPropertyAnalysis';

    const targetFunctionSelector = (TicketingABI as ABIFunction[]).find(
      (item) => item.type === 'function' && item.name === targetFunctionName
    );
    if (!targetFunctionSelector) {
      throw new Error(`Function ${targetFunctionName} not found in ABI`);
    }

    const functionSig = `${targetFunctionName}(${targetFunctionSelector.inputs.map((input) => buildTypeString(input)).join(',')})`;
    const functionSelectorBytes = keccak256(encodePacked(['string'], [functionSig])).slice(0, 10);

    if (functionSelectorBytes.length !== 10) {
      throw new Error(`Invalid function selector length: ${functionSelectorBytes.length}`);
    }

    return functionSelectorBytes;
  };

  const createTransactionIntent = (embeddedWallet: PrivyEmbeddedWallet, scenarioType: 'A' | 'B', nonce: bigint, nodeAddress: string): TransactionIntentParams => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const functionSelector = getFunctionSelector(scenarioType);

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
    // new event-specific fields (optional)
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

      // Backwards compatible placeholders (kept for reference)
      '{{PROPERTY_ADDRESS}}': eventLocation || 'Sample Venue',
      '{{CITY_STATE_ZIP}}': eventHost || 'Sample Host',
      '{{USDC_AMOUNT}}': eventPriceWei || '100000000',

      // Event-specific placeholders
      '{{EVENT_NAME}}': eventName || 'Sample Event',
      '{{EVENT_DESCRIPTION}}': eventDescription || 'A test event',
      '{{EVENT_HOST}}': eventHost || 'Organizer',
      '{{EVENT_LOCATION}}': eventLocation || 'Venue Address',
      '{{EVENT_START_UNIX}}': eventStartUnix ? eventStartUnix : String(Math.floor(Date.now() / 1000) + 86400),
      '{{EVENT_MAX_PEOPLE}}': eventMaxPeople ? eventMaxPeople : '100',
      '{{EVENT_PRICE_WEI}}': eventPriceWei ? eventPriceWei : '10000000000000000' // default 0.01 ETH in wei
    };
  };

  const selectScenarioTemplate = (scenarioType: 'A' | 'B') => {
    // Use the ticket-create template for scenario B (create event)
    if (scenarioType === 'B') return ticketCreateTemplate as WorkflowObject;
    // Fallback to a simple minimal template for A (if A is used)
    return {
      name: 'noop',
      version: 'v1',
      steps: []
    } as unknown as WorkflowObject;
  };


  const executeTestWorkflow = async (
    scenarioType: 'A' | 'B' = 'B',
    // accept old property args but also new event args (we will map them)
    propertyOrEventA?: string,
    propertyOrEventB?: string,
    usdcAmountOrPrice?: string,
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

      // if your createEvent requires token approvals, conditionally call the approval handler
      if (scenarioType === 'B' && MOCK_USDC_ADDRESS) {
        // optional: await handleUSDCApproval(embeddedWallet);
      }

      const nodeConfig = await getConfig();
      if (!nodeConfig.workflow.node_address) {
        throw new Error('Node address not available from KRNL node configuration.');
      }

      const nonce = await getContractNonce(embeddedWallet);
      const transactionIntent = createTransactionIntent(embeddedWallet, scenarioType, nonce, nodeConfig.workflow.node_address);
      const signature = await signTransactionIntent(transactionIntent);

      const selectedScenario = selectScenarioTemplate(scenarioType);

      // map incoming args: prefer explicit event fields, else use older args
      const replacements = createTemplateReplacements(
        embeddedWallet,
        transactionIntent,
        signature,
        eventNameFromArgs(propertyOrEventA, propertyOrEventB, eventDescription),
        eventDescription || '',
        eventHost || propertyOrEventB || '',
        eventLocation || propertyOrEventB || '',
        eventStartUnix || '',
        eventMaxPeople || '',
        eventPriceWei || usdcAmountOrPrice || ''
      );

      await executeWorkflowFromTemplate(selectedScenario as WorkflowObject, replacements);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Workflow execution failed';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // helper: derive an event name from available args for backwards compatibility
  const eventNameFromArgs = (a?: string, b?: string, desc?: string) => {
    if (a) return a;
    if (b) return b;
    if (desc) return desc.slice(0, 24);
    return 'Sample Event';
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

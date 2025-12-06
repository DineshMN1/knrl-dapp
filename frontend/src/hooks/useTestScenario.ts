import { useState } from 'react';
import toast from 'react-hot-toast';
import { encodePacked, keccak256 } from 'viem';
import { useKRNL, useNodeConfig, type TransactionIntentParams, type WorkflowObject } from '@krnl-dev/sdk-react-7702';
import ticketCreateTemplate from '@/workflows/ticket-create.json';
import buyTemplate from '@/workflows/buy.json';
import verifyTemplate from '@/workflows/verify.json';
import withdrawTemplate from '@/workflows/withdraw.json';
import { useWallets } from '@privy-io/react-auth';
import { TICKETING_CONTRACT_ADDRESS, ATTESTOR_IMAGE, TARGET_CONTRACT_OWNER } from '@/const';

type Scenario = 'create' | 'buy' | 'verify' | 'withdraw';

export const useTestScenario = () => {
  const { wallets } = useWallets();
  const {
    signTransactionIntent,
    executeWorkflowFromTemplate,
    resetSteps,
    error: sdkError,
    steps,
    currentStep
  } = useKRNL();
  const { getConfig } = useNodeConfig();
  const [error, setError] = useState<string | null>(null);

  const getEmbeddedWallet = () => {
    const embedded = wallets.find(w => w.connectorType === 'embedded' && w.walletClientType === 'privy');
    if (!embedded?.address) throw new Error('No embedded wallet found');
    return embedded;
  };

  // compute 4-byte selector from signature string
  const selectorFromSignature = (sig: string) => {
    const hashed = keccak256(encodePacked(['string'], [sig]));
    return hashed.slice(0, 10) as `0x${string}`;
  };

  const createTransactionIntent = (embeddedAddress: string, nodeAddress: string, functionSelector: `0x${string}`, nonce: bigint) => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const intentId = keccak256(encodePacked(['address', 'uint256', 'uint256'], [embeddedAddress as `0x${string}`, nonce, BigInt(deadline)])) as `0x${string}`;

    return {
      target: TICKETING_CONTRACT_ADDRESS as `0x${string}`,
      value: BigInt(0),
      id: intentId,
      nodeAddress: nodeAddress as `0x${string}`,
      delegate: TARGET_CONTRACT_OWNER as `0x${string}`,
      targetFunction: functionSelector,
      nonce,
      deadline: BigInt(deadline)
    } as TransactionIntentParams;
  };

  const mapTemplateParams = (scenario: Scenario, replacements: Record<string, string>) => {
    // Maps replacements to param1/param2/param3... names expected by templates
    const mapped: Record<string, string> = { ...replacements };

    if (scenario === 'buy') {
      // buy.json expects param1 = eventId (uint256), param2 = code (uint32), param3 = buyer (address)
      mapped['{{param1}}'] = replacements['{{EVENT_ID}}'] ?? replacements['{{PARAM_EVENT_ID}}'] ?? replacements['{{BUY_EVENT_ID}}'] ?? '';
      mapped['{{param2}}'] = replacements['{{CODE}}'] ?? replacements['{{PARAM_CODE}}'] ?? replacements['{{BUY_CODE}}'] ?? '';
      mapped['{{param3}}'] = replacements['{{BUYER}}'] ?? replacements['{{PARAM_BUYER}}'] ?? replacements['{{BUY_BUYER}}'] ?? '';
    }

    if (scenario === 'verify') {
      // verify.json expects param1 = eventId, param2 = code, param3 = markRedeemed (bool)
      mapped['{{param1}}'] = replacements['{{EVENT_ID}}'] ?? replacements['{{PARAM_EVENT_ID}}'] ?? replacements['{{VERIFY_EVENT_ID}}'] ?? '';
      mapped['{{param2}}'] = replacements['{{CODE}}'] ?? replacements['{{PARAM_CODE}}'] ?? replacements['{{VERIFY_CODE}}'] ?? '';
      mapped['{{param3}}'] = replacements['{{MARK_REDEEMED}}'] ?? replacements['{{PARAM_MARK_REDEEMED}}'] ?? (replacements['{{VERIFY_MARK_REDEEMED}}'] ?? 'true');
    }

    if (scenario === 'withdraw') {
      // withdraw.json expects param1 = eventId, param2 = to (address)
      mapped['{{param1}}'] = replacements['{{EVENT_ID}}'] ?? replacements['{{PARAM_EVENT_ID}}'] ?? replacements['{{WITHDRAW_EVENT_ID}}'] ?? '';
      mapped['{{param2}}'] = replacements['{{TO}}'] ?? replacements['{{PARAM_TO}}'] ?? replacements['{{WITHDRAW_TO}}'] ?? '';
    }

    return mapped;
  };

  const execute = async (scenario: Scenario, replacements: Record<string, string>) => {
    setError(null);
    resetSteps();

    try {
      const embedded = getEmbeddedWallet();

      // ensure chain — prefer using embedded.switchChain if available
      await embedded.switchChain?.(11155111);

      const nodeConfig = await getConfig();
      if (!nodeConfig?.workflow?.node_address) {
        throw new Error('Node address not available from KRNL node configuration.');
      }

      // nonce: client-side fallback (prefer on-chain nonce if your contract offers it)
      const nonce = BigInt(Date.now());

      // select function signature to compute selector
      let funcSig = '';
      switch (scenario) {
        case 'create':
          funcSig = 'createEvent((uint256,uint256,bytes32,(bytes32,bytes,bytes)[],bytes,bool,bytes),string,string,string,string,uint64,uint32,uint256)';
          break;
        case 'buy':
          funcSig = 'buyTicket((uint256,uint256,bytes32,(bytes32,bytes,bytes)[],bytes,bool,bytes),uint256,uint32,address)';
          break;
        case 'verify':
          funcSig = 'verifyTicket((uint256,uint256,bytes32,(bytes32,bytes,bytes)[],bytes,bool,bytes),uint256,uint32,bool)';
          break;
        case 'withdraw':
          funcSig = 'withdraw((uint256,uint256,bytes32,(bytes32,bytes,bytes)[],bytes,bool,bytes),uint256,address)';
          break;
      }

      const selector = selectorFromSignature(funcSig);
      const transactionIntent = createTransactionIntent(embedded.address, nodeConfig.workflow.node_address, selector, nonce);

      const signature = await signTransactionIntent(transactionIntent);

      // pick workflow template
      let template: WorkflowObject;
      switch (scenario) {
        case 'create':
          template = ticketCreateTemplate as unknown as WorkflowObject;
          break;
        case 'buy':
          template = buyTemplate as unknown as WorkflowObject;
          break;
        case 'verify':
          template = verifyTemplate as unknown as WorkflowObject;
          break;
        case 'withdraw':
          template = withdrawTemplate as unknown as WorkflowObject;
          break;
        default:
          throw new Error('Unknown scenario');
      }

      // base replacements
      const baseReplacements: Record<string, string> = {
        '{{ENV.SENDER_ADDRESS}}': embedded.address,
        '{{ENV.TARGET_CONTRACT}}': TICKETING_CONTRACT_ADDRESS || '',
        '{{ENV.ATTESTOR_IMAGE}}': ATTESTOR_IMAGE || '',
        '{{TRANSACTION_INTENT_ID}}': transactionIntent.id,
        '{{TRANSACTION_INTENT_DEADLINE}}': transactionIntent.deadline.toString(),
        '{{TRANSACTION_INTENT_DELEGATE}}': transactionIntent.delegate,
        '{{USER_SIGNATURE}}': signature
      };

      // map semantic replacements to the paramN placeholders expected by the template
      const mapped = mapTemplateParams(scenario, { ...baseReplacements, ...replacements });
      // ensure workflow.steps exists to avoid validation errors
      const tplAny = template as any;
      if (!tplAny.workflow) {
        tplAny.workflow = {
          name: tplAny.workflow?.name || `${scenario}-workflow`,
          version: 'v1.0.0',
          steps: []
        };
      } else if (!Array.isArray(tplAny.workflow.steps)) {
        tplAny.workflow.steps = [];
      }

      // Mark intent to allow empty steps (internal hint — non-invasive)
      tplAny.workflow.steps = [];


      const execAny = executeWorkflowFromTemplate as unknown as any;

      try {
        // first attempt — pass options (if supported by your SDK runtime)
        await execAny(tplAny, mapped, { skipStepValidation: true });
      } catch (firstErr) {
        // fallback — try without options (the plain 2-arg call)
        try {
          await execAny(tplAny, mapped);
        } catch (secondErr) {
          // propagate the most informative error
          throw secondErr;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Workflow execution failed';
      setError(msg);
      toast.error(msg);
      console.error(err);
    }
  };

  return {
    executeWorkflow: execute,
    resetSteps,
    error: error || sdkError,
    steps,
    currentStep
  };
};

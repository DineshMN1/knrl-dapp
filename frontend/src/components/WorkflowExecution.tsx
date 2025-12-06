import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import React from 'react';

interface WorkflowExecutionProps {
  isAuthorized: boolean;
  currentStep: number;
  activeScenario: 'create' | 'buy' | 'verify' | 'withdraw' | null;

  // Create
  eventName: string;
  eventDescription: string;
  eventHost: string;
  eventLocation: string;
  eventStartUnix: string;
  eventMaxPeople: string;
  eventPriceWei: string;

  // Buy
  buyEventId: string;
  buyCode: string;
  buyBuyer: string;

  // Verify
  verifyEventId: string;
  verifyCode: string;
  verifyMarkRedeemed: boolean;

  // Withdraw
  withdrawEventId: string;
  withdrawTo: string;

  validationErrors: any;

  executeWorkflow: (scenario: 'create' | 'buy' | 'verify' | 'withdraw', replacements: Record<string, string>) => Promise<void>;
  mintUSDC: () => Promise<any>;
  isMintingUSDC: boolean;
  usdcBalance: string;
  isLoadingUSDC: boolean;
  refetchUSDC: () => Promise<void>;
  balance: string;

  // setters passed from parent
  setEventName: (v: string) => void;
  setEventDescription: (v: string) => void;
  setEventHost: (v: string) => void;
  setEventLocation: (v: string) => void;
  setEventStartUnix: (v: string) => void;
  setEventMaxPeople: (v: string) => void;
  setEventPriceWei: (v: string) => void;

  setBuyEventId: (v: string) => void;
  setBuyCode: (v: string) => void;
  setBuyBuyer: (v: string) => void;

  setVerifyEventId: (v: string) => void;
  setVerifyCode: (v: string) => void;
  setVerifyMarkRedeemed: (v: boolean) => void;

  setWithdrawEventId: (v: string) => void;
  setWithdrawTo: (v: string) => void;

  onActiveScenarioChange: (s: 'create' | 'buy' | 'verify' | 'withdraw' | null) => void;
  validateInputs: () => boolean;
}

export const WorkflowExecution: React.FC<WorkflowExecutionProps> = ({
  isAuthorized,
  currentStep,
  activeScenario,

  // create
  eventName,
  eventDescription,
  eventHost,
  eventLocation,
  eventStartUnix,
  eventMaxPeople,
  eventPriceWei,

  // buy
  buyEventId,
  buyCode,
  buyBuyer,

  // verify
  verifyEventId,
  verifyCode,
  verifyMarkRedeemed,

  // withdraw
  withdrawEventId,
  withdrawTo,

  validationErrors,

  executeWorkflow,
  mintUSDC,
  isMintingUSDC,
  usdcBalance,
  isLoadingUSDC,
  refetchUSDC,
  balance,

  setEventName,
  setEventDescription,
  setEventHost,
  setEventLocation,
  setEventStartUnix,
  setEventMaxPeople,
  setEventPriceWei,

  setBuyEventId,
  setBuyCode,
  setBuyBuyer,

  setVerifyEventId,
  setVerifyCode,
  setVerifyMarkRedeemed,

  setWithdrawEventId,
  setWithdrawTo,

  onActiveScenarioChange,
  validateInputs
}) => {

  const validateRequirements = (scenario: 'create' | 'buy' | 'verify' | 'withdraw') => {
    if (!isAuthorized) {
      toast.error('Smart account must be authorized first');
      return false;
    }
    if (parseFloat(balance || '0') <= 0.03) {
      toast.error('Insufficient balance. Need > 0.03 ETH');
      return false;
    }
    if (scenario === 'buy' && parseFloat(usdcBalance || '0') <= 0) {
      // for ticketing buy, if price is > 0 and USDC used, you may check. Keep flexible.
      // For this POC we don't enforce USDC minimum unless you want to.
    }
    return true;
  };

  // Create
  const doCreate = async () => {
    if (!eventName || !eventHost) return toast.error('Name & host required');
    if (!validateRequirements('create')) return;

    const replacements = {
      '{{EVENT_NAME}}': eventName,
      '{{EVENT_DESCRIPTION}}': eventDescription,
      '{{EVENT_HOST}}': eventHost,
      '{{EVENT_LOCATION}}': eventLocation,
      '{{EVENT_START_UNIX}}': eventStartUnix,
      '{{EVENT_MAX_PEOPLE}}': eventMaxPeople,
      '{{EVENT_PRICE_WEI}}': eventPriceWei
    };

    onActiveScenarioChange('create');
    await executeWorkflow('create', replacements);
  };

  // Buy
  const doBuy = async () => {
    if (!buyEventId || !buyCode) return toast.error('Event ID and code required');
    if (!validateRequirements('buy')) return;

    // Map semantic placeholders; use keys expected by hook mapper
    const replacements = {
      '{{EVENT_ID}}': buyEventId,
      '{{CODE}}': buyCode,
      '{{BUYER}}': buyBuyer
    };

    onActiveScenarioChange('buy');
    await executeWorkflow('buy', replacements);
  };

  // Verify
  const doVerify = async () => {
    if (!verifyEventId || !verifyCode) return toast.error('Event ID and code required');
    if (!validateRequirements('verify')) return;

    const replacements = {
      '{{EVENT_ID}}': verifyEventId,
      '{{CODE}}': verifyCode,
      '{{MARK_REDEEMED}}': verifyMarkRedeemed ? 'true' : 'false'
    };

    onActiveScenarioChange('verify');
    await executeWorkflow('verify', replacements);
  };

  // Withdraw
  const doWithdraw = async () => {
    if (!withdrawEventId || !withdrawTo) return toast.error('Event ID and destination required');
    if (!validateRequirements('withdraw')) return;

    const replacements = {
      '{{EVENT_ID}}': withdrawEventId,
      '{{TO}}': withdrawTo
    };

    onActiveScenarioChange('withdraw');
    await executeWorkflow('withdraw', replacements);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Execution</CardTitle>
        <CardDescription>Create / Buy / Verify / Withdraw for TicketingTarget</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Create Event */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Create Event</h3>
            <div className="space-y-3">
              <div>
                <Label>Event Name</Label>
                <Input value={eventName} onChange={(e) => setEventName(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div>
                <Label>Host</Label>
                <Input value={eventHost} onChange={(e) => setEventHost(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start (unix)</Label>
                  <Input value={eventStartUnix} onChange={(e) => setEventStartUnix(e.target.value)} disabled={currentStep > 0} />
                </div>
                <div>
                  <Label>Max People</Label>
                  <Input value={eventMaxPeople} onChange={(e) => setEventMaxPeople(e.target.value)} disabled={currentStep > 0} />
                </div>
              </div>
              <div>
                <Label>Price (wei)</Label>
                <Input value={eventPriceWei} onChange={(e) => setEventPriceWei(e.target.value)} disabled={currentStep > 0} />
              </div>

              <Button onClick={doCreate} disabled={currentStep > 0} className="w-full">
                {currentStep > 0 && activeScenario === 'create' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Play className="mr-2 h-4 w-4" />Create Event</>}
              </Button>
            </div>
          </div>

          {/* Buy Ticket */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Buy Ticket</h3>
            <div className="space-y-3">
              <div>
                <Label>Event ID</Label>
                <Input value={buyEventId} onChange={(e) => setBuyEventId(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div>
                <Label>Code (uint32)</Label>
                <Input value={buyCode} onChange={(e) => setBuyCode(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div>
                <Label>Buyer (optional)</Label>
                <Input value={buyBuyer} onChange={(e) => setBuyBuyer(e.target.value)} disabled={currentStep > 0} />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Balance: {isLoadingUSDC ? '...' : `${usdcBalance} USDC`}</div>
                <Button onClick={async () => { await mintUSDC(); await refetchUSDC(); }} disabled={isMintingUSDC} variant="outline" size="sm">
                  {isMintingUSDC ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Minting...</> : <><Coins className="mr-2 h-3 w-3" />Mint USDC</>}
                </Button>
              </div>

              <Button onClick={doBuy} disabled={currentStep > 0} className="w-full" variant="outline">
                {currentStep > 0 && activeScenario === 'buy' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Play className="mr-2 h-4 w-4" />Buy Ticket</>}
              </Button>
            </div>
          </div>

          {/* Verify Ticket */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Verify Ticket</h3>
            <div className="space-y-3">
              <div>
                <Label>Event ID</Label>
                <Input value={verifyEventId} onChange={(e) => setVerifyEventId(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div>
                <Label>Mark Redeemed</Label>
                <div className="mt-2">
                  <input type="checkbox" checked={verifyMarkRedeemed} onChange={(e) => setVerifyMarkRedeemed(e.target.checked)} />
                </div>
              </div>

              <Button onClick={doVerify} disabled={currentStep > 0} className="w-full">
                {currentStep > 0 && activeScenario === 'verify' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Play className="mr-2 h-4 w-4" />Verify Ticket</>}
              </Button>
            </div>
          </div>

          {/* Withdraw */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Withdraw Funds</h3>
            <div className="space-y-3">
              <div>
                <Label>Event ID</Label>
                <Input value={withdrawEventId} onChange={(e) => setWithdrawEventId(e.target.value)} disabled={currentStep > 0} />
              </div>
              <div>
                <Label>To (address)</Label>
                <Input value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value)} disabled={currentStep > 0} />
              </div>

              <Button onClick={doWithdraw} disabled={currentStep > 0} className="w-full">
                {currentStep > 0 && activeScenario === 'withdraw' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Play className="mr-2 h-4 w-4" />Withdraw</>}
              </Button>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

// src/components/WorkflowExecution.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';

interface WorkflowExecutionProps {
  isAuthorized: boolean;
  currentStep: number;
  executeWorkflow: (
    scenarioType: 'B',
    eventName?: string,
    eventLocation?: string,
    eventPrice?: string,
    eventDescription?: string,
    eventHost?: string,
    eventStartUnix?: string,
    eventMaxPeople?: string,
    eventPriceWei?: string
  ) => Promise<void>;
  mintUSDC?: () => Promise<any>;
  isMintingUSDC?: boolean;
  usdcBalance?: string;
  isLoadingUSDC?: boolean;
  refetchUSDC?: () => Promise<void>;
  balance: string;

  // NEW prop
  onActiveScenarioChange?: (scenario: 'A' | 'B' | null) => void;
}

export const WorkflowExecution = ({
  isAuthorized,
  currentStep,
  executeWorkflow,
  mintUSDC,
  isMintingUSDC,
  usdcBalance,
  isLoadingUSDC,
  refetchUSDC,
  balance,
  onActiveScenarioChange
}: WorkflowExecutionProps) => {
  // Event form state
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventHost, setEventHost] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartISO, setEventStartISO] = useState(''); 
  const [eventMaxPeople, setEventMaxPeople] = useState('100');
  const [eventPrice, setEventPrice] = useState('0.01'); 

  const validateRequirements = (): boolean => {
    if (!isAuthorized) {
      toast.error('Smart account must be authorized first');
      return false;
    }

    if (parseFloat(balance) <= 0.01) {
      toast.error('Insufficient ETH balance. You need at least 0.01 ETH to create events.');
      return false;
    }

    if (!eventName.trim()) {
      toast.error('Event name is required');
      return false;
    }

    if (!eventLocation.trim()) {
      toast.error('Event location is required');
      return false;
    }

    if (!eventStartISO || isNaN(Date.parse(eventStartISO))) {
      toast.error('Valid event start date/time is required');
      return false;
    }

    if (!/^\d+$/.test(eventMaxPeople) || Number(eventMaxPeople) <= 0) {
      toast.error('Max people must be a positive integer');
      return false;
    }

    if (isNaN(parseFloat(eventPrice)) || Number(eventPrice) <= 0) {
      toast.error('Ticket price must be a positive number');
      return false;
    }

    return true;
  };

  const toUnixSeconds = (iso: string) => String(Math.floor(new Date(iso).getTime() / 1000));

  const handleCreateEvent = async () => {
    if (!validateRequirements()) return;

    // Convert price in ETH → wei (string). Simple conversion: ETH * 1e18
    const priceWei = BigInt(Math.round(parseFloat(eventPrice) * 1e18)).toString();

    try {
      // notify parent to set active scenario so the modal can open
      try {
        onActiveScenarioChange?.('B');
        console.log('[WorkflowExecution] set activeScenario -> B');
      } catch (e) {
        console.warn('onActiveScenarioChange failed:', e);
      }

      // call the workflow executor
      console.log('[WorkflowExecution] calling executeWorkflow with:', {
        eventName, eventLocation, eventPrice, eventDescription, eventHost, eventStartISO, eventMaxPeople, priceWei
      });

      await executeWorkflow(
        'B',
        eventName,
        eventLocation,
        eventPrice,
        eventDescription,
        eventHost,
        toUnixSeconds(eventStartISO),
        eventMaxPeople,
        priceWei
      );
    } catch (err: any) {
      const message = err?.message || 'Failed to create event';
      toast.error(message);
      console.error('handleCreateEvent error:', err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Event</CardTitle>
        <CardDescription>Create a new event on-chain — fills ticketing contract with event metadata</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="eventName">Event Name</Label>
            <Input id="eventName" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g., Summer Concert" disabled={currentStep > 0} />
          </div>

          <div>
            <Label htmlFor="eventHost">Host / Organizer</Label>
            <Input id="eventHost" value={eventHost} onChange={(e) => setEventHost(e.target.value)} placeholder="Organizer name" disabled={currentStep > 0} />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="eventDescription">Description</Label>
            <Input id="eventDescription" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Short description" disabled={currentStep > 0} />
          </div>

          <div>
            <Label htmlFor="eventLocation">Location / Venue</Label>
            <Input id="eventLocation" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Venue address" disabled={currentStep > 0} />
          </div>

          <div>
            <Label htmlFor="eventStart">Start Date & Time</Label>
            <Input id="eventStart" type="datetime-local" value={eventStartISO} onChange={(e) => setEventStartISO(e.target.value)} disabled={currentStep > 0} />
          </div>

          <div>
            <Label htmlFor="maxPeople">Max Attendees</Label>
            <Input id="maxPeople" type="number" min="1" value={eventMaxPeople} onChange={(e) => setEventMaxPeople(e.target.value)} disabled={currentStep > 0} />
          </div>

          <div>
            <Label htmlFor="ticketPrice">Ticket Price (ETH)</Label>
            <Input id="ticketPrice" type="number" step="0.0001" value={eventPrice} onChange={(e) => setEventPrice(e.target.value)} disabled={currentStep > 0} />
          </div>

          <div className="md:col-span-2 flex items-center justify-between mt-2">
            <div className="text-sm text-muted-foreground">
              {isLoadingUSDC ? '...' : `USDC Balance: ${usdcBalance ?? 'N/A'}`}
            </div>

            <div className="flex items-center space-x-2">
              {mintUSDC && (
                <Button
                  onClick={async () => {
                    await mintUSDC();
                    await refetchUSDC?.();
                  }}
                  disabled={!!isMintingUSDC}
                  variant="outline"
                  size="sm"
                >
                  {isMintingUSDC ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Minting...</> : <><Ticket className="mr-2 h-3 w-3" />Mint USDC</>}
                </Button>
              )}

              <Button onClick={handleCreateEvent} disabled={currentStep > 0} className="ml-2">
                {currentStep > 0 ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Play className="mr-2 h-4 w-4" />Create Event</>}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkflowExecution;

import { usePrivy } from "@privy-io/react-auth";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useKRNL } from "@krnl-dev/sdk-react-7702";
import { useTestScenario } from "@/hooks/useTestScenario";
import { useMintUSDC } from "@/hooks/useMintUSDC";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { AccountManagement } from "@/components/AccountManagement";
import { WorkflowExecution } from "@/components/WorkflowExecution";
import { WorkflowTrackingModal } from "@/components/WorkflowTrackingModal";
import { formatAddress, getChainName, switchNetwork } from "@/utils";
import { validateInputs, type ValidationErrors } from "@/utils/validation";
import toast from "react-hot-toast";

const Dashboard = () => {
  const { logout } = usePrivy();
  const {
    balance,
    isLoading: balanceLoading,
    wallet: embeddedWallet,
    chainInfo,
    isSwitching,
    refetch,
  } = useWalletBalance();
  const {
    isAuthorized,
    smartAccountEnabled,
    isLoading: authLoading,
    error: authError,
    enableSmartAccount,
    checkAuth: refreshStatus,
    delegatedContractAddress,
    isAuthenticated,
    isReady,
    walletsReady,
  } = useKRNL();

  const smartContractAddress =
    delegatedContractAddress ||
    (import.meta.env.VITE_DELEGATED_ACCOUNT_ADDRESS as string);
  const {
    executeWorkflow,
    resetSteps,
    error: workflowError,
    steps,
    currentStep,
  } = useTestScenario();
  const { mintUSDC, isMinting: isMintingUSDC } = useMintUSDC();
  const {
    usdcBalance,
    isLoading: isLoadingUSDC,
    refetch: refetchUSDC,
  } = useUSDCBalance();

  // State management
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitchingToSepolia, setIsSwitchingToSepolia] = useState(false);
  const [activeScenario, setActiveScenario] = useState<
    "create" | "buy" | "verify" | "withdraw" | null
  >(null);

  // Create-flow inputs
  const [eventName, setEventName] = useState("Awesome Meetup");
  const [eventDescription, setEventDescription] = useState(
    "An awesome gathering"
  );
  const [eventHost, setEventHost] = useState("Organizer");
  const [eventLocation, setEventLocation] = useState("Austin,TX");
  const [eventStartUnix, setEventStartUnix] = useState(
    Math.floor(Date.now() / 1000 + 86400).toString()
  );
  const [eventMaxPeople, setEventMaxPeople] = useState("100");
  const [eventPriceWei, setEventPriceWei] = useState("0");

  // Buy-flow inputs
  const [buyEventId, setBuyEventId] = useState("0");
  const [buyCode, setBuyCode] = useState("123456");
  const [buyBuyer, setBuyBuyer] = useState("");

  // Verify-flow inputs
  const [verifyEventId, setVerifyEventId] = useState("0");
  const [verifyCode, setVerifyCode] = useState("123456");
  const [verifyMarkRedeemed, setVerifyMarkRedeemed] = useState(true);

  // Withdraw-flow inputs
  const [withdrawEventId, setWithdrawEventId] = useState("0");
  const [withdrawTo, setWithdrawTo] = useState("");

  const [copied, setCopied] = useState(false);
  const [copiedSmart, setCopiedSmart] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    propertyAddress: "",
    cityStateZip: "",
    usdcAmount: "",
  });

  // Effects
  const chainName = getChainName(chainInfo?.providerChainIdDecimal);

  useEffect(() => {
    if (currentStep > 0 && activeScenario) {
      setIsTrackingModalOpen(true);
    }
  }, [currentStep, activeScenario, steps]);

  // Handlers
  const switchToSepolia = useCallback(async () => {
    if (isSwitchingToSepolia) return;
    setIsSwitchingToSepolia(true);
    try {
      await switchNetwork(embeddedWallet!, 11155111);
    } finally {
      setIsSwitchingToSepolia(false);
    }
  }, [embeddedWallet, isSwitchingToSepolia]);

  const handleEnableSmartAccount = useCallback(async () => {
    // Check if balance is sufficient (> 0 ETH)
    const currentBalance = parseFloat(balance || "0");
    if (currentBalance <= 0) {
      toast.error(
        "Insufficient balance. You need some ETH to authorize the smart account."
      );
      return false;
    }

    try {
      return await enableSmartAccount();
    } catch (error) {
      console.error("Failed to enable smart account:", error);
      return false;
    }
  }, [balance, enableSmartAccount]);

  const handleModalClose = (open: boolean) => {
    setIsTrackingModalOpen(open);
    if (!open) {
      setActiveScenario(null);
      resetSteps();
    }
  };

  const validateAndSetErrors = useCallback(
    (scenarioType?: "A" | "B") => {
      const validation = validateInputs(
        "",
        "",
        "",
        usdcBalance?.toString(),
        scenarioType
      );
      setValidationErrors(validation.errors);
      return validation.isValid;
    },
    [usdcBalance]
  );

  // loading / auth gating
  if (!isReady || !isAuthenticated || !walletsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-lg font-semibold">Loading...</div>
          <div className="text-muted-foreground">Initializing your account</div>
        </div>
      </div>
    );
  }

  const isWrongNetwork =
    chainInfo && chainInfo.providerChainIdDecimal !== 11155111;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-semibold">Ticketing DApp</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {formatAddress(embeddedWallet?.address)}
              </span>
              <Button onClick={() => logout()} variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Wrong Network Warning */}
        {isWrongNetwork && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Wrong Network
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  You're currently on {chainName}. Please switch to Sepolia to
                  use this application.
                </p>
              </div>
              <Button
                onClick={switchToSepolia}
                disabled={isSwitchingToSepolia}
                size="sm"
                variant="outline"
              >
                {isSwitchingToSepolia ? "Switching..." : "Switch to Sepolia"}
              </Button>
            </div>
          </div>
        )}

        {/* Account Management Section */}
        <AccountManagement
          embeddedWallet={embeddedWallet}
          balance={balance}
          balanceLoading={balanceLoading}
          chainInfo={chainInfo}
          isSwitching={isSwitching}
          isRefreshing={isRefreshing}
          refetch={refetch}
          smartContractAddress={smartContractAddress}
          isAuthorized={isAuthorized}
          smartAccountEnabled={smartAccountEnabled}
          authLoading={authLoading}
          authError={authError}
          enableSmartAccount={handleEnableSmartAccount}
          refreshStatus={refreshStatus}
          isAuthenticated={isAuthenticated}
          isReady={isReady}
          walletsReady={walletsReady}
          usdcBalance={usdcBalance}
          isLoadingUSDC={isLoadingUSDC}
          refetchUSDC={refetchUSDC}
          mintUSDC={mintUSDC}
          isMintingUSDC={isMintingUSDC}
          switchToSepolia={switchToSepolia}
          isSwitchingToSepolia={isSwitchingToSepolia}
          copied={copied}
          setCopied={setCopied}
          copiedSmart={copiedSmart}
          setCopiedSmart={setCopiedSmart}
          setIsRefreshing={setIsRefreshing}
        />

        {/* Workflow Execution Section */}
        <WorkflowExecution
          isAuthorized={isAuthorized}
          currentStep={currentStep}
          activeScenario={activeScenario}
          // create inputs
          eventName={eventName}
          eventDescription={eventDescription}
          eventHost={eventHost}
          eventLocation={eventLocation}
          eventStartUnix={eventStartUnix}
          eventMaxPeople={eventMaxPeople}
          eventPriceWei={eventPriceWei}
          // buy inputs
          buyEventId={buyEventId}
          buyCode={buyCode}
          buyBuyer={buyBuyer}
          // verify inputs
          verifyEventId={verifyEventId}
          verifyCode={verifyCode}
          verifyMarkRedeemed={verifyMarkRedeemed}
          // withdraw inputs
          withdrawEventId={withdrawEventId}
          withdrawTo={withdrawTo}
          // validation & actions
          validationErrors={validationErrors}
          executeWorkflow={executeWorkflow}
          mintUSDC={mintUSDC}
          isMintingUSDC={isMintingUSDC}
          usdcBalance={usdcBalance}
          isLoadingUSDC={isLoadingUSDC}
          refetchUSDC={refetchUSDC}
          balance={balance}
          setEventName={setEventName}
          setEventDescription={setEventDescription}
          setEventHost={setEventHost}
          setEventLocation={setEventLocation}
          setEventStartUnix={setEventStartUnix}
          setEventMaxPeople={setEventMaxPeople}
          setEventPriceWei={setEventPriceWei}
          setBuyEventId={setBuyEventId}
          setBuyCode={setBuyCode}
          setBuyBuyer={setBuyBuyer}
          setVerifyEventId={setVerifyEventId}
          setVerifyCode={setVerifyCode}
          setVerifyMarkRedeemed={setVerifyMarkRedeemed}
          setWithdrawEventId={setWithdrawEventId}
          setWithdrawTo={setWithdrawTo}
          onActiveScenarioChange={setActiveScenario}
          validateInputs={() => validateAndSetErrors()}
        />

        {/* Workflow Tracking Modal */}
        <WorkflowTrackingModal
          isOpen={isTrackingModalOpen}
          onClose={handleModalClose}
          activeScenario={
            activeScenario === "create"
              ? "create"
              : activeScenario === "buy"
              ? "buy"
              : activeScenario === "verify"
              ? "verify"
              : activeScenario === "withdraw"
              ? "withdraw"
              : null
          }
          steps={steps}
          workflowError={workflowError}
          resetSteps={resetSteps}
          currentStep={currentStep}
        />
      </main>
    </div>
  );
};

export default Dashboard;

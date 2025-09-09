import { CurrencyAmount, LendingAgentClient, SmartYieldStepType, SmartYieldStrategy, SuiToken, SupportedLendingMarketProtocol } from "@themeglabs/lending-agent-sdk"

export async function buildOpenStrategyTransaction(
  lendingAgentClient: LendingAgentClient,
  sender: string,
  strategy: SmartYieldStrategy,
) {
  // generate strategy flow
  const flow = await lendingAgentClient.getStrategyFlow(strategy, sender)
  // refresh amounts to prevent unexpected price changes
  const refreshedFlow = await lendingAgentClient.refreshStrategyFlowAmounts(flow)
  // build transaction
  const result = await lendingAgentClient.buildConfirmStrategyFlowTransaction({
    sender,
    flow: refreshedFlow,
    confirmedSteps: [],
  })

  return result
}

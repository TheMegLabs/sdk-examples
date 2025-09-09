import { LendingAgentClient, SmartYieldStep, SmartYieldStrategyFlow } from "@themeglabs/lending-agent-sdk"

export async function buildContinueStrategyTransaction(
  lendingAgentClient: LendingAgentClient,
  sender: string,
  flow: SmartYieldStrategyFlow,
  confirmedSteps: SmartYieldStep[],
  strategyId: string,
) {
  if (flow.completed) {
    throw new Error("Strategy flow is already completed")
  }

  // refresh amounts to prevent unexpected price changes
  const refreshedFlow = await lendingAgentClient.refreshStrategyFlowAmounts(flow)
  const result = await lendingAgentClient.buildConfirmStrategyFlowTransaction({
    sender,
    flow: refreshedFlow,
    confirmedSteps,
    strategyId,
  })

  return result
}

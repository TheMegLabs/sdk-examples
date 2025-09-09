import { LendingAgentClient, SuiToken, SupportedLendingMarketProtocol } from "@themeglabs/lending-agent-sdk"

export async function getAllRoutes(
  lendingAgentClient: LendingAgentClient,
  protocols: SupportedLendingMarketProtocol[],
  startingToken: SuiToken,
  intermediateTokens: SuiToken[],
  oneclick?: boolean,
) {
  const routes = await lendingAgentClient.getAllRoutes(
    protocols,
    startingToken,
    intermediateTokens,
    365, // duration, only support 365 days now
    oneclick,
  )

  return routes
}

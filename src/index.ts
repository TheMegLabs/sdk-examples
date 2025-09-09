import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { CurrencyAmount, LendingAgentClient, SmartYieldStepType, SmartYieldStrategy, SuiToken } from "@themeglabs/lending-agent-sdk"
import { config } from "dotenv"
import { buildContinueStrategyTransaction, buildOpenStrategyTransaction, getAllRoutes } from "./lending-agent"

async function main() {
  config() // load environment variables from .env file

  const keypairs = [
    Ed25519Keypair.fromSecretKey(process.env.PRIVATE_KEY_0 || ""),
    Ed25519Keypair.fromSecretKey(process.env.PRIVATE_KEY_1 || ""),
  ]
  const senders = keypairs.map((kp) => kp.getPublicKey().toSuiAddress())
  // console.log("Senders", senders)
  const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") })
  const lendingAgentClient = new LendingAgentClient({ chainId: "sui:mainnet" })

  // prepare data
  const allCurrencies = lendingAgentClient.getAllCurrencies() as SuiToken[]
  const allProtocols = lendingAgentClient.getAllProtocols()

  // example 1. Get all routes
  const protocols = allProtocols.slice() // use all protocols
  const startingToken = allCurrencies.find((c) => c.coinType === "0x2::sui::SUI") // starting with SUI
  const intermediateTokens = allCurrencies.slice() // allow all intermediate tokens
  const routes = await getAllRoutes(
    lendingAgentClient,
    protocols,
    startingToken,
    intermediateTokens,
    true, // one-click mode // change to `false`  if you want to test example 3.2 (multi-click mode)
  )
  // console.log(`Found routes`, routes)

  // example 2. Calculate APR for a strategy
  // select a route
  const stableRoute = routes.get("stable")
  if (!stableRoute) throw new Error("No stable route found")
  // should check wallet requiements before using the route
  if (stableRoute.route.walletRequired > keypairs.length) {
    throw new Error(`Not enough wallet to execute the strategy, required: ${stableRoute.route.walletRequired}, available: ${keypairs.length}`)
  }
  // init strategy
  const loopCount = stableRoute.bestLoopCount
  const strategy = new SmartYieldStrategy(
    stableRoute.route,
    stableRoute.route.steps.length - 1, // use all steps
    loopCount,
  )
  // customize strategy
  // e.g. set wallet addresses for steps
  strategy.route.steps.forEach((step) => {
    step.walletAddress = senders[step.walletIndex]
  })
  // e.g. set recipient wallet address for transfer steps
  strategy.route.steps.forEach((step) => {
    if (step.type === SmartYieldStepType.TRANSFER) {
      const recipientWalletIndex = (step as any).recipientWalletIndex as number
      (step as any).recipientWalletAddress = senders[recipientWalletIndex]
    }
  })
  // e.g. update ltv ratio for borrow steps
  strategy.route.steps.forEach((step, index) => {
    if (step.type === SmartYieldStepType.BORROW) {
      const prevStep = strategy.route.steps[index - 1]
      const maxLtv = prevStep.market.maxLtv / step.market.borrowWeight // max ltv based on the collateral from the previous step
        // set ltv to 80% maximum allowed
        ; (step as any).ltv = maxLtv * 0.8
    }
  })
  // calculate apr, fee rate, payback time
  const { apr, feeRate, paybackTime } = lendingAgentClient.calculateStrategyApr(strategy)
  console.log(`Expected APR: ${(apr * 100).toFixed(2)}%`)
  console.log(`Fee Rate: ${(feeRate * 100).toFixed(2)}%`)
  console.log(`Payback Time: ${paybackTime} ms`)

  // example 3.1. Open one-click strategy
  // set amount to open strategy
  const amountIn = 1_000_000_000 // 1 SUI
  strategy.route.steps[0].amount = CurrencyAmount.fromWeb3Amount(startingToken, amountIn)
  let strategyId: string | undefined = undefined // set to continue the strategy
  const { tx, newFlow, confirmedSteps } = await buildOpenStrategyTransaction(
    lendingAgentClient,
    senders[0],
    strategy,
  )
  const response = await suiClient.signAndExecuteTransaction({
    signer: keypairs[0],
    transaction: tx as any,
  })
  console.log("Open strategy tx response", response.digest)

  // example 3.2. Open multi-click strategy
  // get strategyId from the strategy creation transaction to continue the strategy
  if (!strategyId) {
    strategyId = await lendingAgentClient.getStrategyIdByCreationTxId(response.digest)
  }
  // execute next click if the flow is not completed
  let nextFlow = newFlow
  let nextConfirmedSteps = confirmedSteps
  while (!nextFlow.completed) {
    // get the next sender address
    const nextSender = nextFlow.confirmations[nextFlow.currentIndex][0].walletAddress
    const signer = keypairs.find((kp) => kp.getPublicKey().toSuiAddress() === nextSender)
    if (!signer) throw new Error("No keypair found for the next sender")

    const { tx: nextTx, newFlow: _newFlow, confirmedSteps: _newConfirmedSteps } = await buildContinueStrategyTransaction(
      lendingAgentClient,
      nextSender,
      nextFlow,
      nextConfirmedSteps, // use to update state of strategy NFT object
      strategyId,
    )
    await suiClient.signAndExecuteTransaction({
      signer,
      transaction: nextTx as any,
    })

    nextFlow = _newFlow
    nextConfirmedSteps = _newConfirmedSteps
  }
}

main()

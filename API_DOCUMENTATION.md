# Lending Agent SDK Documentation

A comprehensive TypeScript SDK for the Sui blockchain lending agent, providing intelligent yield strategies, DeFi portfolio management, and automated transaction building for lending protocols.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Main Client](#main-client)
- [Types & Interfaces](#types--interfaces)
- [Enums](#enums)
- [Usage Examples](#usage-examples)
- [Advanced Features](#advanced-features)

## Installation

```bash
npm install @themeglabs/lending-agent-sdk
```

---

## Main Client

### LendingAgentClient

The primary client for interacting with the lending agent SDK.

```typescript
class LendingAgentClient {
  constructor(options: SmartYieldClientConstructorOptions)
}
```

**Constructor Options:**

- `chainId: IChainId` - The blockchain network to connect to

### Core Methods

#### Network & Data Access

**`getChainId(): IChainId`**
Returns the current blockchain network ID.

**`getAllCurrencies(): Currency[]`**
Retrieves all supported currencies on the network.

**`getAllProtocols(): SupportedLendingMarketProtocol[]`**
Returns all supported lending protocols.

**`getAllMarkets(): Promise<Map<string, LendingMarket[]>>`**
Gets all available lending markets grouped by coin type.

**`getUserPortfolio(user: string): Promise<LendingPortfolio[]>`**
Retrieves a user's complete lending portfolio across all protocols.

**`mergePortfolios(portfolios0: LendingPortfolio[], portfolios1: LendingPortfolio[]): Promise<LendingPortfolioWithConflictPositions[]>`**
Merges current and new portfolios, detecting conflicts and isolated positions.

**`mergePortfoliosMap(portfoliosMap0: Map<string, LendingPortfolio[]>, portfoliosMap1: Map<string, LendingPortfolio[]>): Promise<Map<string, LendingPortfolioWithConflictPositions[]>>`**
Merges portfolio maps for multiple wallet addresses.

```typescript
// Example: Get user's portfolio
const portfolios = await client.getUserPortfolio("0x123...")
portfolios.forEach((portfolio) => {
  console.log(`Protocol: ${portfolio.marketType}`)
  console.log(`Supplied: ${portfolio.suppliedAmounts.size} assets`)
  console.log(`Collateral: ${portfolio.collateralAmounts.size} assets`) // In Scallop protocol, collateral assets are different supplied assets
  console.log(`Borrowed: ${portfolio.borrowedAmounts.size} assets`)
})
```

#### Strategy Management

**`getAllRoutes(...): Promise<Map<ICategory | "normal", { route: SmartYieldRoute; bestLoopCount: number }>>`**
Finds optimal yield strategies across different risk categories ("normal" -> Mixed Strategy, "bluechip" -> Bluechip-only strategy, "stable" -> Stablecoin-only strategy).

**`calculateStrategyApr(strategy: SmartYieldStrategy): { apr: number; feeRate: number; paybackTime: number }`**
Calculates the expected APR and metrics for a strategy.

```typescript
// Example: Get and execute a strategy
const routes = await client.getAllRoutes(
  [SuiEcoProtocolType.NAVI, SuiEcoProtocolType.SUILEND, SuiEcoProtocolType.ALPHALEND, SuiEcoProtocolType.SCALLOP],
  suiToken,
  [usdcToken, usdtToken],
)

const bestRoute = routes.get("normal")
const lastStepIndex = bestRoute.route.length - 1
const strategy = new SmartYieldStrategy(bestRoute.route, lastStepIndex, 3) // strategy includes all steps in route and loop 3 times
const apr = calculateStrategyApr(strategy)
```

**`getStrategyFlow(strategy: SmartYieldStrategy, currentAccountAddress: string): Promise<SmartYieldStrategyFlow>`**
Generates a step-by-step execution flow for a yield strategy.

**`refreshStrategyFlowAmounts(flow: SmartYieldStrategyFlow): Promise<SmartYieldStrategyFlow>`**
Refreshes the amounts in a strategy flow based on current market conditions.

**`buildConfirmStrategyFlowTransaction(params: BuildConfirmStrategyTransactionParams): Promise<{ tx: Transaction; newFlow: SmartYieldStrategyFlow; confirmedSteps: SmartYieldStep[] }>`**
Builds a transaction to execute the next step(s) in a strategy flow.

**`previewNewPortfoliosMap(flow: SmartYieldStrategyFlow): Promise<Map<string, LendingPortfolio[]>>`**
Previews the created/updated positions after executing a strategy flow, will be used to merge with user's current portfolios map.

**`getStrategyIdByCreationTxId(txId: string): Promise<string>`**
Retrieves a strategy ID using its creation transaction ID, will be used as input of `buildConfirmStrategyFlowTransaction` calls after the first one if the strategy requires multiple transactions.

---

## Types & Interfaces

### Core Types

#### `SmartYieldClientConstructorOptions`

Configuration options for initializing the lending agent client.

```typescript
interface SmartYieldClientConstructorOptions {
  chainId: IChainId
}
```

#### `SmartYieldStrategy`

Represents a complete yield optimization strategy.

```typescript
class SmartYieldStrategy {
  readonly route: SmartYieldRoute
  readonly lastSelectedStepIndex: number
  readonly loopCount: number
}
```

#### `SmartYieldRoute`

Defines a sequence of steps to achieve optimal yield.

```typescript
class SmartYieldRoute {
  readonly steps: SmartYieldStep[]
  readonly possibleLoopAt: number
  maxAprWithBestLoopCount: number
  maxFeeRateWithBestLoopCount: number
  maxPaybackTimeWithBestLoopCount: number
  walletRequired?: number
  wallets: string[]
}
```

#### `SmartYieldStrategyFlow`

Manages the execution state of a strategy.

```typescript
class SmartYieldStrategyFlow {
  confirmations: SmartYieldStep[][]
  loopAt: number
  loopCount: number
  currentIndex: number
  currentLoop: number
  completed: boolean
  txIds: string[]
}
```

### Step Types

#### `SmartYieldStep`

Base class for all strategy steps.

```typescript
abstract class SmartYieldStep {
  readonly type: SmartYieldStepType
  market: LendingMarket
  walletIndex: number
  walletAddress?: string
  amount?: CurrencyAmount<SuiToken>
}
```

#### `SmartYieldSupplyStep`

Step for supplying assets to a lending protocol.

```typescript
class SmartYieldSupplyStep extends SmartYieldStep {
  readonly portfolio?: LendingPortfolio
}
```

#### `SmartYieldBorrowStep`

Step for borrowing assets from a lending protocol.

```typescript
class SmartYieldBorrowStep extends SmartYieldStep {
  readonly portfolio?: LendingPortfolio
  ltv?: number // Loan-to-value ratio
}
```

#### `SmartYieldTransferStep`

Step for transferring assets between wallets.

```typescript
class SmartYieldTransferStep extends SmartYieldStep {
  recipientWalletIndex: number
  recipientWalletAddress?: string
}
```

#### `SmartYieldAddCollateralStep`

Step for adding collateral (specific to certain protocols, ex: Scallop).

```typescript
class SmartYieldAddCollateralStep extends SmartYieldStep {
  readonly portfolio?: LendingPortfolio
}
```

### Transaction Parameter Types

#### `BuildConfirmStrategyTransactionParams`

```typescript
type BuildConfirmStrategyTransactionParams = {
  sender: string
  flow: SmartYieldStrategyFlow
  confirmedSteps: SmartYieldStep[]
  coin?: TransactionObjectArgument
  strategyId?: string
  inheritTx?: Transaction
}
```

#### `BuildClaimRewardsTransactionParams`

```typescript
type BuildClaimRewardsTransactionParams = {
  sender: string
  protocols?: SuiEcoProtocolType[]
  inheritTx?: Transaction
}
```

### Additional Types

#### `LendingPortfolioWithConflictPositions`

Extended portfolio type with conflict detection.

```typescript
type LendingPortfolioWithConflictPositions = LendingPortfolio & {
  conflictPositions: ConflictPosition[]
  isolatedPosition?: SimplifiedPosition
}
```

---

## Enums

### `SmartYieldStepType`

Defines the types of operations in a yield strategy.

```typescript
enum SmartYieldStepType {
  SUPPLY = "Supply",
  BORROW = "Borrow",
  TRANSFER = "Transfer",
  ADD_COLLATERAL = "Add Collateral",
}
```

**Usage:**

```typescript
// Check step type
if (step.type === SmartYieldStepType.SUPPLY) {
  const supplyStep = step as SmartYieldSupplyStep
  // Handle supply operation
}
```

---

## Usage Examples

Check <a href="https://github.com/TheMegLabs/sdk-examples">this example</a>.

---

This comprehensive API documentation provides all the necessary information to effectively use the Lending Agent SDK for building sophisticated DeFi applications on the Sui blockchain. The SDK abstracts complex lending operations while providing fine-grained control when needed.

# Liquidation Alert System

## How the Agent Detects Liquidation Risk

### 1. **Monitoring Flow**

When you run `monitorPositions`, the agent:

1. **Calculates Health Factors** for each position:
   ```
   Health Factor = (Collateral Value × Liquidation Threshold) / Debt Value
   ```
   - HF < 1.0 = Position can be liquidated
   - HF > 1.0 = Position is safe (higher = safer)

2. **Calculates Buffer Percentages**:
   ```
   Buffer % = (Health Factor - 1.0) × 100
   ```
   - Example: HF of 1.15 = 15% buffer
   - Means position can handle 15% price drop before liquidation

3. **Checks Alert Threshold**:
   - Compares buffer % against configured threshold (default: 15%)
   - If buffer < threshold → `alertThresholdHit = true`
   - Identifies which positions are at risk

### 2. **Current Alert Detection**

**How it works:**

```typescript
// In checkAlertThresholdAction:
const bufferPercent = (healthFactor - 1.0) * 100;

if (bufferPercent < alertThreshold) {
    // Position is at risk!
    atRiskPositions.push({...});
    alertThresholdHit = true;
}
```

**What happens:**

1. When `monitorPositions` runs, it:
   - Calculates all metrics
   - Sets `alertThresholdHit` to `true` if any position is below threshold
   - Returns detailed results including at-risk positions

2. The **context render** shows:
   ```
   Alert Status: ⚠️ WARNING: Alert threshold hit!
   ```

3. The **LLM sees** this in context and can:
   - Respond with warnings
   - Suggest actions (add collateral, repay debt)
   - Escalate urgency based on how close positions are

### 3. **How Alerts Are Communicated**

**Current Method (CLI):**

- Agent responds with messages like:
  ```
  ⚠️ ALERT: 2 position(s) below 15% buffer threshold!
  Position ID: xxx, Buffer: 12%, Health Factor: 1.12
  ```

- The context memory stores `alertThresholdHit: true` which appears in all future interactions

**What the LLM does:**

When the agent sees `alertThresholdHit: true` in context:
- It can proactively warn users
- Explain the risk level
- Suggest remediation actions
- Escalate if multiple checks show worsening conditions

### 4. **Future: Automated Alerting (To Implement)**

To add **automatic alerts**, you could:

#### Option A: Scheduled Monitoring Action

```typescript
export const scheduleMonitoringAction = action({
    name: "scheduleMonitoring",
    description: "Sets up periodic monitoring checks. Runs monitorPositions every X minutes.",
    handler: async (call, ctx) => {
        // Use a scheduler (node-cron, setInterval, etc.)
        // Run monitorPositions periodically
        // If alertThresholdHit, trigger notifications
    },
});
```

#### Option B: Webhook/Notification Integration

```typescript
// In checkAlertThresholdAction, add:
if (atRiskPositions.length > 0) {
    // Send webhook
    await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify({
            wallet: agentMemory.wallet,
            atRiskPositions,
            alertThreshold,
        }),
    });
    
    // Or send email/SMS/Telegram
    await sendNotification({
        type: 'liquidation_risk',
        severity: bufferPercent < 5 ? 'critical' : 'warning',
        message: `⚠️ Liquidation Risk: ${atRiskPositions.length} position(s) at risk`,
    });
}
```

#### Option C: Real-time Price Monitoring

```typescript
export const watchPositionsAction = action({
    name: "watchPositions",
    description: "Continuously monitors positions and alerts when approaching liquidation.",
    handler: async (call, ctx) => {
        // Poll price APIs every few minutes
        // Recalculate health factors
        // Alert on threshold breaches
    },
});
```

### 5. **Alert Severity Levels**

You could implement severity based on buffer:

```typescript
function getAlertSeverity(bufferPercent: number): 'safe' | 'warning' | 'critical' {
    if (bufferPercent > 15) return 'safe';
    if (bufferPercent > 5) return 'warning';  // Below threshold
    return 'critical';  // Very close to liquidation
}
```

### 6. **Example Alert Flow**

1. User runs: `monitorPositions`
2. Agent calculates:
   - Position A: HF = 1.12, Buffer = 12% (below 15% threshold)
   - Position B: HF = 1.25, Buffer = 25% (safe)
3. Agent sets: `alertThresholdHit = true`
4. Agent returns:
   ```json
   {
     "alert_threshold_hit": true,
     "atRiskPositions": [
       {
         "positionId": "pos-123",
         "bufferPercent": 12,
         "healthFactor": 1.12
       }
     ]
   }
   ```
5. LLM sees this and responds:
   ```
   ⚠️ WARNING: 1 position is below your 15% safety threshold!
   
   Position pos-123:
   - Buffer: 12% (only 12% price drop protection)
   - Health Factor: 1.12
   - Recommendation: Add collateral or repay debt to increase safety margin
   ```

### 7. **Recommended Next Steps**

To make alerts more proactive:

1. **Add scheduled monitoring** - Run checks every X minutes
2. **Add notification channels** - Email, SMS, Telegram, Discord webhooks
3. **Add alert history** - Track when alerts were triggered
4. **Add escalation** - Multiple alerts → higher urgency
5. **Add recovery detection** - Alert when positions recover


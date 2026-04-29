# Advanced Features Implementation Plan

This plan outlines the steps to transform Expento into a comprehensive wealth management platform with Multi-Account support, Loan tracking, and Investment management.

## User Review Required

> [!IMPORTANT]
> **Data Migration**: Existing transactions will be migrated to a default "Cash" or "Main Bank" account.
> **SMS Parsing**: Since browsers cannot access SMS directly, I will implement a "Smart Paste" feature where you can paste a transaction SMS, and the app will auto-parse the details.

## Proposed Changes

### Firestore Schema Expansion

#### [NEW] `users/{uid}/accounts`
- `id`: string
- `name`: string (e.g., "HDFC Bank", "Paytm")
- `type`: enum ("bank", "wallet", "cash", "credit")
- `balance`: number
- `icon`: string

#### [NEW] `users/{uid}/loans`
- `id`: string
- `name`: string
- `lender`: string
- `amount`: number
- `interestRate`: number (%)
- `tenure`: number (months)
- `accountId`: string (linked account)
- `remainingBalance`: number
- `type`: enum ("personal", "home", "education", "informal")

#### [NEW] `users/{uid}/investments`
- `id`: string
- `name`: string (e.g., "Groww", "Zerodha")
- `assets`: array [
    { name: string, type: string, quantity: number, buyPrice: number, currentPrice: number }
  ]

---

### UI Components

#### [NEW] Accounts Screen
- Card-based layout for each account.
- "Total Net Worth" summary.
- Add Account modal.

#### [NEW] Loans Screen
- Progress bars for loan repayment.
- EMI calculator and schedule view.
- Add Loan modal.

#### [NEW] Investments Screen
- Portfolio value summary with P&L (Profit/Loss) indicators.
- Asset distribution charts.
- Add Holding modal.

---

### Logic & Features

#### Multi-Account Sync
- Transactions must now specify an `accountId`.
- Deduct/Add amount to the specific account balance in real-time.

#### SMS Parsing (Simulation)
- Add a text area in the "Add Transaction" modal.
- Regex-based parser for common Indian bank SMS formats.

#### Receipt Integration
- Scanned receipts will now be saved as "Pending Bills" or attached to transactions.

---

## Verification Plan

### Automated Tests
- Test EMI calculation formula accuracy.
- Test real-time balance updates across multiple accounts.

### Manual Verification
1. Create multiple accounts and verify the total balance.
2. Add a loan and check if the EMI is calculated correctly.
3. Paste a sample SMS (e.g., "₹500 debited from SBI...") into the parser and check auto-filled fields.

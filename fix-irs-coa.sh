#!/bin/bash

# Fix the assignCOA function for IRS compliance
cat > /tmp/new_assign_coa.txt << 'FUNC'
  private assignCOA(leg: RobinhoodLeg): string {
    // Closes realize gains/losses (P&L accounts)
    if (leg.position === 'close') {
      return 'T-4100'; // Options Trading Gains (backend will calculate if loss → T-5100)
    }
    
    // Opens establish positions (Balance Sheet accounts)
    if (leg.action === 'buy') {
      return leg.optionType === 'call' ? 'T-1200' : 'T-1210';
    } else {
      // All short options (calls and puts) use T-2100
      return 'T-2100';
    }
  }
FUNC

# Replace the function
sed -i.backup3 '/private assignCOA(leg: RobinhoodLeg): string {/,/^  }$/c\
  private assignCOA(leg: RobinhoodLeg): string {\
    \/\/ Closes realize gains\/losses (P\&L accounts)\
    if (leg.position === '\''close'\'') {\
      return '\''T-4100'\''; \/\/ Options Trading Gains (backend will calculate if loss → T-5100)\
    }\
    \
    \/\/ Opens establish positions (Balance Sheet accounts)\
    if (leg.action === '\''buy'\'') {\
      return leg.optionType === '\''call'\'' ? '\''T-1200'\'' : '\''T-1210'\'';\
    } else {\
      \/\/ All short options (calls and puts) use T-2100\
      return '\''T-2100'\'';\
    }\
  }' src/lib/robinhood-parser.ts

echo "✅ IRS-compliant COA mapping implemented!"
echo ""
echo "OPENS (Balance Sheet - Positions):"
echo "  • Buy Call  → T-1200 (Stock Positions)"
echo "  • Buy Put   → T-1210 (Options Positions - Long)"
echo "  • Sell Call → T-2100 (Options Positions - Short)"
echo "  • Sell Put  → T-2100 (Options Positions - Short)"
echo ""
echo "CLOSES (Income Statement - Realized Gains/Losses):"
echo "  • ALL closes → T-4100 (Options Trading Gains)"
echo "                 (Backend converts to T-5100 if loss)"

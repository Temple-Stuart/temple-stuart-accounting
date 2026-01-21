import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// GET: List corporate actions for a symbol or all
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    const actions = await prisma.corporate_actions.findMany({
      where: {
        user_id: user.id,
        ...(symbol && { symbol: symbol.toUpperCase() })
      },
      include: {
        lot_adjustments: true
      },
      orderBy: { effective_date: 'desc' }
    });

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Corporate actions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Record a corporate action (split, dividend, etc.)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const {
      symbol,
      action_type,        // SPLIT, REVERSE_SPLIT, STOCK_DIVIDEND
      effective_date,
      ratio_from,         // e.g., 1 for 1:50 reverse split
      ratio_to,           // e.g., 50 for 1:50 reverse split
      pre_split_shares,   // Optional: shares before split
      post_split_shares,  // Optional: shares after split
      notes,
      source,             // SEC filing, broker statement, etc.
      
      // For adding missing pre-split lots
      add_pre_split_lot,  // Boolean: should we create a lot for pre-split shares?
      lot_cost_basis,     // Cost basis for the pre-split lot (0 if unknown)
      lot_acquired_date,  // Original acquisition date (or effective_date if unknown)
    } = await request.json();

    if (!symbol || !action_type || !effective_date || !ratio_from || !ratio_to) {
      return NextResponse.json({ 
        error: 'Required: symbol, action_type, effective_date, ratio_from, ratio_to' 
      }, { status: 400 });
    }

    const effectiveDateObj = new Date(effective_date);
    const isReverseSplit = action_type === 'REVERSE_SPLIT' || ratio_to > ratio_from;
    
    // Calculate the multiplier
    // Forward split (2:1): multiply shares by 2, divide cost by 2
    // Reverse split (1:50): divide shares by 50, multiply cost by 50
    const shareMultiplier = isReverseSplit ? ratio_from / ratio_to : ratio_to / ratio_from;
    const costMultiplier = 1 / shareMultiplier;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the corporate action record
      const action = await tx.corporate_actions.create({
        data: {
          id: uuidv4(),
          user_id: user.id,
          symbol: symbol.toUpperCase(),
          action_type,
          effective_date: effectiveDateObj,
          ratio_from,
          ratio_to,
          pre_split_shares,
          post_split_shares,
          notes,
          source
        }
      });

      // 2. If adding a pre-split lot (for shares that existed before the split)
      let newLot = null;
      if (add_pre_split_lot && post_split_shares) {
        const acquiredDate = lot_acquired_date ? new Date(lot_acquired_date) : effectiveDateObj;
        const costBasis = lot_cost_basis || 0;
        const costPerShare = post_split_shares > 0 ? costBasis / post_split_shares : 0;

        newLot = await tx.stock_lots.create({
          data: {
            id: uuidv4(),
            user_id: user.id,
            investment_txn_id: `CORP-ACTION-${action.id.slice(0, 8)}`,
            symbol: symbol.toUpperCase(),
            acquired_date: acquiredDate,
            original_quantity: post_split_shares,
            remaining_quantity: post_split_shares,
            cost_per_share: costPerShare,
            total_cost_basis: costBasis,
            fees: 0,
            status: 'OPEN'
          }
        });

        // Record the adjustment
        await tx.lot_adjustments.create({
          data: {
            id: uuidv4(),
            lot_id: newLot.id,
            corporate_action_id: action.id,
            original_quantity: pre_split_shares || (post_split_shares / shareMultiplier),
            adjusted_quantity: post_split_shares,
            original_cost_per_share: costBasis / (pre_split_shares || post_split_shares / shareMultiplier),
            adjusted_cost_per_share: costPerShare
          }
        });
      }

      // 3. Adjust any existing lots acquired BEFORE the split date
      const existingLots = await tx.stock_lots.findMany({
        where: {
          user_id: user.id,
          symbol: symbol.toUpperCase(),
          acquired_date: { lt: effectiveDateObj },
          status: { in: ['OPEN', 'PARTIAL'] }
        }
      });

      const adjustments = [];
      for (const lot of existingLots) {
        const newQuantity = lot.original_quantity * shareMultiplier;
        const newRemaining = lot.remaining_quantity * shareMultiplier;
        const newCostPerShare = lot.cost_per_share * costMultiplier;

        await tx.stock_lots.update({
          where: { id: lot.id },
          data: {
            original_quantity: newQuantity,
            remaining_quantity: newRemaining,
            cost_per_share: newCostPerShare
            // total_cost_basis stays the same!
          }
        });

        const adjustment = await tx.lot_adjustments.create({
          data: {
            id: uuidv4(),
            lot_id: lot.id,
            corporate_action_id: action.id,
            original_quantity: lot.original_quantity,
            adjusted_quantity: newQuantity,
            original_cost_per_share: lot.cost_per_share,
            adjusted_cost_per_share: newCostPerShare
          }
        });

        adjustments.push({
          lotId: lot.id,
          before: { shares: lot.original_quantity, costPerShare: lot.cost_per_share },
          after: { shares: newQuantity, costPerShare: newCostPerShare }
        });
      }

      return {
        action,
        newLot,
        adjustedLots: adjustments.length,
        adjustments
      };
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Corporate actions POST error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to record corporate action' 
    }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { historyText } = await request.json();
    
    if (!historyText?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }
    
    // Path to robinhood history file
    const filePath = path.join(process.cwd(), 'robinhood_history.txt');
    
    // Read existing content (or empty string if file doesn't exist)
    let existingContent = '';
    try {
      existingContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      // File doesn't exist yet, will create it
      console.log('Creating new robinhood_history.txt file');
    }
    
    // Prepend new text to TOP of file with separator
    const newContent = `${historyText.trim()}\n\n${existingContent}`;
    
    // Write back to file
    await fs.writeFile(filePath, newContent, 'utf-8');
    
    // Count trade blocks in pasted text
    const newTradeCount = (historyText.match(/Download Trade Confirmation/g) || []).length;
    
    return NextResponse.json({
      success: true,
      message: `Added ${newTradeCount} trades to history file`,
      tradesAdded: newTradeCount
    });
    
  } catch (error) {
    console.error('Error appending history:', error);
    return NextResponse.json({ 
      error: 'Failed to update history file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

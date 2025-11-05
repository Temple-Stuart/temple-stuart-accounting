import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const historyPath = path.join(process.cwd(), 'robinhood_history.txt');
    
    try {
      await fs.access(historyPath);
    } catch {
      return NextResponse.json({ historyText: '' });
    }
    
    const historyText = await fs.readFile(historyPath, 'utf-8');
    
    return NextResponse.json({ 
      success: true,
      historyText 
    });
  } catch (error) {
    console.error('Error reading history:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to read history file',
      historyText: ''
    }, { status: 500 });
  }
}

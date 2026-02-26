const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

// IRS-Compliant COA Mapping
function mapCOACode(action, positionEffect, contractType) {
  if (positionEffect === 'open') {
    if (action === 'buy') {
      return contractType === 'call' ? 'T-1200' : 'T-1210';
    } else {
      return contractType === 'call' ? 'T-2100' : 'T-2110';
    }
  }
  return 'CLOSE';
}

// Detect strategy type from legs
function detectStrategy(legs) {
  if (legs.length === 1) {
    const leg = legs[0];
    if (leg.positionEffect === 'open') {
      if (leg.action === 'buy') {
        return `Long ${leg.contractType === 'call' ? 'Call' : 'Put'}`;
      } else {
        return `Short ${leg.contractType === 'call' ? 'Call' : 'Put'}`;
      }
    } else {
      return `Closing ${leg.contractType === 'call' ? 'Call' : 'Put'}`;
    }
  }
  
  if (legs.length === 2) {
    const calls = legs.filter(l => l.contractType === 'call');
    const puts = legs.filter(l => l.contractType === 'put');
    
    if (calls.length === 2) {
      const buy = legs.find(l => l.action === 'buy');
      const sell = legs.find(l => l.action === 'sell');
      
      if (legs[0].positionEffect === 'open') {
        return buy.strike < sell.strike ? 'Bull Call Spread' : 'Bear Call Spread';
      } else {
        return 'Closing Call Spread';
      }
    }
    
    if (puts.length === 2) {
      const buy = legs.find(l => l.action === 'buy');
      const sell = legs.find(l => l.action === 'sell');
      
      if (legs[0].positionEffect === 'open') {
        return buy.strike < sell.strike ? 'Bear Put Spread' : 'Bull Put Spread';
      } else {
        return 'Closing Put Spread';
      }
    }
  }
  
  if (legs.length === 4) {
    const calls = legs.filter(l => l.contractType === 'call');
    const puts = legs.filter(l => l.contractType === 'put');
    
    if (calls.length === 2 && puts.length === 2) {
      return legs[0].positionEffect === 'open' ? 'Iron Condor' : 'Closing Iron Condor';
    }
  }
  
  return `${legs.length}-Leg Strategy`;
}

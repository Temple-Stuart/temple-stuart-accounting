'use client';

import React, { useState } from 'react';

export default function ProspectSection() {
  const [expenseTier, setExpenseTier] = useState('tier1');
  const [frequency, setFrequency] = useState('monthly');
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    numBankAccounts: '',
    numCreditCards: '',
    monthlyTransactions: '',
    hasPayroll: 'no',
    hasInventory: 'no',
    currentBookkeeping: '',
    biggestPainPoint: '',
    preferredTime: '',
    additionalInfo: ''
  });
  
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Rest of your pricing tiers code stays the same...
  const pricingTiers = {
    tier1: { range: 'Under $10k/month', basePrice: 299, name: 'Starter' },
    tier2: { range: '$10k - $25k/month', basePrice: 499, name: 'Growing' },
    tier3: { range: '$25k - $50k/month', basePrice: 799, name: 'Established' },
    tier4: { range: '$50k - $100k/month', basePrice: 1299, name: 'Scale' }
  };

  const frequencyMultipliers = {
    monthly: { label: 'Monthly', multiplier: 1 },
    weekly: { label: 'Weekly', multiplier: 1.5 },
    daily: { label: 'Daily', multiplier: 2 }
  };

  const currentTier = pricingTiers[expenseTier as keyof typeof pricingTiers];
  const currentFrequency = frequencyMultipliers[frequency as keyof typeof frequencyMultipliers];
  const finalPrice = Math.round(currentTier.basePrice * currentFrequency.multiplier);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      // ACTUALLY SAVE TO DATABASE!
      const response = await fetch('/api/rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expenseTier,
          frequency,
          totals: { monthly: finalPrice },
          needs: formData.additionalInfo,
          timeline: formData.preferredTime
        })
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitMessage('Thanks! I\'ll review everything and reach out within 24 hours to schedule our consultation.');
        // Clear form
        setFormData({
          businessName: '',
          contactName: '',
          email: '',
          phone: '',
          numBankAccounts: '',
          numCreditCards: '',
          monthlyTransactions: '',
          hasPayroll: 'no',
          hasInventory: 'no',
          currentBookkeeping: '',
          biggestPainPoint: '',
          preferredTime: '',
          additionalInfo: ''
        });
      } else {
        setSubmitMessage('Something went wrong. Please try again.');
        console.error('API Error:', result);
      }
    } catch (error) {
      setSubmitMessage('Error submitting request. Please try again.');
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keep the rest of your component the same, just make sure the form uses onSubmit={handleSubmit}
  // and all the JSX stays the same...

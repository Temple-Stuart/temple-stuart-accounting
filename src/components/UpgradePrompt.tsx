'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UpgradePromptProps {
  feature: string;
  requiredTier?: 'pro' | 'pro_plus';
}

export default function UpgradePrompt({ feature, requiredTier = 'pro' }: UpgradePromptProps) {
  const router = useRouter();
  const tierLabel = requiredTier === 'pro_plus' ? 'Pro+' : 'Pro';
  const price = requiredTier === 'pro_plus' ? '$40' : '$20';

  return (
    <div className="border border-gray-200 bg-gray-50 p-6 text-center max-w-md mx-auto my-8">
      <div className="text-sm font-medium text-gray-900 mb-2">
        {feature} requires {tierLabel}
      </div>
      <div className="text-xs text-gray-500 mb-4">
        Upgrade to {tierLabel} ({price}/mo) to unlock this feature.
      </div>
      <button
        onClick={() => router.push('/pricing')}
        className="px-6 py-2 text-xs bg-[#2d1b4e] text-white font-medium hover:bg-[#3d2b5e]"
      >
        View Plans
      </button>
    </div>
  );
}

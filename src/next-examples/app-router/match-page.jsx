// Next.js App Router: app/match/page.jsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TeamProvider } from '@/context/TeamContext';
import MatchDashboard from '@/components/MatchDashboard';

export default function MatchPage() {
  const router = useRouter();

  return (
    <TeamProvider>
      <MatchDashboard
        onNavigateToControl={() => router.push('/control')}
        onNavigateToDashboard={() => router.push('/dashboard')}
      />
    </TeamProvider>
  );
}


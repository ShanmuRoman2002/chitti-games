// Next.js App Router: app/dashboard/page.jsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TeamProvider } from '@/context/TeamContext';
import Dashboard from '@/components/Dashboard';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <TeamProvider>
      <Dashboard onNavigateToMatch={() => router.push('/match')} />
    </TeamProvider>
  );
}


'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WhatsAppPage } from '@/pages/whatsapp';
import { EmailPage } from '@/pages/email';

type AppPage = 'whatsapp' | 'email';

function SimulatorContent() {
  const searchParams = useSearchParams();
  const [activePage, setActivePage] = useState<AppPage>('whatsapp');

  useEffect(() => {
    const channel = searchParams.get('channel');
    if (channel === 'email') setActivePage('email');
    else if (channel === 'whatsapp') setActivePage('whatsapp');
  }, [searchParams]);

  return (
    <div className="h-screen overflow-hidden">
      {activePage === 'whatsapp' ? (
        <WhatsAppPage />
      ) : (
        <EmailPage />
      )}
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center h-screen">Loading simulator...</div>}>
      <SimulatorContent />
    </Suspense>
  );
}

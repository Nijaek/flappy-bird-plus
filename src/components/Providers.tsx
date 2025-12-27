'use client';

import { SessionProvider } from 'next-auth/react';
import { AudioProvider } from '@/contexts/AudioContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AudioProvider>{children}</AudioProvider>
    </SessionProvider>
  );
}

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-cyber-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyber-border rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-cyber-cyan
            rounded-full border-t-transparent animate-spin" />
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-mono text-sm">Carregando...</span>
        </div>
      </div>
    </div>
  );
}

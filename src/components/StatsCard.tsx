'use client';

import React, { ReactNode } from 'react';

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: 'cyan' | 'purple' | 'green' | 'orange' | 'red' | 'pink';
  subtitle?: string;
}

const colorClasses = {
  cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400',
  purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
  green: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
  orange: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400',
  red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400',
  pink: 'from-pink-500/20 to-pink-500/5 border-pink-500/30 text-pink-400',
};

export default function StatsCard({ icon, label, value, color = 'cyan', subtitle }: StatsCardProps) {
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-5
      backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-white/5">{icon}</div>
        <span className="text-sm text-gray-400 font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

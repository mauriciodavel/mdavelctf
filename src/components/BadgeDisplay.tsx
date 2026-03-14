'use client';

import React from 'react';
import { RARITY_COLORS } from '@/lib/utils';

export interface BadgeDisplayProps {
  badge?: { name: string; rarity: string; description?: string; icon?: string; iconUrl?: string | null };
  name?: string;
  rarity?: string;
  description?: string;
  iconUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const rarityBg: Record<string, string> = {
  comum: 'from-gray-500/20 to-gray-600/10',
  cru: 'from-blue-500/20 to-blue-600/10',
  epico: 'from-purple-500/20 to-purple-600/10',
  lendario: 'from-yellow-500/20 to-amber-600/10',
};

const rarityGlow: Record<string, string> = {
  comum: '',
  cru: 'shadow-[0_0_10px_rgba(59,130,246,0.2)]',
  epico: 'shadow-[0_0_15px_rgba(139,92,246,0.3)]',
  lendario: 'shadow-[0_0_20px_rgba(234,179,8,0.3)] animate-pulse-glow',
};

export default function BadgeDisplay({ badge, name: nameProp, rarity: rarityProp, description: descProp, iconUrl: iconProp, size = 'md' }: BadgeDisplayProps) {
  const name = badge?.name || nameProp || '?';
  const rarity = badge?.rarity || rarityProp || 'comum';
  const description = badge?.description || descProp;
  const iconUrl = badge?.icon || badge?.iconUrl || iconProp;
  const sizeClasses = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-24 h-24 text-4xl',
  };

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${rarityBg[rarity] || rarityBg.comum}
        border-2 ${RARITY_COLORS[rarity] || RARITY_COLORS.comum}
        ${rarityGlow[rarity] || ''} flex items-center justify-center
        transition-all duration-300 group-hover:scale-110`}>
        {iconUrl ? (
          <img src={iconUrl} alt={name} className="w-3/4 h-3/4 object-contain" />
        ) : (
          <span>🏆</span>
        )}
      </div>
      <div className="text-center">
        <p className={`text-xs font-semibold ${RARITY_COLORS[rarity]?.split(' ')[0] || 'text-gray-400'}`}>
          {name}
        </p>
        {description && (
          <p className="text-[10px] text-gray-500 max-w-[100px] truncate">{description}</p>
        )}
      </div>
    </div>
  );
}

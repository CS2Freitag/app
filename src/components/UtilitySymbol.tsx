import React from 'react';
import { UtilityType } from '../types';

interface UtilitySymbolProps {
  type: UtilityType;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const UTILITY_META: Record<
  UtilityType,
  {
    labelDe: string;
    labelEn: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    colorHex: string;
  }
> = {
  smoke: {
    labelDe: 'Smoke',
    labelEn: 'Smoke',
    bgClass: 'bg-sky-500 text-white',
    textClass: 'text-sky-500',
    borderClass: 'border-sky-200/80',
    colorHex: '#0ea5e9',
  },
  flash: {
    labelDe: 'Flash',
    labelEn: 'Flash',
    bgClass: 'bg-amber-300 text-zinc-950',
    textClass: 'text-amber-300',
    borderClass: 'border-white/90',
    colorHex: '#fcd34d',
  },
  molotov: {
    labelDe: 'Molotov',
    labelEn: 'Molotov',
    bgClass: 'bg-orange-500 text-white',
    textClass: 'text-orange-500',
    borderClass: 'border-orange-200/80',
    colorHex: '#f97316',
  },
  he: {
    labelDe: 'HE-Granate',
    labelEn: 'HE Grenade',
    bgClass: 'bg-red-600 text-white',
    textClass: 'text-red-600',
    borderClass: 'border-red-200/80',
    colorHex: '#dc2626',
  },
  decoy: {
    labelDe: 'Decoy',
    labelEn: 'Decoy',
    bgClass: 'bg-purple-600 text-white',
    textClass: 'text-purple-600',
    borderClass: 'border-purple-200/80',
    colorHex: '#9333ea',
  },
};

export const UtilitySymbol: React.FC<UtilitySymbolProps> = ({
  type,
  size = 'md',
  className = '',
}) => {
  const iconDim = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-6 h-6';

  switch (type) {
    case 'smoke':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${iconDim} ${className}`} aria-hidden="true">
          <path
            d="M7 16a4 4 0 0 1-.88-7.9A5 5 0 0 1 15.9 6a3.5 3.5 0 0 1 1.6 6.62A3 3 0 0 1 16 18H8a3 3 0 0 1-1-2z"
            fill="currentColor"
            fillOpacity="0.95"
          />
          <circle cx="9.5" cy="14" r="1.4" fill="#0c4a6e" fillOpacity="0.45" />
          <circle cx="14" cy="12" r="1.8" fill="#0c4a6e" fillOpacity="0.35" />
        </svg>
      );
    case 'flash':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${iconDim} ${className}`} aria-hidden="true">
          <path
            d="M12 2l2.2 5.4L20 6l-3.4 4.8L22 13l-5.6 1.8L18 20l-5.2-3.2L10 22l-.8-5.8L4 17l3.2-4.6L2 10l5.6-1.6L6 3.2l4.8 3.2L12 2z"
            fill="currentColor"
          />
          <circle cx="12" cy="12" r="2.6" fill="#78350f" fillOpacity="0.45" />
        </svg>
      );
    case 'molotov':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${iconDim} ${className}`} aria-hidden="true">
          <path
            d="M12.5 2.5c.8 2.2 3.5 3.7 3.5 7.1 0 1.4-.5 2.5-1.3 3.3 1.4-.4 2.5-1.6 2.8-3.1 1.6 1.4 2.5 3.5 2.5 5.6A7 7 0 0 1 5 15.4c0-3.2 2-5.7 4-7.4 0 1.3.5 2.3 1.3 2.8-.2-2.8.8-5.6 2.2-8.3z"
            fill="currentColor"
          />
          <path
            d="M12 19.5a3 3 0 0 0 3-3c0-1.5-1.1-2.7-2.4-3.7-.3 1-.9 1.6-1.6 1.9-.6.3-1.4 1-1.4 2.1a2.7 2.7 0 0 0 2.4 2.7z"
            fill="#fef08a"
            fillOpacity="0.9"
          />
        </svg>
      );
    case 'he':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${iconDim} ${className}`} aria-hidden="true">
          <rect x="9" y="3" width="6" height="3" rx="1" fill="currentColor" />
          <path d="M12 6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="14" r="6.5" fill="currentColor" />
          <path
            d="M6.5 14h11M12 8v12M8.2 10.2l7.6 7.6M15.8 10.2l-7.6 7.6"
            stroke="#7f1d1d"
            strokeWidth="1.3"
          />
        </svg>
      );
    case 'decoy':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${iconDim} ${className}`} aria-hidden="true">
          <circle cx="12" cy="12" r="2.6" fill="currentColor" />
          <path
            d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4.8 4.8a10.2 10.2 0 0 0 0 14.4M19.2 4.8a10.2 10.2 0 0 1 0 14.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeOpacity="0.7"
          />
        </svg>
      );
  }
};

import React, { useState } from 'react';
import { X, Palette } from 'lucide-react';
import { Language } from '../types';

interface CustomColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  lang: Language;
}

const EXTENDED_COLORS = [
  '#ffffff', '#000000', '#3b82f6', '#1d4ed8', '#60a5fa',
  '#ef4444', '#b91c1c', '#f87171', '#22c55e', '#15803d',
  '#4ade80', '#f97316', '#c2410c', '#fb923c', '#eab308',
  '#a16207', '#facc15', '#a855f7', '#7e22ce', '#c084fc',
  '#ec4899', '#be185d', '#f472b6', '#14b8a6', '#0f766e',
  '#38bdf8', '#84cc16', '#65a30d', '#d97706', '#9a3412'
];

export const CustomColorModal: React.FC<CustomColorModalProps> = ({
  isOpen,
  onClose,
  currentColor,
  onSelectColor,
  lang,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';
  const [customHex, setCustomHex] = useState(currentColor || '#ffffff');

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl text-zinc-100 space-y-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              {isDe ? 'Eigene Farbe wählen' : 'Choose Custom Color'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-400 font-semibold mb-2">
              {isDe ? 'Farbpalette (viele Farben)' : 'Color Palette'}
            </label>
            <div className="grid grid-cols-6 gap-2">
              {EXTENDED_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onSelectColor(c);
                    onClose();
                  }}
                  style={{ backgroundColor: c }}
                  className={`w-full aspect-square rounded-xl border transition-all hover:scale-110 cursor-pointer shadow-xs ${
                    currentColor === c ? 'border-amber-400 ring-2 ring-amber-400/70 scale-105' : 'border-zinc-700'
                  }`}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <label className="block text-zinc-400 font-semibold">
              {isDe ? 'Eigener HEX-Farbcode oder Pipette' : 'Custom HEX Color or Picker'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                className="w-12 h-10 rounded-lg bg-zinc-950 border border-zinc-700 cursor-pointer p-1"
              />
              <input
                type="text"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                placeholder="#ff0000"
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 font-mono text-zinc-200 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  onSelectColor(customHex);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors cursor-pointer"
              >
                {isDe ? 'Übernehmen' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

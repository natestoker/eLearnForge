import React, { useState } from 'react';
import { useSelectedBlock, useProjectStore } from '../state/projectStore';

interface LogicPopupProps {
  onClose: () => void;
}

export function LogicPopup({ onClose }: LogicPopupProps) {
  const block = useSelectedBlock();
  const updateBlock = useProjectStore((s) => s.updateBlock);
  
  const [ease, setEase] = useState(block?.motion?.ease ?? 'power1.inOut');
  
  if (!block) return null;

  const handleApply = () => {
    updateBlock(block.id, (b) => {
      if (b.motion) {
        b.motion.ease = ease;
      } else {
        b.motion = { preset: 'line', vector: { x: 200, y: 0 }, start: 0, duration: 2, ease, loop: false };
      }
    });
    onClose();
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-surface-container shadow-2xl border border-primary/40 rounded-lg p-4 z-50 animate-in fade-in zoom-in duration-300">
      <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-2">
        <h3 className="font-headline-sm text-[14px] flex items-center gap-2">
          <svg className="w-[18px] h-[18px] text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 15c3-6 6 1 9-2 2-2 1-5-1-4-1 .6-1 3 .5 4.5 1.4 1.4 4 1.8 6.5.5" />
          </svg>
          Custom Path Editor
        </h3>
        <button className="text-on-surface-variant hover:text-on-surface" onClick={onClose} title="Close">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Graph Editor */}
      <div className="h-48 bg-surface-container-lowest border border-outline-variant rounded relative overflow-hidden mb-4">
        <div className="absolute inset-0 timeline-track opacity-10" style={{ background: 'repeating-linear-gradient(90deg, #232a25, #232a25 1px, transparent 1px, transparent 40px)' }}></div>
        {/* Bezier Curve Visualization */}
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M 0 100 C 20 100 40 0 100 0" fill="none" stroke="#3ddc97" strokeWidth="2"></path>
        </svg>
        {/* Handles */}
        <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-primary border border-surface cursor-grab"></div>
        <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-primary border border-surface cursor-grab"></div>
        <div className="absolute bottom-[20%] left-[30%] w-2 h-2 bg-primary border border-surface cursor-grab opacity-50"></div>
        <div className="absolute top-[20%] right-[30%] w-2 h-2 bg-primary border border-surface cursor-grab opacity-50"></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="font-label-code text-[10px] text-on-surface-variant uppercase">Easing</label>
          <select 
            value={ease}
            onChange={(e) => setEase(e.target.value)}
            className="bg-surface-container-highest border border-outline-variant text-[11px] rounded px-2 py-1 outline-none text-on-surface"
          >
            <option value="power1.inOut">Ease In Out (Cubic)</option>
            <option value="none">Linear</option>
            <option value="bounce.out">Elastic Bounce</option>
            <option value="custom">Custom Bezier</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-label-code text-[10px] text-on-surface-variant uppercase">Path Type</label>
          <div className="flex gap-1">
            <button className="flex-1 bg-primary text-on-primary text-[10px] py-1 rounded-sm">Curved</button>
            <button className="flex-1 bg-surface-container-highest border border-outline-variant text-[10px] py-1 rounded-sm">Angular</button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button className="px-3 py-1.5 text-[11px] text-on-surface-variant hover:bg-surface-container-high rounded transition-colors" onClick={onClose}>
          Discard
        </button>
        <button className="px-4 py-1.5 text-[11px] bg-primary text-on-primary font-bold rounded" onClick={handleApply}>
          Apply Motion
        </button>
      </div>
    </div>
  );
}

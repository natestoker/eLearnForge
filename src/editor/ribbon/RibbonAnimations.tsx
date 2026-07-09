import { useSelectedBlock, useProjectStore, useCurrentSlide } from '../../state/projectStore';
import type { AnimType } from '../../schema/types';
import { useState } from 'react';
import { LogicPopup } from '../LogicPopup';
import { 
  WhipInIcon, DropInIcon, BounceInIcon, StretchHorizontalIcon, 
  SpinInIcon, BlurIcon, GrowIcon, PopRotateIcon, 
  FlipIcon, SwivelIcon, UnfoldVerticalIcon 
} from './AnimationIcons';

const GALLERY_ITEMS: { type: AnimType, label: string, icon: React.ReactNode | string }[] = [
  { type: 'none', label: 'None', icon: 'do_not_disturb' },
  { type: 'fade', label: 'Fade', icon: 'blur_on' },
  { type: 'slide', label: 'Fly In', icon: 'flight_land' },
  { type: 'rise', label: 'Float In', icon: 'keyboard_double_arrow_up' },
  { type: 'wipe', label: 'Wipe', icon: 'cleaning_services' },
  { type: 'zoom', label: 'Zoom In', icon: 'zoom_in' },
  { type: 'zoomOut', label: 'Zoom Out', icon: 'zoom_out' },
  { type: 'blur', label: 'Blur', icon: <BlurIcon /> },
  { type: 'spin', label: 'Spin', icon: <SpinInIcon /> },
  { type: 'flip', label: 'Flip', icon: <FlipIcon /> },
  { type: 'bounceIn', label: 'Bounce', icon: <BounceInIcon /> },
  { type: 'popRotate', label: 'Pop', icon: <PopRotateIcon /> },
  { type: 'grow', label: 'Grow', icon: <GrowIcon /> },
  { type: 'stretch', label: 'Stretch', icon: <StretchHorizontalIcon /> },
  { type: 'collapse', label: 'Unfold', icon: <UnfoldVerticalIcon /> },
  { type: 'drop', label: 'Drop', icon: <DropInIcon /> },
  { type: 'swivel', label: 'Swivel', icon: <SwivelIcon /> },
  { type: 'whipIn', label: 'Whip In', icon: <WhipInIcon /> }
];

export function RibbonAnimations() {
  const block = useSelectedBlock();
  const slide = useCurrentSlide();
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const mutate = useProjectStore((s) => s.mutate);
  const [showLogicPopup, setShowLogicPopup] = useState(false);

  if (!block) {
    return <div style={{ padding: 16, color: 'var(--muted)' }}>Select a block to animate.</div>;
  }

  const timing = block.timing;
  const ensureTimeline = () => {
    if (!slide.timeline) {
      mutate((p) => {
        const s = p.slides.find((sl) => sl.id === slide.id);
        if (s) s.timeline = { duration: 10, autoAdvance: false };
      });
    }
  };

  const setEntrance = (type: AnimType) => {
    ensureTimeline();
    updateBlock(block.id, (b) => {
      if (!b.timing) b.timing = { start: 0 };
      b.timing.animIn = type === 'none' ? undefined : { type, duration: b.timing.animIn?.duration ?? 0.5, ease: b.timing.animIn?.ease ?? 'power2.out' };
    });
  };

  const currentAnim = timing?.animIn?.type ?? 'none';

  return (
    <div className="flex items-center px-4 py-2 flex-1 gap-2 bg-surface-container h-full overflow-x-auto scrollbar-hide">
      {/* Group: Animation Gallery */}
      <div className="flex flex-col h-full justify-between items-center px-2 min-w-[max-content]">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide max-w-[500px]">
          {GALLERY_ITEMS.map((item) => {
            const isActive = currentAnim === item.type;
            return (
              <div 
                key={item.type}
                onClick={() => setEntrance(item.type)}
                className={`flex flex-col items-center justify-center gap-1 p-1 rounded cursor-pointer border min-w-[56px] h-14 ${isActive ? 'border-outline-variant bg-surface-container-highest text-primary' : 'hover:bg-surface-container-highest border-transparent text-on-surface-variant'}`}
              >
                <div className="w-8 h-8 flex items-center justify-center overflow-hidden rounded">
                  {typeof item.icon === 'string' ? (
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}>{item.icon}</span>
                  ) : (
                    <div className="w-8 h-8">{item.icon}</div>
                  )}
                </div>
                <span className="font-body-sm text-[9px] uppercase tracking-tighter">{item.label}</span>
              </div>
            );
          })}
        </div>
        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Animation Gallery</span>
      </div>

      <div className="ribbon-group-divider" style={{ width: 1, height: 60, backgroundColor: '#2d2d2d', margin: '0 12px' }}></div>

      {/* Group: Effect Options */}
      <div className="flex flex-col h-full justify-between items-center px-2">
        <button 
          className="flex flex-col items-center gap-1 p-2 rounded hover:bg-surface-container-highest cursor-pointer border border-outline-variant h-14 justify-center"
          onClick={() => setShowLogicPopup(true)}
        >
          <span className="material-symbols-outlined text-on-surface">settings_voice</span>
          <span className="font-body-sm text-[10px] uppercase tracking-tighter">Effect Options</span>
        </button>
        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Options</span>
      </div>

      <div className="ribbon-group-divider" style={{ width: 1, height: 60, backgroundColor: '#2d2d2d', margin: '0 12px' }}></div>

      {/* Group: Timing */}
      <div className="flex flex-col h-full justify-between items-center px-2 min-w-[280px]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
          <div className="flex items-center gap-2">
            <label className="font-label-code text-on-surface-variant">Start</label>
            <select 
              value="On Click"
              onChange={() => {}}
              className="bg-surface-container-lowest border border-outline-variant text-[11px] rounded px-1 py-0.5 focus:border-primary outline-none text-on-surface flex-1"
            >
              <option>On Click</option>
              <option>With Previous</option>
              <option>After Previous</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-label-code text-on-surface-variant">Delay</label>
            <input 
              className="bg-surface-container-lowest border border-outline-variant text-[11px] rounded px-1 py-0.5 focus:border-primary outline-none text-on-surface w-16 text-center" 
              type="number" 
              step="0.1"
              value={timing?.start ?? 0}
              onChange={(e) => {
                ensureTimeline();
                updateBlock(block.id, (b) => {
                  if (!b.timing) b.timing = { start: 0 };
                  b.timing.start = Math.max(0, parseFloat(e.target.value) || 0);
                });
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-label-code text-on-surface-variant">Duration</label>
            <input 
              className="bg-surface-container-lowest border border-outline-variant text-[11px] rounded px-1 py-0.5 focus:border-primary outline-none text-on-surface w-16 text-center" 
              type="number" 
              step="0.1"
              value={timing?.animIn?.duration ?? 0.5}
              onChange={(e) => {
                ensureTimeline();
                updateBlock(block.id, (b) => {
                  if (!b.timing) b.timing = { start: 0 };
                  if (b.timing.animIn) b.timing.animIn.duration = Math.max(0.1, parseFloat(e.target.value) || 0.5);
                });
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-label-code text-on-surface-variant">Repeat</label>
            <select 
              value={block.emphasis ? "Infinite" : "None"}
              onChange={(e) => {
                updateBlock(block.id, (b) => {
                  b.emphasis = e.target.value === "Infinite" ? "pulse" : undefined;
                });
              }}
              className="bg-surface-container-lowest border border-outline-variant text-[11px] rounded px-1 py-0.5 focus:border-primary outline-none text-on-surface flex-1"
            >
              <option>None</option>
              <option>2x</option>
              <option>Infinite</option>
            </select>
          </div>
        </div>
        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Timing</span>
      </div>

      <div className="ribbon-group-divider" style={{ width: 1, height: 60, backgroundColor: '#2d2d2d', margin: '0 12px' }}></div>

      {/* Group: Advanced */}
      <div className="flex flex-col h-full justify-between items-center px-2">
        <div className="flex gap-2">
          <button className="flex flex-col items-center gap-1 p-1 rounded hover:bg-surface-container-highest cursor-pointer border border-outline-variant">
            <span className="material-symbols-outlined text-on-surface">brush</span>
            <span className="font-body-sm text-[10px] uppercase tracking-tighter">Painter</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-1 rounded bg-secondary-container/20 border border-primary text-primary">
            <span className="material-symbols-outlined">view_sidebar</span>
            <span className="font-body-sm text-[10px] uppercase tracking-tighter">Pane</span>
          </button>
        </div>
        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Advanced</span>
      </div>

      {showLogicPopup && <LogicPopup onClose={() => setShowLogicPopup(false)} />}
    </div>
  );
}

import { useSelectedBlock, useProjectStore, useCurrentSlide } from '../../state/projectStore';
import type { AnimType, Block } from '../../schema/types';
import {
  WhipInIcon, DropInIcon, BounceInIcon, StretchHorizontalIcon,
  SpinInIcon, BlurIcon, GrowIcon, PopRotateIcon,
  FlipIcon, SwivelIcon, UnfoldVerticalIcon,
  NoneIcon, FadeInIcon, FlyInIcon, FloatInIcon, WipeIcon,
  ZoomInAnimIcon, ZoomOutAnimIcon
} from './AnimationIcons';

// Quick animation controls. Every control here is wired to the real model -
// the gallery sets timing.animIn, Timing edits delay/duration, Exit sets
// timing.animOut, Emphasis loops via block.emphasis, Motion sets
// block.motion. Fine-tuning (easing, direction, effect stacks, previews)
// lives in the Animate tab of the block panel on the right.

// Every gallery tile is an animated SVG preview of its effect - one icon
// system, no icon-font dependency.
const GALLERY_ITEMS: { type: AnimType, label: string, icon: React.ReactNode }[] = [
  { type: 'none', label: 'None', icon: <NoneIcon /> },
  { type: 'fade', label: 'Fade', icon: <FadeInIcon /> },
  { type: 'slide', label: 'Fly In', icon: <FlyInIcon /> },
  { type: 'rise', label: 'Float In', icon: <FloatInIcon /> },
  { type: 'wipe', label: 'Wipe', icon: <WipeIcon /> },
  { type: 'zoom', label: 'Zoom In', icon: <ZoomInAnimIcon /> },
  { type: 'zoomOut', label: 'Zoom Out', icon: <ZoomOutAnimIcon /> },
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

const EXITS: { value: AnimType | 'none'; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'fade', label: 'Fade' }, { value: 'slide', label: 'Fly out' },
  { value: 'rise', label: 'Sink' }, { value: 'wipe', label: 'Wipe' }, { value: 'blur', label: 'Blur' },
  { value: 'zoom', label: 'Zoom' }, { value: 'grow', label: 'Shrink' }, { value: 'flip', label: 'Flip' },
  { value: 'spin', label: 'Spin' }, { value: 'swivel', label: 'Swivel' }, { value: 'drop', label: 'Drop' }
];

const EMPHASES = [
  { value: 'none', label: 'None' }, { value: 'pulse', label: 'Pulse' },
  { value: 'heartbeat', label: 'Heartbeat' }, { value: 'bounce', label: 'Bounce' },
  { value: 'float', label: 'Float' }, { value: 'wobble', label: 'Wobble' },
  { value: 'tada', label: 'Tada' }, { value: 'glow', label: 'Glow' }, { value: 'shake', label: 'Shake' }
];

export function RibbonAnimations() {
  const block = useSelectedBlock();
  const slide = useCurrentSlide();
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const mutate = useProjectStore((s) => s.mutate);

  if (!block) {
    return <div style={{ padding: 16, color: 'var(--muted)' }}>Select a block to animate. Fine-tuning lives in the Animate tab of the block panel on the right.</div>;
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

  const setExit = (type: string) => {
    ensureTimeline();
    updateBlock(block.id, (b) => {
      if (!b.timing) b.timing = { start: 0 };
      if (type === 'none') { b.timing.animOut = undefined; return; }
      // Exits need an end time to run against; default to the slide duration.
      if (b.timing.end === undefined) b.timing.end = slide.timeline?.duration ?? 10;
      b.timing.animOut = { type: type as AnimType, duration: b.timing.animOut?.duration ?? 0.5, ease: b.timing.animOut?.ease ?? 'power2.in' };
    });
  };

  const setMotion = (preset: string) => {
    ensureTimeline();
    updateBlock(block.id, (b: Block) => {
      if (preset === 'none') { b.motion = undefined; return; }
      const prev = b.motion;
      b.motion = {
        preset: preset as 'line' | 'arc' | 'circle',
        vector: prev?.vector ?? { x: 200, y: 0 },
        start: prev?.start ?? 0,
        duration: prev?.duration ?? 2,
        ease: prev?.ease ?? 'power1.inOut',
        loop: preset === 'circle' ? (prev?.loop ?? true) : prev?.loop
      };
    });
  };

  const currentAnim = timing?.animIn?.type ?? 'none';

  return (
    <div className="flex items-stretch px-2 flex-1 gap-0 h-full overflow-x-auto scrollbar-hide">
      {/* Group: Animation Gallery (entrances) */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="anim-gallery">
            {GALLERY_ITEMS.map((item) => {
              const isActive = currentAnim === item.type;
              return (
                <button
                  key={item.type}
                  onClick={() => setEntrance(item.type)}
                  className={`anim-tile ${isActive ? 'active' : ''}`}
                  title={`Entrance: ${item.label}`}
                >
                  <span className="anim-tile-icon">{item.icon}</span>
                  <span className="anim-tile-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <span className="ribbon-group-title">Entrance</span>
      </div>

      {/* Group: Timing */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="field">
              <span className="field-label">Delay (s)</span>
              <input
                className="input input-number"
                type="number" step="0.1" min="0"
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
            <div className="field">
              <span className="field-label">Duration (s)</span>
              <input
                className="input input-number"
                type="number" step="0.1" min="0.1"
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
          </div>
        </div>
        <span className="ribbon-group-title">Timing</span>
      </div>

      {/* Group: Exit + Emphasis */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="field">
              <span className="field-label">Exit</span>
              <select
                className="input"
                value={timing?.animOut?.type ?? 'none'}
                onChange={(e) => setExit(e.target.value)}
              >
                {EXITS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="field-label">Emphasis</span>
              <select
                className="input"
                title="Looping attention animation, independent of the timeline"
                value={block.emphasis ?? 'none'}
                onChange={(e) => updateBlock(block.id, (b) => { b.emphasis = e.target.value === 'none' ? undefined : (e.target.value as 'pulse'); })}
              >
                {EMPHASES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <span className="ribbon-group-title">Exit · Emphasis</span>
      </div>

      {/* Group: Motion path */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="field">
              <span className="field-label">Path</span>
              <select className="input" value={block.motion?.preset ?? 'none'} onChange={(e) => setMotion(e.target.value)}>
                <option value="none">None</option>
                <option value="line">Line</option>
                <option value="arc">Arc</option>
                <option value="circle">Circle</option>
              </select>
            </div>
            <span className="hint" style={{ maxWidth: 170 }}>
              {block.motion ? 'Drag the orange handle on the canvas to shape it.' : 'Moves the block along a path on the timeline.'}
            </span>
          </div>
        </div>
        <span className="ribbon-group-title">Motion Path</span>
      </div>

      {/* Group: pointer to the deep controls */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <span className="hint" style={{ maxWidth: 190 }}>
            Easing, direction, effect stacks, and previews are in the <b style={{ color: 'var(--text)' }}>Animate tab</b> of the block panel {'→'}
          </span>
        </div>
        <span className="ribbon-group-title">More</span>
      </div>
    </div>
  );
}

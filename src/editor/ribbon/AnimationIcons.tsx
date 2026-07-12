// Gallery tile icons: a filled square inside a ghost frame, animated with a
// CSS preview of the effect. The animation only runs while the tile is
// hovered (.anim-tile:hover) - a wall of 18 looping previews is distracting
// at best and strobing at worst - and CSS transforms honor
// transform-origin: center, which SMIL animateTransform never did (the old
// SVG icons spun and scaled around the top-left corner).
// Keyframes live in styles.css under "animation gallery previews".

function FxIcon({ fx }: { fx: string }) {
  return (
    <span className="fxicon ghost" aria-hidden="true">
      <i className={`fxicon-box fx-${fx}`} />
    </span>
  );
}

export const NoneIcon = () => (
  <span className="fxicon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="4.75" y="4.75" width="14.5" height="14.5" rx="2" opacity="0.4" />
      <line x1="7" y1="17" x2="17" y2="7" opacity="0.7" />
    </svg>
  </span>
);

export const FadeInIcon = () => <FxIcon fx="fade" />;
export const FlyInIcon = () => <FxIcon fx="fly" />;
export const FloatInIcon = () => <FxIcon fx="float" />;
export const WipeIcon = () => <FxIcon fx="wipe" />;
export const ZoomInAnimIcon = () => <FxIcon fx="zoomin" />;
export const ZoomOutAnimIcon = () => <FxIcon fx="zoomout" />;
export const BlurIcon = () => <FxIcon fx="blur" />;
export const SpinInIcon = () => <FxIcon fx="spin" />;
export const FlipIcon = () => <FxIcon fx="flip" />;
export const BounceInIcon = () => <FxIcon fx="bounce" />;
export const PopRotateIcon = () => <FxIcon fx="pop" />;
export const GrowIcon = () => <FxIcon fx="grow" />;
export const StretchHorizontalIcon = () => <FxIcon fx="stretch" />;
export const UnfoldVerticalIcon = () => <FxIcon fx="unfold" />;
export const DropInIcon = () => <FxIcon fx="drop" />;
export const SwivelIcon = () => <FxIcon fx="swivel" />;
export const WhipInIcon = () => <FxIcon fx="whip" />;
export const FlyCornerIcon = () => <FxIcon fx="flycorner" />;
export const RollIcon = () => <FxIcon fx="roll" />;

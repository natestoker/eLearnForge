import React from 'react';

// The SVGs use "currentColor" so they will pick up the text color of the parent container.
// We force them to be w-full h-full to fit their containers without clipping.

export const WhipInIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" height="16" rx="1" width="16" x="4" y="4">
      <animateTransform attributeName="transform" calcMode="spline" dur="1.2s" keySplines="0.2, 0.8, 0.2, 1; 0.4, 0, 0.6, 1; 0, 0, 1, 1" keyTimes="0; 0.15; 0.25; 1" repeatCount="indefinite" type="translate" values="-24 0; 0 0; 0.5 0; 0 0" />
      <animate attributeName="opacity" dur="1.2s" keyTimes="0; 0.1; 0.9; 1" repeatCount="indefinite" values="0; 1; 1; 0" />
    </rect>
  </svg>
);

export const DropInIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect className="opacity-20" fill="none" height="16" rx="2" stroke="currentColor" strokeWidth="2" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" height="12" rx="1" width="12" x="6" y="6">
      <animate attributeName="y" begin="0s" calcMode="spline" dur="1.5s" from="-20" keySplines="0.42 0 0.58 1; 0 0 1 1; 0 0 1 1" keyTimes="0; 0.4; 0.6; 1" repeatCount="indefinite" to="6" values="-20; 6; 6; 6" />
      <animate attributeName="opacity" dur="1.5s" keyTimes="0; 0.2; 0.8; 1" repeatCount="indefinite" values="0; 1; 1; 0" />
    </rect>
  </svg>
);

export const BounceInIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect className="opacity-20" fill="none" height="16" rx="2" stroke="currentColor" strokeWidth="1" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" height="12" rx="1.5" width="12" x="6" y="6">
      <animate attributeName="y" calcMode="spline" dur="1.2s" keySplines="0.42 0 1 1; 0 0 0.58 1; 0.42 0 1 1; 0 0 0.58 1; 0.42 0 1 1" keyTimes="0; 0.4; 0.6; 0.8; 0.9; 1" repeatCount="indefinite" values="-15; 6; 2; 6; 4; 6" />
      <animate attributeName="opacity" dur="1.2s" keyTimes="0; 0.2; 0.4; 0.6; 0.8; 1" repeatCount="indefinite" values="0; 1; 1; 1; 1; 1" />
    </rect>
    <line className="opacity-10" stroke="currentColor" strokeWidth="1" x1="4" x2="20" y1="18" y2="18"></line>
  </svg>
);

export const StretchHorizontalIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="2" width="16" x="4" y="4"></rect>
    <g transformOrigin="center">
      <rect fill="currentColor" height="16" rx="1" width="4" x="10" y="4">
        <animateTransform additive="replace" attributeName="transform" dur="2s" repeatCount="indefinite" type="scale" values="1 1; 4 1; 4 1; 1 1" />
      </rect>
    </g>
  </svg>
);

export const SpinInIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.1" rx="2" stroke="currentColor" strokeWidth="1" width="16" x="4" y="4"></rect>
    <g transformOrigin="center">
      <rect fill="currentColor" height="16" rx="2" width="16" x="4" y="4">
        <animateTransform attributeName="transform" dur="2s" from="0" repeatCount="indefinite" to="360" type="rotate" />
        <animateTransform additive="sum" attributeName="transform" dur="2s" keyTimes="0;0.2;0.8;1" repeatCount="indefinite" type="scale" values="0;1;1;0" />
      </rect>
    </g>
  </svg>
);

export const BlurIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter height="200%" id="blurEffect" width="200%" x="-50%" y="-50%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4">
          <animate attributeName="stdDeviation" dur="3s" keyTimes="0; 0.3; 0.7; 1" repeatCount="indefinite" values="4;0;0;4" />
        </feGaussianBlur>
      </filter>
    </defs>
    <rect fill="none" height="16" opacity="0.2" rx="3" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" filter="url(#blurEffect)" height="10" rx="1.5" width="10" x="7" y="7">
      <animate attributeName="opacity" dur="3s" keyTimes="0; 0.3; 0.7; 1" repeatCount="indefinite" values="0;1;1;0" />
    </rect>
    <rect fill="currentColor" height="4" rx="0.5" width="4" x="10" y="10">
      <animate attributeName="opacity" dur="3s" keyTimes="0; 0.3; 0.7; 1" repeatCount="indefinite" values="0;0.8;0.8;0" />
    </rect>
  </svg>
);

export const GrowIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect className="opacity-20" fill="none" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" height="16" rx="2" width="16" x="4" y="4">
      <animateTransform additive="replace" attributeName="transform" calcMode="spline" dur="2.5s" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" repeatCount="indefinite" transformOrigin="center" type="scale" values="0.4; 1; 0.4" />
      <animate attributeName="opacity" dur="2.5s" repeatCount="indefinite" values="0.5; 1; 0.5" />
    </rect>
  </svg>
);

export const PopRotateIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.1" rx="2" stroke="currentColor" strokeWidth="1" width="16" x="4" y="4"></rect>
    <g transformOrigin="center">
      <rect fill="currentColor" height="10" rx="1.5" width="10" x="7" y="7">
        <animateTransform attributeName="transform" calcMode="spline" dur="2s" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" repeatCount="indefinite" type="scale" values="0.8; 1.1; 1" />
        <animateTransform additive="sum" attributeName="transform" calcMode="spline" dur="2s" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" repeatCount="indefinite" type="rotate" values="0; 15; 0" />
      </rect>
    </g>
  </svg>
);

export const FlipIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <g>
      <rect fill="currentColor" height="12" rx="1.5" width="12" x="6" y="6">
        <animateTransform attributeName="transform" type="scale" values="1 1; 0 1; 1 1" dur="2s" repeatCount="indefinite" transformOrigin="center" />
      </rect>
      <rect fill="black" height="8" opacity="0.1" width="2" x="8" y="8"></rect>
    </g>
  </svg>
);

export const SwivelIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1" width="16" x="4" y="4"></rect>
    <g transformOrigin="4 12">
      <rect fill="currentColor" fillOpacity="0.9" height="16" rx="1" width="16" x="4" y="4">
        <animateTransform attributeName="transform" calcMode="spline" dur="2s" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" repeatCount="indefinite" type="scale" values="1 1; 0.1 1; 1 1" />
      </rect>
    </g>
  </svg>
);

export const UnfoldVerticalIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect className="opacity-20" fill="none" height="16" rx="2" stroke="currentColor" strokeWidth="2" width="16" x="4" y="4"></rect>
    <g transform="translate(4, 4)">
      <rect fill="currentColor" height="16" rx="2" width="16">
        <animateTransform additive="replace" attributeName="transform" begin="0s" dur="1.5s" from="1 0" keyTimes="0; 0.5; 1" repeatCount="indefinite" to="1 1" type="scale" values="1 0; 1 1; 1 1" transformOrigin="center" />
      </rect>
    </g>
  </svg>
);

export const NoneIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.35" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <line opacity="0.6" stroke="currentColor" strokeWidth="1.5" x1="6.5" x2="17.5" y1="17.5" y2="6.5"></line>
  </svg>
);

export const FadeInIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" height="12" rx="1" width="12" x="6" y="6">
      <animate attributeName="opacity" calcMode="spline" dur="1.6s" keySplines="0.4 0 0.2 1; 0 0 1 1" keyTimes="0; 0.55; 1" repeatCount="indefinite" values="0; 1; 1" />
    </rect>
  </svg>
);

export const FlyInIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" height="12" rx="1" width="12" x="6" y="6">
      <animateTransform attributeName="transform" calcMode="spline" dur="1.5s" keySplines="0.2 0.8 0.2 1; 0 0 1 1" keyTimes="0; 0.5; 1" repeatCount="indefinite" type="translate" values="-22 22; 0 0; 0 0" />
      <animate attributeName="opacity" dur="1.5s" keyTimes="0; 0.35; 0.9; 1" repeatCount="indefinite" values="0; 1; 1; 0" />
    </rect>
  </svg>
);

export const FloatInIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" height="12" rx="1" width="12" x="6" y="6">
      <animateTransform attributeName="transform" calcMode="spline" dur="1.6s" keySplines="0.2 0.8 0.2 1; 0 0 1 1" keyTimes="0; 0.5; 1" repeatCount="indefinite" type="translate" values="0 10; 0 0; 0 0" />
      <animate attributeName="opacity" dur="1.6s" keyTimes="0; 0.4; 0.9; 1" repeatCount="indefinite" values="0; 1; 1; 0" />
    </rect>
  </svg>
);

export const WipeIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <rect fill="currentColor" height="12" rx="1" width="12" x="6" y="6">
      <animate attributeName="width" calcMode="spline" dur="1.6s" keySplines="0.4 0 0.2 1; 0 0 1 1" keyTimes="0; 0.55; 1" repeatCount="indefinite" values="0; 12; 12" />
    </rect>
  </svg>
);

export const ZoomInAnimIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <g transformOrigin="12 12">
      <rect fill="currentColor" height="12" rx="1" width="12" x="6" y="6">
        <animateTransform attributeName="transform" calcMode="spline" dur="1.6s" keySplines="0.2 0.8 0.2 1; 0 0 1 1" keyTimes="0; 0.5; 1" repeatCount="indefinite" type="scale" values="0.2 0.2; 1 1; 1 1" transformOrigin="center" />
        <animate attributeName="opacity" dur="1.6s" keyTimes="0; 0.35; 0.9; 1" repeatCount="indefinite" values="0; 1; 1; 0" />
      </rect>
    </g>
  </svg>
);

export const ZoomOutAnimIcon = () => (
  <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect fill="none" height="16" opacity="0.2" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="4" y="4"></rect>
    <g transformOrigin="12 12">
      <rect fill="currentColor" height="12" rx="1" width="12" x="6" y="6">
        <animateTransform attributeName="transform" calcMode="spline" dur="1.6s" keySplines="0.2 0.8 0.2 1; 0 0 1 1" keyTimes="0; 0.5; 1" repeatCount="indefinite" type="scale" values="1.6 1.6; 1 1; 1 1" transformOrigin="center" />
        <animate attributeName="opacity" dur="1.6s" keyTimes="0; 0.35; 0.9; 1" repeatCount="indefinite" values="0; 1; 1; 0" />
      </rect>
    </g>
  </svg>
);


import React from 'react';

// FIX: Replaced JSX syntax with React.createElement to resolve TypeScript errors in a .ts file.
// Using JSX in a .ts file (instead of .tsx) causes parsing errors.
export const PlayIcon = () => (
  React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "32", height: "32", viewBox: "0 0 24 24", fill: "currentColor" },
    React.createElement('path', { d: "M8 5v14l11-7z" })
  )
);

export const PauseIcon = () => (
  React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "32", height: "32", viewBox: "0 0 24 24", fill: "currentColor" },
    React.createElement('path', { d: "M6 19h4V5H6v14zm8-14v14h4V5h-4z" })
  )
);

export const StopIcon = () => (
    React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "currentColor" },
        React.createElement('path', { d: "M6 6h12v12H6z" })
    )
);

export const ExportIcon = () => (
    React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap:"round", strokeLinejoin:"round" },
      React.createElement('path', { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
      React.createElement('polyline', { points: "7 10 12 15 17 10" }),
      React.createElement('line', { x1: "12", y1: "15", x2: "12", y2: "3" })
    )
);

export const LoadingIcon = ({ size = 48 }: { size?: number }) => (
    React.createElement('svg', {
        className: 'animate-spin text-yellow-500',
        style: { height: `${size}px`, width: `${size}px` },
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 24 24"
    },
        React.createElement('circle', { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
        React.createElement('path', { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
    )
);

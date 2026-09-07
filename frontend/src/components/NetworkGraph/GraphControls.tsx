/**
 * GraphControls — zoom / fit / reset / screenshot buttons.
 */
import { ZoomIn, ZoomOut, Maximize, Camera, RotateCcw } from "lucide-react";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onScreenshot: () => void;
}

export default function GraphControls({ onZoomIn, onZoomOut, onFit, onReset, onScreenshot }: Props) {
  const buttons = [
    { label: "Zoom in", icon: ZoomIn, onClick: onZoomIn },
    { label: "Zoom out", icon: ZoomOut, onClick: onZoomOut },
    { label: "Fit all", icon: Maximize, onClick: onFit },
    { label: "Screenshot", icon: Camera, onClick: onScreenshot },
    { label: "Reset view", icon: RotateCcw, onClick: onReset },
  ];

  return (
    <div className="ml-auto flex items-center gap-1">
      {buttons.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          className="rounded-lg border border-border p-1.5 text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          aria-label={label}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

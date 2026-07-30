"use client";

import type { CSSProperties } from "react";
import { useId } from "react";
import { cn } from "./_adapter";

export interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  showFill?: boolean;
  fillOpacity?: number;
}

/**
 * Compact trend line. Solid stroke + fill so demo sparklines stay readable
 * even when embedded in KPI tiles (tool-ui dash animation is optional polish).
 */
export function Sparkline({
  data,
  color = "currentColor",
  width = 120,
  height = 36,
  className,
  style,
  showFill = true,
  fillOpacity = 0.14,
}: SparklineProps) {
  const gradientId = useId().replace(/:/g, "");

  if (data.length < 2) {
    return null;
  }

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  // Always leave a little headroom so flat series still draws a baseline.
  const range = maxVal - minVal || Math.max(maxVal, 1);
  const padY = 2;
  const padX = 1;

  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;

  const linePoints = data.map((value, index) => {
    const x = padX + (index / (data.length - 1)) * usableWidth;
    const y =
      padY + usableHeight - ((value - minVal) / range) * usableHeight;
    return { x, y };
  });

  const linePointsString = linePoints.map((p) => `${p.x},${p.y}`).join(" ");
  const last = linePoints[linePoints.length - 1]!;
  const first = linePoints[0]!;

  const areaPointsString = [
    `${first.x},${height - padY}`,
    ...linePoints.map((p) => `${p.x},${p.y}`),
    `${last.x},${height - padY}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={cn("h-full w-full shrink-0", className)}
      style={style}
      preserveAspectRatio="none"
    >
      {showFill ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={areaPointsString} fill={`url(#${gradientId})`} />
        </>
      ) : null}

      {/* Soft under-stroke for contrast on white cards */}
      <polyline
        points={linePointsString}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeOpacity={0.12}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Primary trend */}
      <polyline
        points={linePointsString}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeOpacity={0.92}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Endpoint marker — last day of series */}
      <circle
        cx={last.x}
        cy={last.y}
        r={2.25}
        fill={color}
        fillOpacity={0.95}
      />
    </svg>
  );
}

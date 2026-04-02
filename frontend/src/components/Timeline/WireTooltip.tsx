/**
 * WireTooltip — 连线浮动标签
 *
 * 在画布上显示连线传输的命令片段
 */

import { useMemo } from 'react';
import type { SignalEvent } from '../../core/simulation/SignalEventRecorder';
import './Timeline.css';

export interface WireTooltipProps {
  /** 连线 ID */
  wireId: string;
  /** 连线上的事件 */
  events: SignalEvent[];
  /** 位置（画布坐标） */
  position: { x: number; y: number };
  /** 是否可见 */
  visible: boolean;
  /** 最大显示事件数 */
  maxEvents?: number;
}

export function WireTooltip({
  wireId,
  events,
  position,
  visible,
  maxEvents = 3,
}: WireTooltipProps) {
  /** 获取最近的事件 */
  const recentEvents = useMemo(() => {
    return events
      .filter(e => e.wireId === wireId)
      .slice(-maxEvents);
  }, [events, wireId, maxEvents]);

  /** 获取最近事件的协议类型 */
  const wireType = useMemo(() => {
    if (recentEvents.length === 0) return 'gpio';
    return recentEvents[recentEvents.length - 1].wireType;
  }, [recentEvents]);

  if (!visible || recentEvents.length === 0) {
    return null;
  }

  return (
    <div
      className={`wire-tooltip ${visible ? '' : 'hidden'}`}
      style={{
        left: position.x,
        top: position.y - 40,
        transform: 'translateX(-50%)',
      }}
    >
      <span className={`wire-tooltip-type ${wireType}`}>
        {wireType.toUpperCase()}
      </span>
      <span>
        {recentEvents[recentEvents.length - 1].decodedCommand}
      </span>
    </div>
  );
}

/**
 * 连线高亮 SVG 路径
 */
export interface WireHighlightProps {
  /** 连线路径点 */
  points: Array<{ x: number; y: number }>;
  /** 是否高亮 */
  highlighted: boolean;
  /** 协议类型 */
  wireType: string;
  /** 当前传输的数据（用于动画效果） */
  currentData?: string;
}

export function WireHighlight({
  points,
  highlighted,
  wireType,
  currentData,
}: WireHighlightProps) {
  if (!highlighted || points.length < 2) {
    return null;
  }

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const color = wireType === 'gpio' ? '#4ade80' :
                wireType === 'uart' ? '#facc15' :
                wireType === 'i2c' ? '#c084fc' :
                wireType === 'spi' ? '#f97316' : '#4fc3f7';

  return (
    <g className="wire-highlight-group">
      {/* 发光效果 */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={6}
        opacity={0.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 主线 */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 数据流动画点 */}
      {currentData && (
        <circle r={4} fill={color}>
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={pathD}
          />
        </circle>
      )}
    </g>
  );
}

export default WireTooltip;

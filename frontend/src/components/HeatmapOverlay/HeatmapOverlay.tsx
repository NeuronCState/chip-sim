/**
 * 热力图叠加层 HeatmapOverlay
 * 在电路上叠加显示仿真结果（电压/电流分布）
 * 节点电压用颜色梯度表示，电流用连线粗细/亮度表示
 * 动态数值标签悬浮在节点上
 */

import { useEffect, useRef, useMemo } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { voltageToColor, currentToBrightness, parseColor, rgba } from '../../core/ThemeSystem';
import type { ViewTransform } from '../../types/circuit';
import './HeatmapOverlay.css';

/** 热力图配置 */
interface HeatmapConfig {
  /** 是否显示热力图 */
  visible: boolean;
  /** 电压颜色范围 */
  voltageRange: { min: number; max: number };
  /** 最大电流（用于亮度归一化） */
  maxCurrent: number;
  /** 节点标签显示模式 */
  labelMode: 'voltage' | 'current' | 'both' | 'none';
  /** 叠加透明度 */
  overlayOpacity: number;
  /** 是否启用流动动画 */
  flowAnimation: boolean;
}

const DEFAULT_CONFIG: HeatmapConfig = {
  visible: true,
  voltageRange: { min: 0, max: 5 },
  maxCurrent: 0.1,
  labelMode: 'voltage',
  overlayOpacity: 0.45,
  flowAnimation: true,
};

interface HeatmapOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  transform: ViewTransform;
  config?: Partial<HeatmapConfig>;
}

export function HeatmapOverlay({
  canvasWidth,
  canvasHeight,
  transform,
  config: userConfig,
}: HeatmapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);

  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);
  const nodes = useCircuitStore((s) => s.nodes);
  const simulationResult = useCircuitStore((s) => s.simulationResult);
  const isSimulating = useCircuitStore((s) => s.isSimulating);

  // 流动动画偏移
  const flowOffsetRef = useRef(0);

  useEffect(() => {
    if (!config.visible || !simulationResult) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    const flowSpeed = 0.3; // 流动速度

    const render = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      if (!config.visible) return;

      // 流动偏移
      if (config.flowAnimation) {
        flowOffsetRef.current = (flowOffsetRef.current + flowSpeed) % 20;
      }

      const { scale, offsetX, offsetY } = transform;
      const opacity = config.overlayOpacity;

      // ===== 绘制节点热力图 =====
      for (const node of nodes) {
        const voltage = node.voltage ?? 0;
        const sx = node.position.x * scale + offsetX;
        const sy = node.position.y * scale + offsetY;
        const radius = 12 * scale;

        // 电压颜色
        const color = voltageToColor(voltage, config.voltageRange.min, config.voltageRange.max);

        // 热力图圆（带渐变）
        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
        const [r, g, b] = parseColor(color);
        gradient.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
        gradient.addColorStop(0.6, `rgba(${r},${g},${b},${opacity * 0.5})`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();

        // 数值标签
        if (config.labelMode !== 'none' && scale > 0.4) {
          ctx.save();
          ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (config.labelMode === 'voltage' || config.labelMode === 'both') {
            // 背景气泡
            const label = `${voltage.toFixed(2)}V`;
            const metrics = ctx.measureText(label);
            const lw = metrics.width + 6;
            const lh = 14 * scale;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.beginPath();
            ctx.roundRect(sx - lw / 2, sy - radius - lh - 2, lw, lh, 3);
            ctx.fill();

            // 文字
            ctx.fillStyle = color;
            ctx.fillText(label, sx, sy - radius - lh / 2 - 2);
          }

          ctx.restore();
        }
      }

      // ===== 绘制连线电流可视化 =====
      const allCurrents = wires.map(w => Math.abs(w.current ?? 0));
      const maxI = Math.max(...allCurrents, 0.001);

      for (const wire of wires) {
        if (wire.points.length < 2) continue;
        const current = wire.current ?? 0;
        const brightness = currentToBrightness(current, maxI);

        // 连线亮度层
        ctx.save();
        ctx.strokeStyle = rgba(
          current > 0 ? '#00ff88' : '#ff4488',
          brightness * opacity
        );
        ctx.lineWidth = Math.max(1.5, Math.min(6, Math.abs(current) / maxI * 5)) * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < wire.points.length; i++) {
          const pt = wire.points[i];
          const sx = pt.x * scale + offsetX;
          const sy = pt.y * scale + offsetY;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // 流动粒子动画
        if (config.flowAnimation && Math.abs(current) > 0.001) {
          const dir = current > 0 ? 1 : -1;
          const speed = Math.min(3, Math.abs(current) / maxI * 3);
          drawFlowParticles(ctx, wire.points, transform, dir, speed, flowOffsetRef.current, opacity);
        }

        ctx.restore();
      }

      // ===== 绘制元件状态指示 =====
      for (const comp of components) {
        const sx = comp.position.x * scale + offsetX;
        const sy = comp.position.y * scale + offsetY;

        // 仿真运行时的脉冲效果
        if (isSimulating) {
          const pulsePhase = (Date.now() % 1000) / 1000;
          const pulseAlpha = Math.sin(pulsePhase * Math.PI * 2) * 0.3 + 0.3;
          ctx.save();
          ctx.strokeStyle = rgba('#4488ff', pulseAlpha * opacity);
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(
            sx - 34 * scale, sy - 24 * scale,
            68 * scale, 48 * scale
          );
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [
    config, components, wires, nodes,
    simulationResult, isSimulating,
    canvasWidth, canvasHeight, transform,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="heatmap-overlay-canvas"
      width={canvasWidth}
      height={canvasHeight}
    />
  );
}

/** 绘制连线上流动的粒子 */
function drawFlowParticles(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  transform: ViewTransform,
  direction: number,
  speed: number,
  flowOffset: number,
  opacity: number,
): void {
  if (points.length < 2) return;

  const { scale, offsetX, offsetY } = transform;
  const particleSpacing = 15;
  const particleSize = 2.5 * scale;

  // 计算连线总长度
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    segLens.push(len);
    totalLen += len;
  }
  if (totalLen < 1) return;

  // 沿连线放置粒子
  const numParticles = Math.max(1, Math.ceil(totalLen / particleSpacing));
  for (let i = 0; i < numParticles; i++) {
    let dist = ((i * particleSpacing + flowOffset * speed * direction) % totalLen + totalLen) % totalLen;

    // 找到所在段
    for (let s = 0; s < segLens.length; s++) {
      if (dist <= segLens[s]) {
        const t = dist / segLens[s];
        const px = points[s].x + (points[s + 1].x - points[s].x) * t;
        const py = points[s].y + (points[s + 1].y - points[s].y) * t;
        const sx = px * scale + offsetX;
        const sy = py * scale + offsetY;

        ctx.fillStyle = `rgba(0, 255, 170, ${0.8 * opacity})`;
        ctx.beginPath();
        ctx.arc(sx, sy, particleSize, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      dist -= segLens[s];
    }
  }
}

/** 热力图颜色图例 */
export function HeatmapLegend({ visible = true }: { visible?: boolean }) {
  if (!visible) return null;

  return (
    <div className="heatmap-legend">
      <div className="heatmap-legend-title">电压 (V)</div>
      <div className="heatmap-legend-bar" />
      <div className="heatmap-legend-labels">
        <span>0V</span>
        <span>2.5V</span>
        <span>5V</span>
      </div>
    </div>
  );
}

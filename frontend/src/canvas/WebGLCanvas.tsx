/**
 * 电路画布 — Canvas 2D + 可视化动画引擎
 * 功能：芯片 + 元件 + 引脚 + 连线 + 拖拽 + 自动吸附连接
 * 动画：LED亮度/PWM、电流动画、引脚电平颜色、元件响应、悬停高亮+tooltip
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { SelectedElement } from './interaction';
import { getGlobalEngine, type PinBehaviorConfig } from '../core/simulation';
import {
  type Pin, type CanvasComponent, type Wire, type ViewTransform, type Props,
  GRID, CHIP_PINS_COUNT, DEFAULT_SIM_STATE_, getDefaultPins, COMPONENT_TEMPLATES,
  CIRCUIT_TEMPLATES,
  getComponentName, pinLevelColor, pinWorld, getPinSide, lineHitsRect,
  calculateWirePath, simBtnStyle, debounce, saveState, loadState,
} from './webgl-helpers';
import './WebGLCanvas.css';

export { CIRCUIT_TEMPLATES } from './webgl-helpers';
export type { CircuitTemplate } from './webgl-helpers';

export function WebGLCanvas({ chipFamily, chipModel, onSelect, loadTemplateId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tfRef = useRef<ViewTransform>({ scale: 1, ox: 0, oy: 0 });
  const compsRef = useRef<CanvasComponent[]>([]);
  const wiresRef = useRef<Wire[]>([]);
  const chipPinsRef = useRef<Pin[]>([]);
  /** 动画时间累加器 */
  const animTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  /** 悬停元件信息 */
  const hoverCompRef = useRef<{ id: string; name: string; type: string; x: number; y: number } | null>(null);
  const [, forceUpdate] = useState(0);

  // === 仿真引擎 ===
  const engineRef = useRef(getGlobalEngine());
  const [simRunning, setSimRunning] = useState(false);
  const [simPaused, setSimPaused] = useState(false);

  const [drag, setDrag] = useState({
    mode: 'none' as 'none' | 'pan' | 'move' | 'wire',
    sx: 0, sy: 0, sox: 0, soy: 0,
    tid: undefined as string | undefined,
    wireFrom: undefined as { componentId: string; pinId: string; x: number; y: number } | undefined,
  });
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: { type: string; id: string } } | null>(null);
  const [hoverPin, setHoverPin] = useState<{ x: number; y: number; name: string } | null>(null);
  const [hoverComp, setHoverComp] = useState<{ x: number; y: number; name: string; type: string; details: string } | null>(null);

  // ========== 仿真控制 ==========
  const handleSimStart = useCallback(() => {
    engineRef.current.start();
    setSimRunning(true);
    setSimPaused(false);
  }, []);

  const handleSimPause = useCallback(() => {
    engineRef.current.pause();
    setSimPaused(true);
  }, []);

  const handleSimStep = useCallback(() => {
    engineRef.current.step();
  }, []);

  const handleSimReset = useCallback(() => {
    engineRef.current.reset();
    setSimRunning(false);
    setSimPaused(false);
    forceUpdate(n => n + 1);
  }, []);

  // 持久化
  const debouncedSaveRef = useRef(debounce(() => {
    saveState(chipModel, compsRef.current, wiresRef.current, chipPinsRef.current);
  }, 500));
  useEffect(() => { debouncedSaveRef.current = debounce(() => {
    saveState(chipModel, compsRef.current, wiresRef.current, chipPinsRef.current);
  }, 500); }, [chipModel]);
  const handleSave = useCallback(() => {
    saveState(chipModel, compsRef.current, wiresRef.current, chipPinsRef.current);
  }, [chipModel]);

  /** 标记引脚连接状态 */
  const markPinConnected = (compId: string, pinId: string, connected: boolean) => {
    if (compId === '__chip__') {
      chipPinsRef.current = chipPinsRef.current.map(p => p.id === pinId ? { ...p, connected } : p);
    } else {
      compsRef.current = compsRef.current.map(c =>
        c.id === compId ? { ...c, pins: c.pins.map(p => p.id === pinId ? { ...p, connected } : p) } : c
      );
    }
  };

  // 初始化芯片引脚
  useEffect(() => {
    const pinCount = CHIP_PINS_COUNT[chipFamily] || 40;
        // 从芯片JSON加载真实引脚数据
    (async () => {
      const dir = chipFamily.toLowerCase();
      try {
        const res = await fetch(`/chips/${dir}/${chipModel}.json`);
        if (!res.ok) throw new Error('not found');
        const chipData = await res.json();
        const realPins = chipData.pins || [];
        const halfCount = Math.ceil(realPins.length / 2);
        const chipH = realPins.length <= 40 ? 200 : realPins.length <= 48 ? 160 : 140;

        chipPinsRef.current = realPins.map((p: { id: string; functions: string[] }, i: number) => {
          const side: 'left' | 'right' = i < halfCount ? 'left' : 'right';
          const idx = side === 'left' ? i : i - halfCount;
          const py = -chipH / 2 + 10 + idx * ((chipH - 20) / Math.max(halfCount - 1, 1));
          return {
            id: p.id, name: p.functions?.[0] || p.id, side, index: idx,
            x: side === 'left' ? -74 : 74, y: py,
            connected: false, level: 'floating' as const,
          };
        });
      } catch {
        // fallback
        const pinCount = 48, halfPins = pinCount / 2, chipH = 160;
        const fallback: Pin[] = [];
        for (let i = 0; i < halfPins; i++) {
          const py = -chipH / 2 + 10 + i * ((chipH - 20) / Math.max(halfPins - 1, 1));
          fallback.push({ id: `L${i}`, name: `P${i}`, side: 'left', index: i, x: -74, y: py, connected: false, level: 'floating' });
          fallback.push({ id: `R${i}`, name: `P${i + halfPins}`, side: 'right', index: i, x: 74, y: py, connected: false, level: 'floating' });
        }
        chipPinsRef.current = fallback;
      }
      // 尝试从 localStorage 恢复之前的状态
      const saved = loadState(chipModel);
      if (saved) {
        compsRef.current = saved.components;
        wiresRef.current = saved.wires;
        // 恢复引脚连接状态
        const pinConn = new Map<string, Set<string>>();
        for (const w of saved.wires) {
          if (!pinConn.has(w.from.componentId)) pinConn.set(w.from.componentId, new Set());
          if (!pinConn.has(w.to.componentId)) pinConn.set(w.to.componentId, new Set());
          pinConn.get(w.from.componentId)!.add(w.from.pinId);
          pinConn.get(w.to.componentId)!.add(w.to.pinId);
        }
        chipPinsRef.current = chipPinsRef.current.map(p => ({
          ...p, connected: pinConn.has('__chip__') && pinConn.get('__chip__')!.has(p.id),
        }));
        for (const c of compsRef.current) {
          if (pinConn.has(c.id)) {
            c.pins = c.pins.map(p => ({ ...p, connected: pinConn.get(c.id)!.has(p.id) }));
          }
        }
      } else {
        compsRef.current = [];
        wiresRef.current = [];
      }
      forceUpdate(n => n + 1);
    })();
  }, [chipFamily, chipModel]);

  // ========== 加载电路模板 ==========
  useEffect(() => {
    if (!loadTemplateId || loadTemplateId === '__clear__') {
      // 清空画布
      compsRef.current = [];
      wiresRef.current = [];
      chipPinsRef.current = chipPinsRef.current.map(p => ({ ...p, connected: false }));
      forceUpdate(n => n + 1);
      return;
    }
    const tpl = CIRCUIT_TEMPLATES.find(t => t.id === loadTemplateId);
    if (!tpl) return;

    const pins = chipPinsRef.current;

    /** 将模板中的逻辑引脚名映射到实际芯片引脚 */
    const mapChipPin = (logicalName: string): Pin | null => {
      // 优先精确匹配：如果引脚名直接存在于芯片上（如 PA0, VDD, VSS）
      const exactMatch = pins.find(p => p.id === logicalName);
      if (exactMatch) return exactMatch;

      // 模糊匹配：忽略大小写
      const fuzzyMatch = pins.find(p => p.id.toLowerCase() === logicalName.toLowerCase());
      if (fuzzyMatch) return fuzzyMatch;

      // 通用名称映射
      const usedPinIds = new Set<string>();
      for (const w of wiresRef.current) {
        if (w.from.componentId === '__chip__') usedPinIds.add(w.from.pinId);
        if (w.to.componentId === '__chip__') usedPinIds.add(w.to.pinId);
      }
      const availablePins = pins.filter(p => !usedPinIds.has(p.id));

      switch (logicalName) {
        case 'gpio': case 'gpio1': return availablePins.find(p => p.id.startsWith('PA')) || availablePins[0] || null;
        case 'gpio2': return availablePins.find(p => p.id.startsWith('PB')) || availablePins[0] || null;
        case 'vcc': case 'VDD': return pins.find(p => p.id === 'VDD') || availablePins[0] || null;
        case 'gnd': case 'VSS': return pins.find(p => p.id === 'VSS') || availablePins[availablePins.length - 1] || null;
        case 'tx': return pins.find(p => p.id === 'PA2') || availablePins[0] || null;
        case 'rx': return pins.find(p => p.id === 'PA3') || availablePins[1] || null;
        case 'pwm': return pins.find(p => p.id === 'PB8') || availablePins[0] || null;
        case 'adc': return pins.find(p => p.id === 'PA4') || availablePins[0] || null;
        default: return availablePins[0] || null;
      }
    };

    // 清空画布
    compsRef.current = [];
    wiresRef.current = [];
    chipPinsRef.current = pins.map(p => ({ ...p, connected: false }));

    const compMap: Record<string, string> = {}; // name → id

    // 放置元件
    for (const tc of tpl.components) {
      const compTpl = COMPONENT_TEMPLATES[tc.type];
      if (!compTpl) continue;

      const compId = `c${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newComp: CanvasComponent = {
        id: compId,
        type: tc.type,
        name: tc.name,
        x: tc.offsetX,
        y: tc.offsetY,
        w: compTpl.w,
        h: compTpl.h,
        rotation: 0,
        selected: false,
        pins: compTpl.pins.map(p => ({
          id: p.id,
          name: p.name,
          offsetX: p.ox,
          offsetY: p.oy,
          connected: false,
          level: 'floating' as const,
        })),
        simState: { ...DEFAULT_SIM_STATE_ },
      };
      compsRef.current.push(newComp);
      compMap[tc.name] = compId;
    }

    // 创建连线
    for (const tw of tpl.wires) {
      let fromCompId: string, fromPinId: string;
      let toCompId: string, toPinId: string;

      if (tw.from.comp === '__chip__') {
        const chipPin = mapChipPin(tw.from.pin);
        if (!chipPin) continue;
        fromCompId = '__chip__';
        fromPinId = chipPin.id;
      } else {
        const cId = compMap[tw.from.comp];
        if (!cId) continue;
        fromCompId = cId;
        fromPinId = tw.from.pin;
      }

      if (tw.to.comp === '__chip__') {
        const chipPin = mapChipPin(tw.to.pin);
        if (!chipPin) continue;
        toCompId = '__chip__';
        toPinId = chipPin.id;
      } else {
        const cId = compMap[tw.to.comp];
        if (!cId) continue;
        toCompId = cId;
        toPinId = tw.to.pin;
      }

      const wire: Wire = {
        id: `w${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        from: { componentId: fromCompId, pinId: fromPinId },
        to: { componentId: toCompId, pinId: toPinId },
        selected: false,
        current: 0,
      };
      wiresRef.current.push(wire);
      markPinConnected(fromCompId, fromPinId, true);
      markPinConnected(toCompId, toPinId, true);
    }

    forceUpdate(n => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTemplateId]);

  // ========== 渲染 ==========
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    let running = true;
    const draw = (now?: number) => {
      if (!running) return;

      // 计算帧间隔，更新动画时间
      const dt = lastFrameTimeRef.current > 0 && now ? (now - lastFrameTimeRef.current) / 1000 : 0.016;
      lastFrameTimeRef.current = now || 0;
      animTimeRef.current += dt;

      const dpr = window.devicePixelRatio || 1;
      const W = cvs.clientWidth, H = cvs.clientHeight;
      if (W < 10 || H < 10) { rafRef.current = requestAnimationFrame(draw); return; }
      cvs.width = W * dpr; cvs.height = H * dpr;
      ctx.save(); ctx.scale(dpr, dpr);

      const T = tfRef.current;
      const C = compsRef.current;
      const Ws = wiresRef.current;
      const pins = chipPinsRef.current;
      const animT = animTimeRef.current;

      // 背景+网格
      ctx.fillStyle = '#1a2d36'; ctx.fillRect(0, 0, W, H);
      const gs = GRID * T.scale;
      ctx.strokeStyle = '#243d4d'; ctx.lineWidth = 0.5; ctx.beginPath();
      for (let x = T.ox % gs; x < W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = T.oy % gs; y < H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      ctx.save();
      ctx.translate(W / 2 + T.ox, H / 2 + T.oy);
      ctx.scale(T.scale, T.scale);

      // 芯片
      const chipW = 120, chipH = pins.length <= 40 ? 200 : pins.length <= 48 ? 160 : 140;
      ctx.fillStyle = '#2a4a5a'; ctx.strokeStyle = '#4a7a8a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-chipW / 2, -chipH / 2, chipW, chipH, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(chipModel, 0, 0);

      // 芯片引脚（带电平颜色 + 未接引脚标红）
      for (const pin of pins) {
        const isUnconnected = !pin.connected;
        const pColor = isUnconnected ? '#ff4444' : pinLevelColor(pin.level);
        ctx.fillStyle = isUnconnected ? '#ff4444cc' : (pin.connected ? pColor : (pin.level === 'floating' ? '#f1c40f88' : pColor + '88'));
        ctx.fillRect(pin.x - 3, pin.y - 2, pin.side === 'left' ? -14 : 14, 4);

        // 未连接引脚：红色虚线圆圈
        if (isUnconnected) {
          ctx.save();
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(pin.x + (pin.side === 'left' ? -7 : 7), pin.y, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // 引脚名
        ctx.fillStyle = isUnconnected ? '#ff8888' : '#8ab0c4'; ctx.font = '8px monospace';
        ctx.textAlign = pin.side === 'left' ? 'right' : 'left';
        ctx.fillText(pin.name, pin.x + (pin.side === 'left' ? -18 : 18), pin.y + 3);

        // 高电平引脚发光效果
        if (pin.level === 'high' && pin.connected) {
          ctx.save();
          ctx.globalAlpha = 0.25 + 0.1 * Math.sin(animT * 3);
          ctx.shadowColor = '#2ecc71';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#2ecc71';
          ctx.beginPath();
          ctx.arc(pin.x + (pin.side === 'left' ? -7 : 7), pin.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 连线（带动画流动小点）— 智能正交走线避让元件
      for (const w of Ws) {
        const fromComp = w.from.componentId === '__chip__' ? null : C.find(c => c.id === w.from.componentId);
        const toComp = w.to.componentId === '__chip__' ? null : C.find(c => c.id === w.to.componentId);
        const fromPinRaw = w.from.componentId === '__chip__' ? pins.find(p => p.id === w.from.pinId) : fromComp?.pins.find(p => p.id === w.from.pinId);
        const toPinRaw = w.to.componentId === '__chip__' ? pins.find(p => p.id === w.to.pinId) : toComp?.pins.find(p => p.id === w.to.pinId);
        if (!fromPinRaw || !toPinRaw) continue;

        const fromPos = w.from.componentId === '__chip__' ? fromPinRaw as Pin : pinWorld(fromComp!, fromPinRaw as CanvasComponent['pins'][0]);
        const toPos = w.to.componentId === '__chip__' ? toPinRaw as Pin : pinWorld(toComp!, toPinRaw as CanvasComponent['pins'][0]);
        if (!fromPos || !toPos) continue;

        // 推断引脚方向
        const fromDir = w.from.componentId === '__chip__'
          ? (fromPinRaw as Pin).side
          : getPinSide(fromPinRaw as CanvasComponent['pins'][0]);
        const toDir = w.to.componentId === '__chip__'
          ? (toPinRaw as Pin).side
          : getPinSide(toPinRaw as CanvasComponent['pins'][0]);

        // 智能正交走线
        const waypoints = calculateWirePath(
          { x: fromPos.x, y: fromPos.y }, fromDir,
          fromComp ? { x: fromComp.x, y: fromComp.y, w: fromComp.w, h: fromComp.h } : null,
          { x: toPos.x, y: toPos.y }, toDir,
          toComp ? { x: toComp.x, y: toComp.y, w: toComp.w, h: toComp.h } : null,
          C, w.from.componentId, w.to.componentId,
        );

        // 绘制连线路径
        ctx.strokeStyle = w.selected ? '#58cebe' : '#4ecdc4';
        ctx.lineWidth = w.selected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
          ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        ctx.stroke();

        // 将 waypoints 转为 segments 用于电流动画
        const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
        for (let i = 0; i < waypoints.length - 1; i++) {
          segments.push({
            x1: waypoints[i].x, y1: waypoints[i].y,
            x2: waypoints[i + 1].x, y2: waypoints[i + 1].y,
          });
        }

        // === 电流流动动画（小点沿连线移动）===
        if (Math.abs(w.current) > 0.001) {
          let totalLen = 0;
          const segLens = segments.map(s => {
            const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
            totalLen += l;
            return l;
          });

          if (totalLen > 0) {
            const dotSpacing = 18;
            const numDots = Math.max(1, Math.ceil(totalLen / dotSpacing));
            const flowSpeed = Math.sign(w.current) * Math.min(Math.abs(w.current) * 30, 80);
            const flowOffset = (animT * flowSpeed) % dotSpacing;

            for (let d = 0; d < numDots; d++) {
              let dist = ((d * dotSpacing + flowOffset) % totalLen + totalLen) % totalLen;
              let accLen = 0;
              for (let s = 0; s < segments.length; s++) {
                if (dist <= accLen + segLens[s]) {
                  const t = (dist - accLen) / segLens[s];
                  const px = segments[s].x1 + (segments[s].x2 - segments[s].x1) * t;
                  const py = segments[s].y1 + (segments[s].y2 - segments[s].y1) * t;
                  const alpha = 0.6 + 0.4 * Math.sin(animT * 5 + d * 0.7);
                  ctx.fillStyle = `rgba(0,255,200,${alpha})`;
                  ctx.beginPath();
                  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.save();
                  ctx.globalAlpha = alpha * 0.3;
                  ctx.shadowColor = '#00ffc8';
                  ctx.shadowBlur = 6;
                  ctx.beginPath();
                  ctx.arc(px, py, 2, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.restore();
                  break;
                }
                accLen += segLens[s];
              }
            }
          }
        }
      }

      // 画线预览（拖拽中）— 根据引脚方向正交走线
      if (drag.mode === 'wire' && drag.wireFrom) {
        const r = canvasRef.current?.getBoundingClientRect();
        if (r) {
          const T = tfRef.current;
          const mx = (drag.sx - r.left - r.width / 2 - T.ox) / T.scale;
          const my = (drag.sy - r.top - r.height / 2 - T.oy) / T.scale;
          ctx.strokeStyle = '#8888ff'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(drag.wireFrom.x, drag.wireFrom.y);

          // 推断源引脚方向
          const wfComp = drag.wireFrom.componentId === '__chip__' ? null : C.find(c => c.id === drag.wireFrom!.componentId);
          const wfPinRaw = drag.wireFrom.componentId === '__chip__'
            ? pins.find(p => p.id === drag.wireFrom!.pinId)
            : wfComp?.pins.find(p => p.id === drag.wireFrom!.pinId);
          const wfDir = drag.wireFrom.componentId === '__chip__'
            ? (wfPinRaw as Pin | undefined)?.side || 'right'
            : wfPinRaw ? getPinSide(wfPinRaw) : 'right';

          const M = 18;
          const wfH = wfDir === 'left' || wfDir === 'right';

          if (wfH) {
            // 水平引脚：先水平走，再L形到鼠标
            const extX = drag.wireFrom.x + (wfDir === 'left' ? -M : M);
            ctx.lineTo(extX, drag.wireFrom.y);
            ctx.lineTo(extX, my);
          } else {
            // 垂直引脚：先垂直走，再L形到鼠标
            const extY = drag.wireFrom.y + (wfDir === 'top' ? -M : M);
            ctx.lineTo(drag.wireFrom.x, extY);
            ctx.lineTo(mx, extY);
          }
          ctx.lineTo(mx, my);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 元件（含动画效果）
      for (const c of C) {
        ctx.save(); ctx.translate(c.x, c.y);
        if (c.rotation) ctx.rotate((c.rotation * Math.PI) / 180);

        const sim = c.simState;

        // 悬停高亮
        const isHovered = hoverCompRef.current?.id === c.id;

        // 选中框
        if (c.selected) {
          ctx.strokeStyle = '#58cebe'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
          ctx.strokeRect(-c.w / 2 - 5, -c.h / 2 - 5, c.w + 10, c.h + 10);
          ctx.setLineDash([]);
        }

        // 悬停高亮框
        if (isHovered && !c.selected) {
          ctx.strokeStyle = 'rgba(88,206,190,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
          ctx.strokeRect(-c.w / 2 - 4, -c.h / 2 - 4, c.w + 8, c.h + 8);
          ctx.setLineDash([]);
        }

        // 电源缺失检测：非电源类元件若无任何连接到电源则标红边框
        const needsPower = !['power', 'resistor', 'capacitor', 'crystal', 'ic'].includes(c.type);
        const hasAnyConnection = c.pins.some(p => p.connected);
        const isPowerMissing = needsPower && !hasAnyConnection;
        if (isPowerMissing) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 68, 68, 0.8)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(-c.w / 2 - 6, -c.h / 2 - 6, c.w + 12, c.h + 12);
          ctx.setLineDash([]);
          // 红色警告图标
          ctx.fillStyle = '#ff4444';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('⚠', 0, -c.h / 2 - 8);
          ctx.restore();
        }

        const baseFill = c.selected ? '#3a6a7a' : isHovered ? '#355d6d' : '#2d5060';
        const baseStroke = c.selected ? '#58cebe' : isHovered ? '#5a9aad' : '#4a7a8a';
        ctx.fillStyle = baseFill;
        ctx.strokeStyle = baseStroke;
        ctx.lineWidth = 1.5;

        if (c.type === 'button' || c.type === 'switch') {
          // === 按钮/开关 — 长条形+拉杆 ===
          const pressed = sim.buttonPressed;
          const btnColor = pressed ? '#2ecc71' : '#e74c3c';
          const barW = 32, barH = 16;
          // 外框（长条形）
          ctx.fillStyle = pressed ? '#1a3a2a' : '#2a3a44';
          ctx.strokeStyle = pressed ? '#2ecc71' : baseStroke;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(-barW / 2, -barH / 2, barW, barH, 4); ctx.fill(); ctx.stroke();
          // 内圆（按下=凹陷，弹起=凸起）
          ctx.fillStyle = btnColor;
          const dotR = pressed ? 5 : 6;
          ctx.beginPath(); ctx.arc(4, 0, dotR, 0, Math.PI * 2); ctx.fill();
          // 标签
          ctx.fillStyle = '#fff'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(pressed ? 'ON' : 'OFF', 4, 0);
          // 拉杆/拨杆（左侧）
          const leverX = -barW / 2 - 8;
          const leverTopY = pressed ? -2 : -8;
          const leverBotY = pressed ? 8 : 2;
          // 拉杆竖杆
          ctx.strokeStyle = '#8ab0c4';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(leverX, leverTopY); ctx.lineTo(leverX, leverBotY); ctx.stroke();
          // 拉杆顶部小圆
          ctx.fillStyle = pressed ? '#2ecc71' : '#f1c40f';
          ctx.beginPath(); ctx.arc(leverX, leverTopY, 3, 0, Math.PI * 2); ctx.fill();
          // 拉杆到底部连线（斜线到按钮体）
          ctx.strokeStyle = 'rgba(138,176,196,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(leverX, (leverTopY + leverBotY) / 2); ctx.lineTo(-barW / 2, 0); ctx.stroke();
        } else if (c.type === 'led') {
          // === LED 亮度动画 ===
          const brightness = sim.pwmDuty;
          // 外圈
          ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          // 内核 - 亮度随 PWM 占空比变化
          if (brightness > 0.01) {
            // 发光效果
            const glowAlpha = brightness * 0.6;
            const glowRadius = 14 + brightness * 12;
            const gradient = ctx.createRadialGradient(0, 0, 3, 0, 0, glowRadius);
            gradient.addColorStop(0, `rgba(255,217,61,${glowAlpha})`);
            gradient.addColorStop(0.5, `rgba(255,174,0,${glowAlpha * 0.5})`);
            gradient.addColorStop(1, 'rgba(255,174,0,0)');
            ctx.fillStyle = gradient;
            ctx.beginPath(); ctx.arc(0, 0, glowRadius, 0, Math.PI * 2); ctx.fill();

            // LED 内核
            const coreR = 5 + brightness * 3;
            ctx.fillStyle = `rgba(255,${Math.round(217 - brightness * 80)},${Math.round(61 - brightness * 40)},${0.7 + brightness * 0.3})`;
            ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();

            // 脉冲效果
            const pulse = 0.8 + 0.2 * Math.sin(animT * 8 * brightness);
            ctx.globalAlpha = brightness * 0.15 * pulse;
            ctx.fillStyle = '#ffd93d';
            ctx.beginPath(); ctx.arc(0, 0, glowRadius * 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = '#4a3a2a';
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
          }
        } else if (c.type === 'resistor') {
          // 电阻：锯齿线，引脚在左右两端 ±30
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-22, 0);
          for (let i = 0; i < 4; i++) { ctx.lineTo(-16 + i * 10, -5); ctx.lineTo(-11 + i * 10, 5); }
          ctx.lineTo(22, 0); ctx.lineTo(30, 0); ctx.stroke();
        } else if (c.type === 'capacitor') {
          // 电容符号（左右两端引脚）
          ctx.beginPath();
          ctx.moveTo(-20, 0); ctx.lineTo(-5, 0); // 左引脚线
          ctx.moveTo(-5, -10); ctx.lineTo(-5, 10); // 左极板
          ctx.moveTo(5, -10); ctx.lineTo(5, 10); // 右极板
          ctx.moveTo(5, 0); ctx.lineTo(20, 0); // 右引脚线
          ctx.stroke();
        } else if (c.type === 'buzzer_active' || c.type === 'buzzer_passive' || c.type === 'buzzer') {
          // === 蜂鸣器动画 ===
          ctx.beginPath(); ctx.roundRect(-14, -14, 28, 28, 14); ctx.fill(); ctx.stroke();
          // 内部圆
          ctx.strokeStyle = '#78b6ec'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke();

          // 声波动画 — 从中心向外扩散
          if (sim.buzzerActive) {
            const numRings = 5;
            for (let r = 0; r < numRings; r++) {
              const phase = (animT * 4 + r * (1 / numRings)) % 1;
              const ringR = 8 + phase * 22;
              const ringAlpha = (1 - phase) * 0.6;
              ctx.strokeStyle = `rgba(120,182,236,${ringAlpha})`;
              ctx.lineWidth = 2 * (1 - phase);
              ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
              // 外层发光
              ctx.save();
              ctx.globalAlpha = ringAlpha * 0.3;
              ctx.shadowColor = '#78b6ec';
              ctx.shadowBlur = 8;
              ctx.strokeStyle = `rgba(120,182,236,${ringAlpha})`;
              ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
              ctx.restore();
            }
            // 震动抖动效果
            const shake = Math.sin(animT * 50) * 1;
            ctx.save();
            ctx.translate(shake, shake * 0.5);
            ctx.fillStyle = '#78b6ec';
            ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        } else if (c.type === 'motor') {
          // === 电机旋转动画 ===
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          // 转子
          if (sim.motorSpeed > 0.01) {
            const rotorAngle = animT * sim.motorSpeed * 15;
            ctx.strokeStyle = '#78b6ec';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
              const a = rotorAngle + (i * Math.PI * 2) / 3;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
              ctx.stroke();
            }
            // 转速指示
            ctx.fillStyle = '#58cebe';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(sim.motorSpeed * 100)}%`, 0, 22);
          } else {
            ctx.strokeStyle = '#5a6a7a';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke();
          }
        } else if (c.type === 'diode') {
          // === 二极管：三角形+竖线 ===
          ctx.beginPath();
          ctx.moveTo(-16, -10); ctx.lineTo(-16, 10); ctx.lineTo(10, 0); ctx.closePath();
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(10, 10); ctx.stroke();
          // 引脚延长线
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-16, 0); ctx.moveTo(10, 0); ctx.lineTo(25, 0); ctx.stroke();
        } else if (c.type === 'zener_diode') {
          // === 稳压二极管：三角形+竖线+拐角 ===
          ctx.beginPath();
          ctx.moveTo(-16, -10); ctx.lineTo(-16, 10); ctx.lineTo(10, 0); ctx.closePath();
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(10, 10); ctx.stroke();
          // 拐角
          ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(14, -12); ctx.lineTo(10, -10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(6, 12); ctx.lineTo(14, 12); ctx.lineTo(10, 10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-16, 0); ctx.moveTo(10, 0); ctx.lineTo(25, 0); ctx.stroke();
        } else if (c.type === 'bjt_npn') {
          // === NPN 三极管 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
          // 基极
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-8, 0); ctx.stroke();
          // 基极竖线
          ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-8, 10); ctx.stroke();
          // 集电极
          ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(12, -16); ctx.stroke();
          // 发射极
          ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(12, 16); ctx.stroke();
          // NPN 箭头（向内，指向基极）
          ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(12, 16); ctx.lineTo(8, 16); ctx.stroke();
        } else if (c.type === 'bjt_pnp') {
          // === PNP 三极管 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-8, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-8, 10); ctx.stroke();
          // 集电极
          ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(12, -16); ctx.stroke();
          // 发射极
          ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(12, 16); ctx.stroke();
          // PNP 箭头（向外，从基极指出）
          ctx.beginPath(); ctx.moveTo(12, 16); ctx.lineTo(6, 12); ctx.lineTo(10, 16); ctx.stroke();
        } else if (c.type === 'mosfet_nmos') {
          // === NMOS MOSFET ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
          // 栅极
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-8, 0); ctx.stroke();
          // 栅极线
          ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-8, 12); ctx.stroke();
          // 漏极线
          ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-4, -12); ctx.lineTo(12, -12); ctx.stroke();
          // 源极线
          ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-4, 12); ctx.lineTo(12, 12); ctx.stroke();
          // 源极和漏极连接
          ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4, 12); ctx.stroke();
          // NMOS 箭头（指向栅极）
          ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-4, 3); ctx.lineTo(-4, -3); ctx.closePath();
          ctx.fillStyle = baseStroke; ctx.fill();
        } else if (c.type === 'mosfet_pmos') {
          // === PMOS MOSFET ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-8, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-8, 12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-4, -12); ctx.lineTo(12, -12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-4, 12); ctx.lineTo(12, 12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4, 12); ctx.stroke();
          // PMOS 圆圈
          ctx.beginPath(); ctx.arc(1, 0, 3, 0, Math.PI * 2); ctx.stroke();
        } else if (c.type === 'op_amp') {
          // === 运算放大器：三角形 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-16, -14); ctx.lineTo(-16, 14); ctx.lineTo(16, 0); ctx.closePath();
          ctx.fill(); ctx.stroke();
          // + 和 - 标注
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('+', -10, 7);
          ctx.fillText('−', -10, -7);
          // 引脚延长线
          ctx.strokeStyle = baseStroke;
          ctx.beginPath(); ctx.moveTo(-25, 6); ctx.lineTo(-16, 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-25, -6); ctx.lineTo(-16, -6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(25, 0); ctx.stroke();
        } else if (c.type === 'optocoupler') {
          // === 光耦：左侧LED + 右侧光电管 + 虚线 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-20, -16, 40, 32, 4); ctx.stroke();
          // 左侧 LED
          ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(-12, 8); ctx.lineTo(-2, 0); ctx.closePath(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(-2, 8); ctx.stroke();
          // 右侧光电管
          ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(14, 0); ctx.lineTo(6, 6); ctx.stroke();
          // 虚线
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(6, 0); ctx.stroke();
          ctx.setLineDash([]);
        } else if (c.type === 'timer_555') {
          // === 555 定时器：矩形+引脚标注 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -20, 36, 40, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('555', 0, 0);
          // 引脚标注
          ctx.font = '7px monospace'; ctx.fillStyle = '#8ab8d0';
          ctx.fillText('GND', -12, 14); ctx.fillText('TRG', -12, 5); ctx.fillText('OUT', 12, -14);
          ctx.fillText('RST', -12, -5); ctx.fillText('CTL', -12, -14); ctx.fillText('THR', 12, 5);
          ctx.fillText('DIS', 12, 14);
        } else if (c.type === 'voltage_regulator_7805' || c.type === 'voltage_regulator_7812') {
          // === 电压稳压器 TO-220 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -12, 36, 24, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(c.type.includes('7805') ? '7805' : '7812', 0, 0);
        } else if (c.type === 'eeprom_i2c' || c.type === 'eeprom_spi') {
          // === EEPROM 芯片 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-16, -14, 32, 28, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(c.type.includes('i2c') ? 'EEPROM' : 'EEPROM', 0, -3);
          ctx.font = '7px monospace'; ctx.fillText(c.type.includes('i2c') ? 'I2C' : 'SPI', 0, 7);
        } else if (c.type === 'ntc_thermistor') {
          // === NTC 热敏电阻：电阻符号+温度标注+温度计图标 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-18, 0);
          for (let i = 0; i < 3; i++) { ctx.lineTo(-13 + i * 10, -5); ctx.lineTo(-8 + i * 10, 5); }
          ctx.lineTo(18, 0); ctx.lineTo(25, 0); ctx.stroke();
          // 温度计图标
          ctx.strokeStyle = '#e07050'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, 10, 4, 0, Math.PI * 2); ctx.stroke(); // 圆底
          ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -6); ctx.stroke(); // 竖管
          ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(5, -4); ctx.stroke(); // 刻度
          ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(4, -1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(5, 2); ctx.stroke();
          // 填充液
          ctx.fillStyle = '#e07050';
          ctx.beginPath(); ctx.arc(0, 10, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(-0.8, 2, 1.6, 8);
          // 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = '6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('NTC', 0, -10);
        } else if (c.type === 'ds18b20') {
          // === DS18B20 温度传感器：芯片+温度计图标 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-16, -14, 32, 28, 3); ctx.fill(); ctx.stroke();
          // 温度计图标
          ctx.strokeStyle = '#e07050'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(10, 8, 3, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(10, 5); ctx.lineTo(10, -4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(11.5, -2); ctx.lineTo(13.5, -2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(11.5, 1); ctx.lineTo(13, 1); ctx.stroke();
          ctx.fillStyle = '#e07050';
          ctx.beginPath(); ctx.arc(10, 8, 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(9.5, 1, 1, 7);
          // 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('DS18B20', -2, -2);
          ctx.font = '6px monospace'; ctx.fillStyle = '#e07050';
          ctx.fillText('℃', -2, 7);
        } else if (c.type === 'dht20' || c.type === 'aht20') {
          // === 湿度传感器 (DHT20/AHT20)：水滴图标 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -14, 36, 28, 4); ctx.fill(); ctx.stroke();
          // 水滴图标
          ctx.fillStyle = '#5b9bd5';
          ctx.beginPath();
          ctx.moveTo(0, -8); // 尖端
          ctx.bezierCurveTo(-8, 0, -6, 8, 0, 10); // 左半边
          ctx.bezierCurveTo(6, 8, 8, 0, 0, -8);   // 右半边
          ctx.closePath();
          ctx.globalAlpha = 0.5;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#5b9bd5'; ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.bezierCurveTo(-8, 0, -6, 8, 0, 10);
          ctx.bezierCurveTo(6, 8, 8, 0, 0, -8);
          ctx.closePath();
          ctx.stroke();
          // 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(c.type === 'dht20' ? 'DHT20' : 'AHT20', 0, -16);
          ctx.fillStyle = '#5b9bd5'; ctx.font = '5px monospace';
          ctx.fillText('%RH', 0, 16);
        } else if (c.type === 'ultrasonic') {
          // === 超声波模块 (HC-SR04)：方块+两个圆孔 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-20, -14, 40, 28, 3); ctx.fill(); ctx.stroke();
          // 两个超声波传感器圆孔
          ctx.strokeStyle = '#7a8a9a'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(-8, 0, 6, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(8, 0, 6, 0, Math.PI * 2); ctx.stroke();
          // 内圈
          ctx.beginPath(); ctx.arc(-8, 0, 3, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(8, 0, 3, 0, Math.PI * 2); ctx.stroke();
          // 声波弧线（从左孔向外）
          ctx.strokeStyle = '#5b9bd5'; ctx.lineWidth = 0.8;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.arc(-8, 0, 9 + i * 4, -0.5, 0.5); ctx.stroke();
          }
          // 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('HC-SR04', 0, -16);
        } else if (c.type === 'ldr') {
          // === 光敏电阻：电阻符号+箭头 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-18, 0);
          for (let i = 0; i < 3; i++) { ctx.lineTo(-13 + i * 10, -5); ctx.lineTo(-8 + i * 10, 5); }
          ctx.lineTo(18, 0); ctx.lineTo(25, 0); ctx.stroke();
          // 光线箭头
          ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(0, -8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(6, -8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(-1, -11); ctx.lineTo(-5, -11); ctx.closePath();
          ctx.fillStyle = baseStroke; ctx.fill();
          ctx.beginPath(); ctx.moveTo(3, -14); ctx.lineTo(5, -11); ctx.lineTo(1, -11); ctx.closePath();
          ctx.fill();
        } else if (c.type === 'accelerometer' || c.type === 'gyroscope') {
          // === MEMS 传感器 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-16, -14, 32, 28, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(c.type === 'accelerometer' ? 'ACC' : 'GYRO', 0, 0);
        } else if (c.type === 'sensor') {
          // === 通用传感器 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(c.type.slice(0, 3).toUpperCase(), 0, 0);
        } else if (c.type === 'uart_tx' || c.type === 'uart_rx') {
          // === UART TX/RX ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-16, -12, 32, 24, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(c.type === 'uart_tx' ? 'TX' : 'RX', 0, 0);
          ctx.font = '6px monospace'; ctx.fillText('UART', 0, 8);
        } else if (c.type === 'spi_master' || c.type === 'spi_slave') {
          // === SPI Master/Slave ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-16, -12, 32, 24, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('SPI', 0, -3);
          ctx.font = '7px monospace'; ctx.fillText(c.type === 'spi_master' ? 'MST' : 'SLV', 0, 7);
        } else if (c.type === 'i2c_master' || c.type === 'i2c_slave') {
          // === I2C Master/Slave ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-16, -12, 32, 24, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('I2C', 0, -3);
          ctx.font = '7px monospace'; ctx.fillText(c.type === 'i2c_master' ? 'MST' : 'SLV', 0, 7);
        } else if (c.type === 'bluetooth_module') {
          // === 蓝牙模块：矩形外框 + 蓝牙标志 + BT ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -14, 36, 28, 4); ctx.fill(); ctx.stroke();
          // 蓝牙标志：两个三角形交叉（经典 Bluetooth Rune）
          ctx.strokeStyle = '#5b9bd5'; ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          // 上半部 V 形（右向箭头）
          ctx.beginPath();
          ctx.moveTo(-3, -10); ctx.lineTo(5, -2); ctx.lineTo(-3, 6); // 左半边
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(5, -10); ctx.lineTo(-3, -2); ctx.lineTo(5, 6); // 右半边（交叉）
          ctx.stroke();
          // 垂直中线
          ctx.beginPath(); ctx.moveTo(1, -10); ctx.lineTo(1, 6); ctx.stroke();
          // 上下短横线
          ctx.beginPath(); ctx.moveTo(1, -10); ctx.lineTo(5, -10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(1, 6); ctx.lineTo(5, 6); ctx.stroke();
          ctx.lineCap = 'butt';
          // 底部 BT 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('BT', 0, 10);
        } else if (c.type === 'wifi_module') {
          // === WiFi模块：矩形外框 + WiFi信号图标 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -14, 36, 28, 4); ctx.fill(); ctx.stroke();
          // WiFi 信号图标：中心圆点 + 3条弧线
          ctx.fillStyle = '#5b9bd5';
          ctx.beginPath(); ctx.arc(0, 6, 2.5, 0, Math.PI * 2); ctx.fill(); // 中心点
          ctx.strokeStyle = '#5b9bd5'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
          // 最内弧
          ctx.beginPath(); ctx.arc(0, 6, 7, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
          // 中弧
          ctx.beginPath(); ctx.arc(0, 6, 12, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
          // 最外弧
          ctx.beginPath(); ctx.arc(0, 6, 17, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
          ctx.lineCap = 'butt';
          // 底部 WiFi 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('WiFi', 0, -10);
        } else if (c.type === 'pin_header' && c.name && /USB/i.test(c.name)) {
          // === USB Type-C 接口 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -10, 36, 20, 10); ctx.fill(); ctx.stroke();
          // 内部 Type-C 触点（上排/下排各4个点）
          ctx.fillStyle = '#8ab8d0';
          for (let i = 0; i < 4; i++) {
            ctx.beginPath(); ctx.arc(-8 + i * 5.3, -3, 1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-8 + i * 5.3, 3, 1, 0, Math.PI * 2); ctx.fill();
          }
          // USB 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('USB-C', 0, 16);
        } else if (c.type === 'pin_header' && c.name && /CH343|串口/i.test(c.name)) {
          // === CH343P USB-UART 模块 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-20, -14, 40, 28, 3); ctx.fill(); ctx.stroke();
          // 内部芯片形状（小矩形 + 引脚线）
          ctx.strokeStyle = '#6a9aaa'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(-10, -8, 20, 16, 2); ctx.stroke();
          // 引脚标记
          ctx.fillStyle = '#8ab8d0'; ctx.font = '5px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('D+', -6, -3); ctx.fillText('D+', -6, 3);
          ctx.fillText('TX', 6, -3); ctx.fillText('RX', 6, 3);
          // 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('USB-UART', 0, 0);
        } else if (c.type === 'can_transceiver' || c.type === 'rs485_transceiver') {
          // === CAN/RS485 收发器 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -14, 36, 28, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(c.type === 'can_transceiver' ? 'CAN' : 'RS485', 0, 0);
        } else if (c.type === 'ground') {
          // === 接地符号：三条横线从上到下变短 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(6, 5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-3, 10); ctx.lineTo(3, 10); ctx.stroke();
        } else if (c.type === 'battery') {
          // === 电池符号：长短线交替 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -10); ctx.stroke();
          // 长线（正极）
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.stroke();
          // 短线
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(4, -3); ctx.stroke();
          // 长线
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(8, 4); ctx.stroke();
          // 短线
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-4, 11); ctx.lineTo(4, 11); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(0, 22); ctx.stroke();
          // + 和 -
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('+', 12, -10); ctx.fillText('−', 12, 4);
          // 引脚圆点
          ctx.fillStyle = baseStroke;
          ctx.beginPath(); ctx.arc(0, -22, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(0, 22, 3, 0, Math.PI * 2); ctx.fill();
        } else if (c.type === 'ldo' || c.type === 'buck' || c.type === 'boost') {
          // === 电源模块：LDO/Buck/Boost ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -14, 36, 28, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(c.type.toUpperCase(), 0, 0);
        } else if (c.type === 'crystal') {
          // === 晶振符号：两个平行线+XTAL ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          // 平行线
          ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-6, 8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(6, 8); ctx.stroke();
          // 连接线
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-6, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(25, 0); ctx.stroke();
          // XTAL 标签
          ctx.fillStyle = '#8ab8d0'; ctx.font = '6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('XTAL', 0, -12);
        } else if (c.type === 'inductor') {
          // === 电感：半圆弧线圈，引脚在 ±30 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-22, 0); ctx.stroke();
          // 半圆弧线圈（4个弧）
          for (let i = 0; i < 4; i++) {
            ctx.beginPath(); ctx.arc(-16 + i * 10, 0, 5, Math.PI, 0); ctx.stroke();
          }
          ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(30, 0); ctx.stroke();
        } else if (c.type === 'ferrite_bead') {
          // === 铁氧体磁珠：矩形+FB，引脚在 ±30 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-18, 0); ctx.stroke();
          ctx.beginPath(); ctx.roundRect(-18, -10, 36, 20, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('FB', 0, 0);
          ctx.strokeStyle = baseStroke;
          ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(30, 0); ctx.stroke();
        } else if (c.type === 'potentiometer') {
          // === 电位器：电阻+箭头 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-18, 0);
          for (let i = 0; i < 3; i++) { ctx.lineTo(-13 + i * 10, -5); ctx.lineTo(-8 + i * 10, 5); }
          ctx.lineTo(18, 0); ctx.lineTo(25, 0); ctx.stroke();
          // 滑动箭头
          ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -14); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(0, -14); ctx.lineTo(4, -10); ctx.stroke();
        } else if (c.type === 'relay') {
          // === 继电器：线圈符号（左侧锯齿线圈）+ 触点开关（右侧）+ RELAY 标注 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-18, -16, 36, 32, 3); ctx.stroke();
          // 左侧线圈（锯齿形）
          ctx.beginPath();
          ctx.moveTo(-16, 10); ctx.lineTo(-16, 0); // 引脚
          for (let i = 0; i < 4; i++) {
            ctx.lineTo(-12 + i * 2, -4 + i * -2);
            ctx.lineTo(-10 + i * 2, 4 + i * 2);
          }
          ctx.lineTo(0, 10); // 底部引脚
          ctx.stroke();
          // 线圈下方引脚延长
          ctx.beginPath(); ctx.moveTo(-16, 10); ctx.lineTo(-16, 16); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 16); ctx.stroke();
          // 右侧触点开关
          // COM（公共端）
          ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(4, 16); ctx.stroke();
          // NC（常闭触点）- 实线
          ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(14, 4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(14, 16); ctx.stroke();
          // NO（常开触点）- 连到中间触点
          ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(10, -4); ctx.stroke();
          // 触点圆点
          ctx.fillStyle = baseStroke;
          ctx.beginPath(); ctx.arc(10, -4, 2, 0, Math.PI * 2); ctx.fill();
          // NO 引脚
          ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(14, -4); ctx.lineTo(14, -16); ctx.stroke();
          // NC/NO 标注
          ctx.fillStyle = '#8ab8d0'; ctx.font = '5px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('COM', 4, 14);
          ctx.fillText('NC', 16, 4);
          ctx.fillText('NO', 16, -8);
          // RELAY 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('RELAY', 0, -18);
        } else if (c.type === 'dc_motor' || c.type === 'stepper_motor') {
          // === 电机类：圆形+M ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('M', 0, 0);
          ctx.font = '6px monospace'; ctx.fillStyle = '#8ab8d0';
          ctx.fillText(c.type === 'dc_motor' ? 'DC' : 'STEP', 0, 10);
        } else if (c.type === 'servo_motor') {
          // === 舵机：矩形主体 + 输出轴 + 三线接口 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          // 主体矩形
          ctx.beginPath(); ctx.roundRect(-16, -8, 32, 22, 3); ctx.fill(); ctx.stroke();
          // 输出轴（上方圆柱形）
          ctx.beginPath(); ctx.roundRect(-6, -16, 12, 8, 2); ctx.fill(); ctx.stroke();
          // 轴上齿轮标记
          ctx.strokeStyle = '#6a9aaa'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(3, -14); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(4, -12); ctx.stroke();
          // 三线接口（底部）
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          // 棕色线 GND
          ctx.strokeStyle = '#8B4513'; ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(-8, 20); ctx.stroke();
          // 红色线 VCC
          ctx.strokeStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, 20); ctx.stroke();
          // 橙色线 SIG
          ctx.strokeStyle = '#e67e22'; ctx.beginPath(); ctx.moveTo(8, 14); ctx.lineTo(8, 20); ctx.stroke();
          // 标签
          ctx.fillStyle = '#e0f0f8'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('SRV', 0, 3);
        } else if (c.type === 'seven_segment') {
          // === 七段数码管：显示实际数字 0-9 ===
          // 根据 simState 中的 adcValue 取模得到 0-9
          const digit = Math.abs(sim.adcValue || 0) % 10;
          // 段定义: a=上, b=右上, c=右下, d=下, e=左下, f=左上, g=中
          const SEGMENTS: Record<number, string[]> = {
            0: ['a','b','c','d','e','f'],
            1: ['b','c'],
            2: ['a','b','d','e','g'],
            3: ['a','b','c','d','g'],
            4: ['b','c','f','g'],
            5: ['a','c','d','f','g'],
            6: ['a','c','d','e','f','g'],
            7: ['a','b','c'],
            8: ['a','b','c','d','e','f','g'],
            9: ['a','b','c','d','f','g'],
          };
          const activeSegs = new Set(SEGMENTS[digit] || []);
          const onColor = '#ff3333';
          const offColor = '#331a1a';
          const segW = 2, segLen = 8;
          // 外框
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-14, -18, 28, 36, 3); ctx.stroke();
          // 画每一段
          function drawSeg(segId: string) {
            const active = activeSegs.has(segId);
            ctx.strokeStyle = active ? onColor : offColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            switch (segId) {
              case 'a': ctx.moveTo(-6, -12); ctx.lineTo(4, -12); break; // 上横
              case 'b': ctx.moveTo(6, -10); ctx.lineTo(6, -2); break;   // 右上竖
              case 'c': ctx.moveTo(6, 2); ctx.lineTo(6, 10); break;     // 右下竖
              case 'd': ctx.moveTo(-6, 12); ctx.lineTo(4, 12); break;   // 下横
              case 'e': ctx.moveTo(-8, 2); ctx.lineTo(-8, 10); break;   // 左下竖
              case 'f': ctx.moveTo(-8, -10); ctx.lineTo(-8, -2); break; // 左上竖
              case 'g': ctx.moveTo(-6, 0); ctx.lineTo(4, 0); break;     // 中横
            }
            ctx.stroke();
            // 激活段发光效果
            if (active) {
              ctx.save();
              ctx.globalAlpha = 0.2 + 0.1 * Math.sin(animT * 6);
              ctx.shadowColor = onColor;
              ctx.shadowBlur = 6;
              ctx.strokeStyle = onColor;
              ctx.lineWidth = 3;
              ctx.beginPath();
              switch (segId) {
                case 'a': ctx.moveTo(-6, -12); ctx.lineTo(4, -12); break;
                case 'b': ctx.moveTo(6, -10); ctx.lineTo(6, -2); break;
                case 'c': ctx.moveTo(6, 2); ctx.lineTo(6, 10); break;
                case 'd': ctx.moveTo(-6, 12); ctx.lineTo(4, 12); break;
                case 'e': ctx.moveTo(-8, 2); ctx.lineTo(-8, 10); break;
                case 'f': ctx.moveTo(-8, -10); ctx.lineTo(-8, -2); break;
                case 'g': ctx.moveTo(-6, 0); ctx.lineTo(4, 0); break;
              }
              ctx.stroke();
              ctx.restore();
            }
          }
          ['a','b','c','d','e','f','g'].forEach(drawSeg);
        } else if (c.type === 'oled_display') {
          // === OLED显示屏（4x放大） ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 6); ctx.fill(); ctx.stroke();
          // 屏幕内框（暗色背景）
          ctx.fillStyle = '#0a0a0a';
          ctx.beginPath(); ctx.roundRect(-c.w / 2 + 6, -c.h / 2 + 6, c.w - 12, c.h - 12, 4); ctx.fill();
          // 边框光晕
          ctx.strokeStyle = '#1a3a4a';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(-c.w / 2 + 6, -c.h / 2 + 6, c.w - 12, c.h - 12, 4); ctx.stroke();

          // 仿真运行时才显示内容
          if (sim.pwmDuty > 0 || sim.temperature > 0 || sim.adcValue > 0 || sim.buzzerActive) {
            ctx.fillStyle = '#33ff88';
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const textX = -c.w / 2 + 14;
            const textY = -c.h / 2 + 14;
            ctx.fillStyle = '#66ffaa';
            ctx.fillText('=== OLED 128x64 ===', textX, textY);
            ctx.fillStyle = '#33ff88';
            ctx.fillText('Hello World!', textX, textY + 24);
            const temp = (sim.temperature || 25.3).toFixed(1);
            ctx.fillText(`Temperature: ${temp}C`, textX, textY + 48);
            ctx.fillText(`ADC: ${sim.adcValue || 0}`, textX, textY + 72);
            const timeStr = `${Math.floor(animT * 10) % 100}`.padStart(2, '0');
            ctx.fillText(`Tick: ${timeStr}`, textX, textY + 96);
            // 像素光晕
            ctx.save();
            ctx.globalAlpha = 0.06;
            ctx.shadowColor = '#33ff88';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#33ff88';
            ctx.fillRect(-c.w / 2 + 6, -c.h / 2 + 6, c.w - 12, c.h - 12);
            ctx.restore();
          } else {
            // 未启动仿真时显示占位文字
            ctx.fillStyle = '#335544';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('OLED', 0, 0);
          }
        } else if (c.type === 'lcd_display') {
          // === LCD显示屏 ===
          ctx.strokeStyle = baseStroke; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 4); ctx.fill(); ctx.stroke();
          // 屏幕内框
          ctx.strokeStyle = '#4a7a8a'; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.roundRect(-c.w / 2 + 3, -c.h / 2 + 3, c.w - 6, c.h - 6, 2); ctx.stroke();
          ctx.fillStyle = '#c0e8c0'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('LCD 1602', 0, -3);
          ctx.font = '6px monospace'; ctx.fillText('Ready', 0, 7);
        } else if (c.type === 'display') {
          // === 通用显示 ===
          ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e0f0f8'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('DIS', 0, 0);
        } else {
          // === 通用模块：圆角矩形+简短标签 ===
          // 根据类型选择边框颜色
          const typeColors: Record<string, string> = {
            'adc': '#e67e22', 'dac': '#e67e22',
            'vco': '#9b59b6', 'pll': '#9b59b6',
            'mixer': '#1abc9c', 'filter': '#1abc9c',
            'amplifier': '#3498db', 'comparator': '#3498db',
            'shift_register': '#e74c3c', 'counter': '#e74c3c',
            'decoder': '#2ecc71', 'multiplexer': '#2ecc71',
            'flip_flop': '#f39c12', 'latch': '#f39c12',
            'gate': '#1abc9c', 'inverter': '#1abc9c',
            'clock': '#9b59b6', 'oscillator': '#9b59b6',
            'antenna': '#3498db', 'transceiver': '#3498db',
            'encoder': '#e74c3c', 'decoder_ic': '#e74c3c',
            'pld': '#e67e22', 'fpga': '#e67e22',
            'microcontroller': '#3498db', 'mcu': '#3498db',
          };
          const accent = typeColors[c.type] || '#4a7a8a';
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 5); ctx.fill(); ctx.stroke();
          // 内部小装饰线
          ctx.strokeStyle = accent + '44'; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.roundRect(-c.w / 2 + 2, -c.h / 2 + 2, c.w - 4, c.h - 4, 4); ctx.stroke();
          // 标签（2-4个字符）
          const label = c.type.replace(/_/g, ' ').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
          ctx.fillStyle = accent; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(label, 0, 0);
        }

        // 元件引脚（带电平颜色 + 未接引脚标红）
        for (const p of c.pins) {
          const isUnconnected = !p.connected;
          const pColor = isUnconnected ? '#ff4444' : pinLevelColor(p.level);
          ctx.fillStyle = isUnconnected ? '#ff4444cc' : (p.connected ? pColor : (p.level === 'floating' ? '#f1c40f88' : pColor + '88'));
          ctx.beginPath(); ctx.arc(p.offsetX, p.offsetY, isUnconnected ? 4 : 3, 0, Math.PI * 2); ctx.fill();

          // 未连接引脚：红色虚线圆圈
          if (isUnconnected) {
            ctx.save();
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(p.offsetX, p.offsetY, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }

          // 高电平引脚发光
          if (p.level === 'high' && p.connected) {
            ctx.save();
            ctx.globalAlpha = 0.3 + 0.15 * Math.sin(animT * 4);
            ctx.shadowColor = '#2ecc71';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.arc(p.offsetX, p.offsetY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // 名称
        ctx.fillStyle = '#c0d8e4'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(c.name, 0, c.h / 2 + 6);

        ctx.restore();
      }

      ctx.restore();

      // HUD
      ctx.fillStyle = 'rgba(138,176,196,0.5)'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
      const engineState = engineRef.current;
      const stateLabel = engineState.isRunning() ? '▶ 运行中' : engineState.isPaused() ? '⏸ 暂停' : '⏹ 停止';
      ctx.fillText(`${stateLabel}  |  tick: ${engineState.getTickCount()}  |  ${Math.round(T.scale * 100)}%  |  元件: ${C.length}  |  连线: ${Ws.length}`, 12, H - 8);

      // 悬停引脚提示
      if (hoverPin) {
        // 背景
        const text = hoverPin.name;
        ctx.font = '11px monospace';
        const tw = ctx.measureText(text).width + 12;
        const px = hoverPin.x - tw / 2;
        const py = hoverPin.y - 26;
        ctx.fillStyle = 'rgba(42,74,90,0.92)';
        ctx.strokeStyle = 'rgba(88,206,190,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(px, py, tw, 20, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#58cebe'; ctx.textAlign = 'center';
        ctx.fillText(text, hoverPin.x, py + 13);
      }

      // 悬停元件 tooltip
      if (hoverComp && !hoverPin) {
        const lines = [
          `📌 ${hoverComp.name}`,
          `类型: ${hoverComp.type}`,
          hoverComp.details,
        ].filter(Boolean);
        ctx.font = '11px monospace';
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
        const tw = maxW + 20;
        const th = lines.length * 18 + 12;
        const px = hoverComp.x - tw / 2;
        const py = hoverComp.y - th - 10;

        ctx.fillStyle = 'rgba(30,50,65,0.95)';
        ctx.strokeStyle = 'rgba(88,206,190,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(px, py, tw, th, 6); ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#e0f0f8'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
          ctx.fillStyle = i === 0 ? '#58cebe' : '#c0d8e4';
          ctx.font = i === 0 ? 'bold 11px monospace' : '11px monospace';
          ctx.fillText(line, px + 10, py + 8 + i * 18);
        });
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [chipModel, drag, hoverPin, hoverComp]);

  // ========== 坐标 ==========
  const s2c = useCallback((sx: number, sy: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const T = tfRef.current;
    return { x: (sx - r.left - r.width / 2 - T.ox) / T.scale, y: (sy - r.top - r.height / 2 - T.oy) / T.scale };
  }, []);

  const c2s = useCallback((cx: number, cy: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const T = tfRef.current;
    return { x: cx * T.scale + r.width / 2 + T.ox + r.left, y: cy * T.scale + r.height / 2 + T.oy + r.top };
  }, []);

  // 查找最近的引脚
  const findNearestPin = useCallback((cx: number, cy: number, maxDist: number = 15) => {
    const pins = chipPinsRef.current;
    const comps = compsRef.current;
    let nearest: { componentId: string; pinId: string; x: number; y: number; name: string } | null = null;
    let minDist = maxDist;

    for (const p of pins) {
      const d = Math.sqrt((cx - p.x) ** 2 + (cy - p.y) ** 2);
      if (d < minDist) { minDist = d; nearest = { componentId: '__chip__', pinId: p.id, x: p.x, y: p.y, name: p.name }; }
    }
    for (const c of comps) {
      for (const p of c.pins) {
        const pos = pinWorld(c, p);
        const d = Math.sqrt((cx - pos.x) ** 2 + (cy - pos.y) ** 2);
        if (d < minDist) { minDist = d; nearest = { componentId: c.id, pinId: p.id, x: pos.x, y: pos.y, name: `${c.name}.${p.name}` }; }
      }
    }
    return nearest;
  }, []);

  // ========== 鼠标事件 ==========
  const onDown = useCallback((e: React.MouseEvent) => {
    setCtxMenu(null);
    const p = s2c(e.clientX, e.clientY);

    if (e.button === 2) {
      const hitComp = [...compsRef.current].reverse().find(c => p.x >= c.x-c.w/2 && p.x <= c.x+c.w/2 && p.y >= c.y-c.h/2 && p.y <= c.y+c.h/2);
      if (hitComp) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, target: { type: 'component', id: hitComp.id } }); return; }
      // 检测右键点击连线 — 使用连线路径上的最近点距离
      const hitWire = wiresRef.current.find(w => {
        const fromComp = w.from.componentId === '__chip__' ? null : compsRef.current.find(c => c.id === w.from.componentId);
        const toComp = w.to.componentId === '__chip__' ? null : compsRef.current.find(c => c.id === w.to.componentId);
        const fromPinRaw = w.from.componentId === '__chip__' ? chipPinsRef.current.find(pp => pp.id === w.from.pinId) : fromComp?.pins.find(pp => pp.id === w.from.pinId);
        const toPinRaw = w.to.componentId === '__chip__' ? chipPinsRef.current.find(pp => pp.id === w.to.pinId) : toComp?.pins.find(pp => pp.id === w.to.pinId);
        if (!fromPinRaw || !toPinRaw) return false;
        const fromPos = w.from.componentId === '__chip__' ? fromPinRaw as Pin : pinWorld(fromComp!, fromPinRaw as CanvasComponent['pins'][0]);
        const toPos = w.to.componentId === '__chip__' ? toPinRaw as Pin : pinWorld(toComp!, toPinRaw as CanvasComponent['pins'][0]);
        if (!fromPos || !toPos) return false;

        // 推断引脚方向并获取连线路径
        const fromDir = w.from.componentId === '__chip__'
          ? (fromPinRaw as Pin).side
          : getPinSide(fromPinRaw as CanvasComponent['pins'][0]);
        const toDir = w.to.componentId === '__chip__'
          ? (toPinRaw as Pin).side
          : getPinSide(toPinRaw as CanvasComponent['pins'][0]);
        const waypoints = calculateWirePath(
          { x: fromPos.x, y: fromPos.y }, fromDir,
          fromComp ? { x: fromComp.x, y: fromComp.y, w: fromComp.w, h: fromComp.h } : null,
          { x: toPos.x, y: toPos.y }, toDir,
          toComp ? { x: toComp.x, y: toComp.y, w: toComp.w, h: toComp.h } : null,
          compsRef.current, w.from.componentId, w.to.componentId,
        );

        // 计算点到线段的最近距离
        function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
          const dx = x2 - x1, dy = y2 - y1;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) return Math.hypot(px - x1, py - y1);
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
          return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
        }

        let minDist = Infinity;
        for (let i = 0; i < waypoints.length - 1; i++) {
          const d = distToSegment(p.x, p.y, waypoints[i].x, waypoints[i].y, waypoints[i + 1].x, waypoints[i + 1].y);
          if (d < minDist) minDist = d;
        }
        return minDist < 12;
      });
      if (hitWire) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, target: { type: 'wire', id: hitWire.id } }); return; }
      return;
    }

    // 先检测元件body（优先级高于引脚）
    const hitComp = [...compsRef.current].reverse().find(c =>
      p.x >= c.x-c.w/2 && p.x <= c.x+c.w/2 && p.y >= c.y-c.h/2 && p.y <= c.y+c.h/2
    );
    if (hitComp) {
      e.preventDefault();
      // 按钮/开关：延迟单击切换，避免与双击冲突
      if ((hitComp.type === 'button' || hitComp.type === 'switch') && engineRef.current) {
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        clickTimerRef.current = setTimeout(() => {
          engineRef.current!.toggleButton(hitComp.id);
          forceUpdate(n => n + 1);
        }, 300);
        compsRef.current = compsRef.current.map(c => ({ ...c, selected: c.id === hitComp.id }));
        forceUpdate(n => n + 1);
        return;
      }
      compsRef.current = compsRef.current.map(c => ({ ...c, selected: c.id === hitComp.id }));
      forceUpdate(n => n + 1);
      // 收集连线信息
      const connections: Record<string, string> = {};
      for (const w of wiresRef.current) {
        if (w.from.componentId === hitComp.id) {
          const targetName = w.to.componentId === '__chip__'
            ? (chipPinsRef.current.find(p => p.id === w.to.pinId)?.name || w.to.pinId)
            : (compsRef.current.find(c => c.id === w.to.componentId)?.name || w.to.componentId);
          connections[w.from.pinId] = targetName;
        } else if (w.to.componentId === hitComp.id) {
          const targetName = w.from.componentId === '__chip__'
            ? (chipPinsRef.current.find(p => p.id === w.from.pinId)?.name || w.from.pinId)
            : (compsRef.current.find(c => c.id === w.from.componentId)?.name || w.from.componentId);
          connections[w.to.pinId] = targetName;
        }
      }
      onSelect({ type: 'component', id: hitComp.id, name: hitComp.name, properties: { type: hitComp.type, connections } });
      setDrag({ mode: 'move', sx: e.clientX, sy: e.clientY, sox: hitComp.x, soy: hitComp.y, tid: hitComp.id, wireFrom: undefined });
      return;
    }

    // 元件外才检测引脚连线
    const nearPin = findNearestPin(p.x, p.y, 20);
    if (nearPin) {
      setDrag({ mode: 'wire', sx: e.clientX, sy: e.clientY, sox: 0, soy: 0, tid: undefined, wireFrom: nearPin });
      return;
    }

    compsRef.current = compsRef.current.map(c => ({ ...c, selected: false }));
    forceUpdate(n => n + 1);
    onSelect(null);
    setDrag({ mode: 'pan', sx: e.clientX, sy: e.clientY, sox: tfRef.current.ox, soy: tfRef.current.oy, tid: undefined, wireFrom: undefined });
  }, [s2c, findNearestPin, onSelect]);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (drag.mode === 'pan') {
      tfRef.current = { ...tfRef.current, ox: drag.sox + e.clientX - drag.sx, oy: drag.soy + e.clientY - drag.sy };
    } else if (drag.mode === 'move' && drag.tid) {
      const dx = (e.clientX - drag.sx) / tfRef.current.scale;
      const dy = (e.clientY - drag.sy) / tfRef.current.scale;
      compsRef.current = compsRef.current.map(c =>
        c.id === drag.tid ? { ...c, x: Math.round((drag.sox + dx) / GRID) * GRID, y: Math.round((drag.soy + dy) / GRID) * GRID } : c
      );
    } else if (drag.mode === 'wire') {
      setDrag(prev => ({ ...prev, sx: e.clientX, sy: e.clientY }));
    }

    const p = s2c(e.clientX, e.clientY);

    // 悬停引脚检测
    const near = findNearestPin(p.x, p.y, 10);
    if (near) {
      const sp = c2s(near.x, near.y);
      const r = canvasRef.current?.getBoundingClientRect();
      setHoverPin({ x: sp.x - (r?.left || 0), y: sp.y - (r?.top || 0), name: near.name });
      setHoverComp(null);
      hoverCompRef.current = null;
    } else {
      setHoverPin(null);
      // 悬停元件检测
      const hitComp = [...compsRef.current].reverse().find(c =>
        p.x >= c.x - c.w / 2 - 4 && p.x <= c.x + c.w / 2 + 4 && p.y >= c.y - c.h / 2 - 4 && p.y <= c.y + c.h / 2 + 4
      );
      if (hitComp) {
        const sp = c2s(hitComp.x, hitComp.y);
        const r = canvasRef.current?.getBoundingClientRect();
        let details = '';
        if (hitComp.type === 'led') details = `PWM: ${Math.round(hitComp.simState.pwmDuty * 100)}%`;
        else if (hitComp.type === 'motor') details = `转速: ${Math.round(hitComp.simState.motorSpeed * 100)}%`;
        else if (hitComp.type === 'buzzer') details = hitComp.simState.buzzerActive ? `发声中 ${hitComp.simState.buzzerFreq}Hz` : '静音';
        else if (hitComp.type === 'resistor') details = '1kΩ';
        else if (hitComp.type === 'sensor') details = `ADC: ${hitComp.simState.adcValue} (${hitComp.simState.temperature}°C)`;
        setHoverComp({ x: sp.x - (r?.left || 0), y: sp.y - (r?.top || 0), name: hitComp.name, type: hitComp.type, details });
        hoverCompRef.current = { id: hitComp.id, name: hitComp.name, type: hitComp.type, x: hitComp.x, y: hitComp.y };
      } else {
        setHoverComp(null);
        hoverCompRef.current = null;
      }
    }
  }, [drag, s2c, findNearestPin, c2s]);

  const onUp = useCallback((e: React.MouseEvent) => {
    if (drag.mode === 'wire' && drag.wireFrom) {
      const p = s2c(e.clientX, e.clientY);
      const nearPin = findNearestPin(p.x, p.y, 25);
      if (nearPin && (nearPin.componentId !== drag.wireFrom.componentId || nearPin.pinId !== drag.wireFrom.pinId)) {
        const newWire: Wire = {
          id: `w${Date.now()}`,
          from: { componentId: drag.wireFrom.componentId, pinId: drag.wireFrom.pinId },
          to: { componentId: nearPin.componentId, pinId: nearPin.pinId },
          selected: false,
          current: 0,
        };
        wiresRef.current = [...wiresRef.current, newWire];
        markPinConnected(drag.wireFrom.componentId, drag.wireFrom.pinId, true);
        markPinConnected(nearPin.componentId, nearPin.pinId, true);
        engineRef.current.bindData(compsRef.current as any, wiresRef.current as any, chipPinsRef.current as any);
        debouncedSaveRef.current();
        forceUpdate(n => n + 1);
      }
    }
    setDrag({ mode: 'none', sx: 0, sy: 0, sox: 0, soy: 0, tid: undefined, wireFrom: undefined });
  }, [drag, s2c, findNearestPin]);


  // ========== 拖放新元件 ==========
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('component-type');
    if (!type) return;

    // 获取模板，没有则生成默认多引脚模板
    let tpl = COMPONENT_TEMPLATES[type];
    if (!tpl) {
      const defaultPins = getDefaultPins(type);
      tpl = { w: 48, h: 32, pins: defaultPins };
    }
    const p = s2c(e.clientX, e.clientY);
    const sx = Math.round(p.x / GRID) * GRID;
    const sy = Math.round(p.y / GRID) * GRID;

    const newComp: CanvasComponent = {
      id: `c${Date.now()}`,
      type,
      name: `${getComponentName(type)}${compsRef.current.filter(c => c.type === type).length + 1}`,
      x: sx, y: sy,
      w: tpl.w, h: tpl.h,
      rotation: 0, selected: false,
      pins: tpl.pins.map(p => ({ ...p, offsetX: p.ox, offsetY: p.oy, connected: false, level: 'floating' as const })),
      simState: { ...DEFAULT_SIM_STATE_ },
    };
    compsRef.current = [...compsRef.current, newComp];

    for (const pin of newComp.pins) {
      const pos = pinWorld({ x: sx, y: sy, rotation: 0 }, pin);
      const nearChipPin = findNearestPin(pos.x, pos.y, 40);
      if (nearChipPin && nearChipPin.componentId === '__chip__') {
        const wire: Wire = {
          id: `w${Date.now()}_${pin.id}`,
          from: { componentId: '__chip__', pinId: nearChipPin.pinId },
          to: { componentId: newComp.id, pinId: pin.id },
          selected: false,
          current: 0,
        };
        wiresRef.current = [...wiresRef.current, wire];
        markPinConnected('__chip__', nearChipPin.pinId, true);
        pin.connected = true;
      }
    }
    engineRef.current.bindData(compsRef.current as any, wiresRef.current as any, chipPinsRef.current as any);
    debouncedSaveRef.current();
    forceUpdate(n => n + 1);
  }, [s2c, findNearestPin]);

  // ========== 右键菜单 ==========
  const ctxAction = useCallback((act: string, target: { type: string; id: string }) => {
    setCtxMenu(null);
    if (act === 'delete') {
      wiresRef.current = wiresRef.current.filter(w => w.from.componentId !== target.id && w.to.componentId !== target.id);
      compsRef.current = compsRef.current.filter(c => c.id !== target.id);
      engineRef.current.bindData(compsRef.current as any, wiresRef.current as any, chipPinsRef.current as any);
      debouncedSaveRef.current();
      forceUpdate(n => n + 1); onSelect(null);
    } else if (act === 'delete-wire') {
      wiresRef.current = wiresRef.current.filter(w => w.id !== target.id);
      engineRef.current.bindData(compsRef.current as any, wiresRef.current as any, chipPinsRef.current as any);
      debouncedSaveRef.current();
      forceUpdate(n => n + 1);
    } else if (act === 'rotate') {
      compsRef.current = compsRef.current.map(c => c.id === target.id ? { ...c, rotation: (c.rotation + 90) % 360 } : c);
      debouncedSaveRef.current();
      forceUpdate(n => n + 1);
    }
  }, [onSelect]);

  // 非被动 wheel
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      tfRef.current = { ...tfRef.current, scale: Math.max(0.2, Math.min(5, tfRef.current.scale * (e.deltaY > 0 ? 0.95 : 1.05))) };
    };
    cvs.addEventListener('wheel', handler, { passive: false });
    return () => cvs.removeEventListener('wheel', handler);
  }, []);

  // ========== 绑定仿真引擎数据（响应 loadTemplateId / chipFamily 变化） ==========
  useEffect(() => {
    const engine = engineRef.current;
    engine.bindData(
      compsRef.current as any,
      wiresRef.current as any,
      chipPinsRef.current as any,
    );
    engine.setChipFamily(chipFamily, chipModel);
  }, [loadTemplateId, chipFamily, chipModel]);

  // 注册引擎事件监听（只挂一次）
  useEffect(() => {
    const engine = engineRef.current;
    // 初始绑定
    engine.bindData(
      compsRef.current as any,
      wiresRef.current as any,
      chipPinsRef.current as any,
    );

    // 状态变更时触发重绘
    const unsub = engine.onStateChanged(() => {
      forceUpdate(n => n + 1);
    });

    // UART 输出事件转发到全局事件（供 SerialMonitor 监听）
    const unsubUART = engine.onUARTOutput((output) => {
      window.dispatchEvent(new CustomEvent('chip-sim:uart-output', {
        detail: { data: output.data, timestamp: output.timestamp, baudRate: output.baudRate },
      }));
    });

    return () => { unsub(); unsubUART(); };
  }, []);

  // QEMU 仿真引脚状态监听
  useEffect(() => {
    const onSetPinLevel = (e: Event) => {
      const { pinId, level } = (e as CustomEvent).detail;
      // 更新芯片引脚电平
      chipPinsRef.current = chipPinsRef.current.map(p =>
        p.id === pinId ? { ...p, level } : p
      );
      // 同步更新连线另一端的元件引脚
      for (const w of wiresRef.current) {
        if (w.from.componentId === '__chip__' && w.from.pinId === pinId) {
          const toComp = compsRef.current.find(c => c.id === w.to.componentId);
          if (toComp) {
            toComp.pins = toComp.pins.map(p =>
              p.id === w.to.pinId ? { ...p, level } : p
            );
          }
        }
        if (w.to.componentId === '__chip__' && w.to.pinId === pinId) {
          const fromComp = compsRef.current.find(c => c.id === w.from.componentId);
          if (fromComp) {
            fromComp.pins = fromComp.pins.map(p =>
              p.id === w.from.pinId ? { ...p, level } : p
            );
          }
        }
      }
      forceUpdate(n => n + 1);
    };
    window.addEventListener('chip-sim:set-pin-level', onSetPinLevel);
    return () => window.removeEventListener('chip-sim:set-pin-level', onSetPinLevel);
  }, []);

  // 监听编译成功事件：解析代码 → 配置引脚行为 → 启动仿真
  useEffect(() => {
    const onCodeCompiled = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !engineRef.current) return;

      const { operations, chipFamily: family } = detail as {
        operations: Array<{ type: string; target: string; value?: string; raw: string }>;
        chipFamily: string;
      };

      // 将解析出的操作转换为引脚行为配置
      const toggles = operations.filter(op => op.type === 'gpio_write' && op.value === 'TOGGLE');
      const delays = operations.filter(op => op.type === 'delay');

      for (const op of operations) {
        if (op.type === 'gpio_write' && op.value === 'TOGGLE') {
          // Toggle → 先设为 blink，默认 500ms，后面如果有 delay 会覆盖
          const config: PinBehaviorConfig = { behavior: 'blink', blinkPeriod: 500 };
          engineRef.current.setPinBehavior(op.target, config);
        } else if (op.type === 'gpio_write') {
          // HIGH/LOW → 直接设置引脚值
          const isHigh = op.value === '1' || op.value === 'GPIO_PIN_SET' || op.value === 'HIGH';
          engineRef.current.setMCUPinMode(op.target, 'output');
          engineRef.current.setMCUPinValue(op.target, isHigh ? 1 : 0);
        } else if (op.type === 'uart_send') {
          // UART 发送
          const config: PinBehaviorConfig = {
            behavior: 'uart_send',
            uartData: op.value || 'Hello\n',
            uartBaudRate: 115200,
            uartTxInterval: 1000,
          };
          engineRef.current.setPinBehavior(op.target, config);
        } else if (op.type === 'pwm_set') {
          // PWM 输出
          const duty = parseInt(op.value || '128') / 255;
          const config: PinBehaviorConfig = {
            behavior: 'pwm_output',
            pwmDuty: Math.max(0, Math.min(1, duty)),
            pwmFreq: 1000,
          };
          engineRef.current.setPinBehavior(op.target, config);
        } else if (op.type === 'adc_read') {
          // ADC 读取
          const config: PinBehaviorConfig = {
            behavior: 'adc_read',
            adcValue: parseInt(op.value || '2048'),
          };
          engineRef.current.setPinBehavior(op.target, config);
        }
      }

      // 检测 while(1) 循环模式：如果有 gpio_toggle + delay 组合，用 delay 值覆盖 blink 周期
      if (toggles.length > 0 && delays.length > 0) {
        const interval = parseInt(delays[delays.length - 1].value || '500');
        for (const t of toggles) {
          const config: PinBehaviorConfig = {
            behavior: 'blink',
            blinkPeriod: interval,
            blinkDuty: 0.5,
          };
          engineRef.current.setPinBehavior(t.target, config);
        }
      }

      // 重新绑定画布数据到引擎
      engineRef.current.bindData(
        compsRef.current as any,
        wiresRef.current as any,
        chipPinsRef.current as any,
      );

      forceUpdate(n => n + 1);
    };

    const onStartSimulation = () => {
      if (engineRef.current && !engineRef.current.isRunning()) {
        // 确保绑定最新数据
        engineRef.current.bindData(
          compsRef.current as any,
          wiresRef.current as any,
          chipPinsRef.current as any,
        );
        engineRef.current.start();
        setSimRunning(true);
        setSimPaused(false);
      }
    };

    window.addEventListener('chip-sim:code-compiled', onCodeCompiled);
    window.addEventListener('chip-sim:start-simulation', onStartSimulation);

    return () => {
      window.removeEventListener('chip-sim:code-compiled', onCodeCompiled);
      window.removeEventListener('chip-sim:start-simulation', onStartSimulation);
    };
  }, []);

  return (
    <div className="webgl-canvas-wrapper">
      <canvas
        ref={canvasRef}
        className="webgl-canvas"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={() => {
          setHoverPin(null);
          setHoverComp(null);
          hoverCompRef.current = null;
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        onContextMenu={e => e.preventDefault()}
        onDoubleClick={(e) => {
          // 双击按钮类元件 → 取消延迟单击，切换状态
          const p = s2c(e.clientX, e.clientY);
          const hitComp = [...compsRef.current].reverse().find(c =>
            p.x >= c.x - c.w / 2 && p.x <= c.x + c.w / 2 && p.y >= c.y - c.h / 2 && p.y <= c.y + c.h / 2
          );
          if (hitComp && (hitComp.type === 'button' || hitComp.type === 'switch')) {
            if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
            engineRef.current.toggleButton(hitComp.id);
            forceUpdate(n => n + 1);
          }
        }}
        style={{ cursor: drag.mode === 'pan' ? 'grabbing' : drag.mode === 'wire' ? 'crosshair' : 'grab' }}
      />
      {/* 仿真控制按钮 */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', gap: 6, zIndex: 10,
      }}>
        <button
          onClick={handleSimStart}
          disabled={simRunning && !simPaused}
          title="开始仿真"
          style={simBtnStyle(simRunning && !simPaused)}
        >▶</button>
        <button
          onClick={handleSimPause}
          disabled={!simRunning || simPaused}
          title="暂停"
          style={simBtnStyle(!simRunning || simPaused)}
        >⏸</button>
        <button
          onClick={handleSimStep}
          title="单步执行"
          style={simBtnStyle(false)}
        >⏭</button>
        <button
          onClick={handleSimReset}
          title="重置"
          style={simBtnStyle(false)}
        >⏹</button>
        <button
          onClick={handleSave}
          title="保存电路"
          style={{
            ...simBtnStyle(false),
            borderColor: 'rgba(88,206,190,0.6)',
            background: 'rgba(42,74,90,0.9)',
          }}
        >💾</button>
      </div>

      {ctxMenu && (
        <div className="canvas-context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          {ctxMenu.target.type === 'wire' ? (
            <button onClick={() => ctxAction('delete-wire', ctxMenu.target)} className="danger">🗑️ 删除连线</button>
          ) : (
            <>
              <button onClick={() => ctxAction('rotate', ctxMenu.target)}>🔄 旋转</button>
              <hr />
              <button onClick={() => ctxAction('delete', ctxMenu.target)} className="danger">🗑️ 删除</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

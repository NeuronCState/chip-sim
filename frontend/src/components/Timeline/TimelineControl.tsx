/**
 * TimelineControl — 时间轴主控件
 *
 * 包含：播放/暂停、倍速、时间显示、拖拽滑块
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SignalEvent, WireType } from '../../core/simulation/SignalEventRecorder';
import './Timeline.css';

export interface TimelineControlProps {
  /** 当前时间 (ms) */
  currentTime: number;
  /** 总时间 (ms) */
  totalTime: number;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 是否正在录制 */
  isRecording: boolean;
  /** 当前倍速 */
  playbackSpeed: number;
  /** 事件列表（用于刻度条标记） */
  events: SignalEvent[];
  /** 播放/暂停 */
  onPlayPause: () => void;
  /** 停止 */
  onStop: () => void;
  /** 跳转到指定时间 */
  onSeek: (time: number) => void;
  /** 设置倍速 */
  onSpeedChange: (speed: number) => void;
  /** 切换录制 */
  onToggleRecord: () => void;
  /** 导出 CSV */
  onExportCSV: () => void;
  /** 导出 JSON */
  onExportJSON: () => void;
}

const SPEED_OPTIONS = [1, 2, 5, 10];

export function TimelineControl({
  currentTime,
  totalTime,
  isPlaying,
  isRecording,
  playbackSpeed,
  events,
  onPlayPause,
  onStop,
  onSeek,
  onSpeedChange,
  onToggleRecord,
  onExportCSV,
  onExportJSON,
}: TimelineControlProps) {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);

  /** 格式化时间 mm:ss.ms */
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  }, []);

  /** 计算滑块位置百分比 */
  const getPercent = useCallback((): number => {
    if (totalTime <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / totalTime) * 100));
  }, [currentTime, totalTime]);

  /** 从鼠标位置计算时间 */
  const getTimeFromPosition = useCallback((clientX: number): number => {
    if (!trackRef.current) return currentTime;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return percent * totalTime;
  }, [currentTime, totalTime]);

  /** 鼠标按下滑块 */
  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
  }, []);

  /** 点击轨道跳转 */
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    const time = getTimeFromPosition(e.clientX);
    onSeek(time);
  }, [isDragging, getTimeFromPosition, onSeek]);

  /** 全局鼠标移动 */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getTimeFromPosition, onSeek]);

  /** 键盘快捷键 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSeek(Math.max(0, currentTime - 100));
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSeek(Math.min(totalTime, currentTime + 100));
          break;
        case 'Home':
          e.preventDefault();
          onSeek(0);
          break;
        case 'End':
          e.preventDefault();
          onSeek(totalTime);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, totalTime, onPlayPause, onSeek]);

  return (
    <div className="timeline-container">
      {/* 主控制栏 */}
      <div className="timeline-controls">
        {/* 录制按钮 */}
        <button
          className={`timeline-btn ${isRecording ? 'recording' : ''}`}
          onClick={onToggleRecord}
          title={isRecording ? '停止录制' : '开始录制'}
        >
          {isRecording ? '■' : '●'}
        </button>

        {/* 播放/暂停 */}
        <button
          className="timeline-btn"
          onClick={onPlayPause}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* 停止 */}
        <button
          className="timeline-btn"
          onClick={onStop}
          title="停止"
        >
          ◼
        </button>

        {/* 时间显示 */}
        <div className="timeline-time">
          <span className="timeline-time-current">{formatTime(currentTime)}</span>
          <span className="timeline-time-total">/ {formatTime(totalTime)}</span>
        </div>

        {/* 倍速选择 */}
        <div className="timeline-speed">
          {SPEED_OPTIONS.map(speed => (
            <button
              key={speed}
              className={`timeline-speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
              onClick={() => onSpeedChange(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* 导出按钮 */}
        <div className="timeline-export">
          <button
            className="timeline-btn"
            onClick={onExportCSV}
            title="导出 CSV"
            style={{ width: 'auto', padding: '0 8px', fontSize: 10 }}
          >
            CSV
          </button>
          <button
            className="timeline-btn"
            onClick={onExportJSON}
            title="导出 JSON"
            style={{ width: 'auto', padding: '0 8px', fontSize: 10 }}
          >
            JSON
          </button>
        </div>
      </div>

      {/* 时间刻度条 */}
      <div className="timeline-ruler">
        <RulerMarks totalTime={totalTime} />
      </div>

      {/* 拖拽滑块 */}
      <div className="timeline-scrubber">
        {/* 事件标记 */}
        <div className="timeline-event-markers">
          {events.map((event, i) => {
            if (totalTime <= 0) return null;
            const left = `${(event.timestamp / totalTime) * 100}%`;
            return (
              <div
                key={`${event.timestamp}-${i}`}
                className={`timeline-event-marker ${event.wireType}`}
                style={{ left }}
              />
            );
          })}
        </div>

        {/* 轨道 */}
        <div
          ref={trackRef}
          className="timeline-scrubber-track"
          onClick={handleTrackClick}
        >
          {/* 进度填充 */}
          <div
            className="timeline-scrubber-fill"
            style={{ width: `${getPercent()}%` }}
          />
        </div>

        {/* 滑块手柄 */}
        <div
          className={`timeline-scrubber-thumb ${isDragging ? 'dragging' : ''}`}
          style={{ left: `calc(12px + ${getPercent()}% * (100% - 24px) / 100)` }}
          onMouseDown={handleThumbMouseDown}
        />
      </div>
    </div>
  );
}

// ==================== 时间刻度标记 ====================

interface RulerMarksProps {
  totalTime: number;
}

function RulerMarks({ totalTime }: RulerMarksProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalTime <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.parentElement?.clientWidth || 800;
    const height = canvas.clientHeight;

    // 设置 canvas 尺寸
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // 清除画布
    ctx.clearRect(0, 0, width, height);

    // 计算刻度间隔
    const totalSeconds = totalTime / 1000;
    let interval: number;
    let subInterval: number;

    if (totalSeconds <= 10) {
      interval = 1; // 1 秒
      subInterval = 0.1;
    } else if (totalSeconds <= 60) {
      interval = 5; // 5 秒
      subInterval = 1;
    } else if (totalSeconds <= 300) {
      interval = 30; // 30 秒
      subInterval = 5;
    } else {
      interval = 60; // 1 分钟
      subInterval = 10;
    }

    // 绘制次刻度
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let t = 0; t <= totalSeconds; t += subInterval) {
      const x = (t / totalSeconds) * width;
      ctx.beginPath();
      ctx.moveTo(x, height - 6);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 绘制主刻度和标签
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px SF Mono, Fira Code, monospace';
    ctx.textAlign = 'center';

    for (let t = 0; t <= totalSeconds; t += interval) {
      const x = (t / totalSeconds) * width;

      // 主刻度线
      ctx.beginPath();
      ctx.moveTo(x, height - 12);
      ctx.lineTo(x, height);
      ctx.stroke();

      // 标签
      const minutes = Math.floor(t / 60);
      const seconds = Math.floor(t % 60);
      const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      ctx.fillText(label, x, height - 16);
    }
  }, [totalTime]);

  return (
    <canvas
      ref={canvasRef}
      className="timeline-ruler-canvas"
    />
  );
}

export default TimelineControl;

/**
 * EventHistory — 事件历史列表
 *
 * 类似 Wireshark 的事件列表视图
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import type { SignalEvent } from '../../core/simulation/SignalEventRecorder';
import './Timeline.css';

export interface EventHistoryProps {
  /** 事件列表 */
  events: SignalEvent[];
  /** 当前选中的时间 */
  currentTime: number;
  /** 是否自动滚动到最新事件 */
  autoScroll?: boolean;
  /** 点击事件回调 */
  onEventClick?: (event: SignalEvent) => void;
  /** 过滤协议类型 */
  filterTypes?: Set<string>;
}

export function EventHistory({
  events,
  currentTime,
  autoScroll = true,
  onEventClick,
  filterTypes,
}: EventHistoryProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(autoScroll);

  /** 格式化时间 */
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  }, []);

  /** 过滤事件 */
  const filteredEvents = filterTypes && filterTypes.size > 0
    ? events.filter(e => filterTypes.has(e.wireType))
    : events;

  /** 自动滚动到当前时间的事件 */
  useEffect(() => {
    if (!autoScrollEnabled || !listRef.current) return;

    // 找到当前时间之前的最后一个事件
    const currentIndex = filteredEvents.findIndex((e, i) => {
      const nextEvent = filteredEvents[i + 1];
      return e.timestamp <= currentTime && (!nextEvent || nextEvent.timestamp > currentTime);
    });

    if (currentIndex >= 0) {
      const element = listRef.current.children[currentIndex] as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentTime, filteredEvents, autoScrollEnabled]);

  /** 检测用户手动滚动 */
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setAutoScrollEnabled(isAtBottom);
  }, []);

  /** 找到当前时间对应的事件索引 */
  const getCurrentEventIndex = useCallback((): number => {
    for (let i = filteredEvents.length - 1; i >= 0; i--) {
      if (filteredEvents[i].timestamp <= currentTime) {
        return i;
      }
    }
    return -1;
  }, [filteredEvents, currentTime]);

  const currentEventIndex = getCurrentEventIndex();

  return (
    <div className="timeline-event-history">
      {/* 头部 */}
      <div className="timeline-event-header">
        <span className="timeline-event-header-title">事件历史</span>
        <span className="timeline-event-header-count">
          {filteredEvents.length} 条事件
          {filterTypes && filterTypes.size > 0 && ` (已过滤)`}
        </span>
      </div>

      {/* 事件列表 */}
      <div
        ref={listRef}
        className="timeline-event-list"
        onScroll={handleScroll}
      >
        {filteredEvents.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: 11,
          }}>
            暂无事件记录
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <div
              key={`${event.timestamp}-${index}`}
              className={`timeline-event-item ${event.wireType} ${index === currentEventIndex ? 'current' : ''}`}
              onClick={() => onEventClick?.(event)}
              data-event-index={index}
            >
              <span className="timeline-event-time">
                {formatTime(event.timestamp)}
              </span>
              <span className={`timeline-event-type ${event.wireType}`}>
                {event.wireType.toUpperCase()}
              </span>
              <span className="timeline-event-command" title={event.decodedCommand}>
                {event.decodedCommand}
              </span>
              <span className="timeline-event-pin">
                {event.pinName}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EventHistory;

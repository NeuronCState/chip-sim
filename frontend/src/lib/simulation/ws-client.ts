/**
 * WebSocket 客户端封装
 * 提供自动重连、消息序列化/反序列化、心跳检测
 */

import type { ClientMessage, ServerMessage } from '../../types/message';
import { ClientMessageType } from '../../types/message';

/** WebSocket 客户端配置 */
export interface WSClientConfig {
  /** 服务端地址 */
  url: string;
  /** 自动重连 */
  autoReconnect: boolean;
  /** 重连间隔 (ms) */
  reconnectInterval: number;
  /** 最大重连次数 */
  maxReconnectAttempts: number;
  /** 心跳间隔 (ms) */
  heartbeatInterval: number;
}

/** WebSocket 连接状态 */
export const WSState = {
  Disconnected: 'disconnected',
  Connecting: 'connecting',
  Connected: 'connected',
  Reconnecting: 'reconnecting',
} as const;
export type WSState = (typeof WSState)[keyof typeof WSState];

/** 消息处理器类型 */
export type MessageHandler = (message: ServerMessage) => void;

/** 默认配置 */
const DEFAULT_CONFIG: WSClientConfig = {
  url: `ws://${window.location.host}/ws`,
  autoReconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
};

/**
 * WebSocket 客户端类
 *
 * 使用示例：
 * ```ts
 * const client = new SimulationWSClient({ url: `ws://${window.location.host}/ws` });
 * client.onMessage((msg) => console.log(msg));
 * client.connect();
 * client.send({ type: ClientMessageType.Ping, id: '1', payload: { timestamp: Date.now() } });
 * ```
 */
export class SimulationWSClient {
  private ws: WebSocket | null = null;
  private config: WSClientConfig;
  private state: WSState = WSState.Disconnected;
  private reconnectCount = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private handlers: MessageHandler[] = [];
  private stateHandlers: ((state: WSState) => void)[] = [];

  constructor(config: Partial<WSClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 获取当前连接状态 */
  getState(): WSState {
    return this.state;
  }

  /** 注册消息处理器 */
  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /** 注册状态变更处理器 */
  onStateChange(handler: (state: WSState) => void): () => void {
    this.stateHandlers.push(handler);
    return () => {
      this.stateHandlers = this.stateHandlers.filter((h) => h !== handler);
    };
  }

  /** 连接到服务端 */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setState(WSState.Connecting);

    try {
      this.ws = new WebSocket(this.config.url);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  /** 断开连接 */
  disconnect(): void {
    this.config.autoReconnect = false;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState(WSState.Disconnected);
  }

  /** 发送消息 */
  send(message: ClientMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Not connected, message not sent:', message.type);
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  /** 发送 Ping */
  sendPing(): void {
    this.send({
      type: ClientMessageType.Ping,
      id: `ping-${Date.now()}`,
      payload: { timestamp: Date.now() },
    });
  }

  // ==================== 内部方法 ====================

  private handleOpen(): void {
    console.log('[WS] Connected to', this.config.url);
    this.reconnectCount = 0;
    this.setState(WSState.Connected);
    this.startHeartbeat();
  }

  private handleClose(): void {
    console.log('[WS] Disconnected');
    this.stopHeartbeat();
    this.setState(WSState.Disconnected);
    this.scheduleReconnect();
  }

  private handleError(event: Event): void {
    console.error('[WS] Error:', event);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: ServerMessage = JSON.parse(event.data);
      this.handlers.forEach((handler) => handler(message));
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  }

  private setState(state: WSState): void {
    this.state = state;
    this.stateHandlers.forEach((handler) => handler(state));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.config.autoReconnect) return;
    if (this.reconnectCount >= this.config.maxReconnectAttempts) {
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }

    this.reconnectCount++;
    this.setState(WSState.Reconnecting);
    console.log(
      `[WS] Reconnecting in ${this.config.reconnectInterval}ms (attempt ${this.reconnectCount}/${this.config.maxReconnectAttempts})`
    );

    setTimeout(() => this.connect(), this.config.reconnectInterval);
  }
}

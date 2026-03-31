/**
 * QEMU WebSocket 客户端
 * 连接后端 /ws/qemu 端点，接收仿真事件，发送控制命令
 */

import type { QEMUEvent } from './events';

export interface QEMUClientOptions {
  host?: string;
  port?: number;
  onEvent?: (event: QEMUEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export class QEMUClient {
  private ws: WebSocket | null = null;
  private options: Required<QEMUClientOptions>;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private destroyed = false;

  constructor(options: QEMUClientOptions = {}) {
    this.options = {
      host: options.host ?? 'localhost',
      port: options.port ?? 8006,
      onEvent: options.onEvent ?? (() => {}),
      onConnect: options.onConnect ?? (() => {}),
      onDisconnect: options.onDisconnect ?? (() => {}),
      onError: options.onError ?? console.error,
    };
  }

  connect(): void {
    if (this.destroyed || this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${this.options.host}:${this.options.port}/ws/qemu`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.options.onError(e as Error);
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.options.onConnect();
    };

    this.ws.onmessage = (event) => {
      try {
        const data: QEMUEvent = JSON.parse(event.data);
        this.options.onEvent(data);
      } catch (e) {
        this.options.onError(new Error(`解析事件失败: ${e}`));
      }
    };

    this.ws.onclose = () => {
      this.options.onDisconnect();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.options.onError(new Error('WebSocket 连接错误'));
    };
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(command: string, payload?: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.options.onError(new Error('WebSocket 未连接'));
      return;
    }
    this.ws.send(JSON.stringify({ command, payload }));
  }

  startFirmware(firmwarePath: string): void {
    this.send('start', { firmware: firmwarePath });
  }

  pause(): void { this.send('pause'); }
  resume(): void { this.send('resume'); }
  step(): void { this.send('step'); }
  stop(): void { this.send('stop'); }

  sendToUART(data: string): void {
    this.send('uart_send', { data });
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.options.onError(new Error('重连次数超限'));
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * WebSocket 连接 Hook
 * 提供 React 组件中使用 WebSocket 的便捷方式
 * 支持重连状态追踪、重连次数和手动重连
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  SimulationWSClient,
  WSState,
} from '../lib/simulation/ws-client';
import type { ClientMessage, ServerMessage } from '../types/message';

/**
 * 使用 WebSocket 连接
 * @param url WebSocket 服务端地址（默认 ws://localhost:8080/ws）
 */
export function useWebSocket(url?: string) {
  const clientRef = useRef<SimulationWSClient | null>(null);
  const [state, setState] = useState<WSState>(WSState.Disconnected);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [maxReconnectAttempts] = useState(5);

  useEffect(() => {
    const client = new SimulationWSClient(
      url ? { url } : undefined
    );

    client.onStateChange((newState) => {
      setState(newState);
      // 追踪重连次数
      if (newState === WSState.Reconnecting) {
        setReconnectAttempt((prev) => prev + 1);
      } else if (newState === WSState.Connected) {
        setReconnectAttempt(0);
      }
    });

    client.onMessage((msg) => {
      setLastMessage(msg);
      setMessages((prev) => [...prev.slice(-99), msg]); // 保留最近 100 条
    });

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [url]);

  /** 发送消息 */
  const send = useCallback((message: ClientMessage) => {
    clientRef.current?.send(message);
  }, []);

  /** 手动发送 Ping */
  const ping = useCallback(() => {
    clientRef.current?.sendPing();
  }, []);

  /** 手动连接 */
  const connect = useCallback(() => {
    setReconnectAttempt(0);
    clientRef.current?.connect();
  }, []);

  /** 手动断开 */
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  return {
    state,
    lastMessage,
    messages,
    send,
    ping,
    connect,
    disconnect,
    isConnected: state === WSState.Connected,
    isReconnecting: state === WSState.Reconnecting,
    isConnecting: state === WSState.Connecting,
    reconnectAttempt,
    maxReconnectAttempts,
  };
}

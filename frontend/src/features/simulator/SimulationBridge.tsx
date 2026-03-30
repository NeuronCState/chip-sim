/**
 * 仿真桥接组件
 * 订阅 WebSocket 消息并同步到 circuit store
 * 处理断线重连提示、仿真错误和仿真进度
 */

import { useEffect, useRef } from 'react';
import { useCircuitStore } from '../../stores/circuit-store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { WSState } from '../../lib/simulation/ws-client';
import { ServerMessageType } from '../../types/message';
import { toast } from '../../stores/toast-store';
import type {
  SimulationDataMessage,
  SimulationCompleteMessage,
  SimulationErrorMessage,
  StatusUpdateMessage,
} from '../../types/message';

/**
 * SimulationBridge 将 WS 消息同步到 store
 * 应在 EditorPage 中渲染，与 useWebSocket 共享同一连接
 */
export function SimulationBridge() {
  const { lastMessage, state: wsState, reconnectAttempt, maxReconnectAttempts } = useWebSocket();
  const setSimulationResult = useCircuitStore(s => s.setSimulationResult);
  const setIsSimulating = useCircuitStore(s => s.setIsSimulating);
  const setWsError = useCircuitStore(s => s.setWsError);
  const setSimLoading = useCircuitStore(s => s.setSimLoading);
  const prevResultRef = useRef(useCircuitStore.getState().simulationResult);
  const prevWsStateRef = useRef(wsState);

  // Track WS state changes for error/reconnect display
  useEffect(() => {
    if (wsState === WSState.Reconnecting) {
      const msg = `连接断开，正在尝试重连... (${reconnectAttempt}/${maxReconnectAttempts})`;
      setWsError(msg);
      setSimLoading(true);

      // 重连耗尽时给出明确提示
      if (reconnectAttempt >= maxReconnectAttempts) {
        toast.error('重连失败，已达到最大重试次数。请检查后端服务后手动重新连接。', 0);
      }
    } else if (wsState === WSState.Connected) {
      // 重连成功提示
      if (prevWsStateRef.current === WSState.Reconnecting) {
        toast.success('已重新连接到服务器');
      }
      // Clear WS error on successful reconnect
      const current = useCircuitStore.getState().wsError;
      if (current && (current.includes('重连') || current.includes('断开'))) {
        setWsError(null);
      }
      setSimLoading(false);
    } else if (wsState === WSState.Disconnected && prevWsStateRef.current === WSState.Connected) {
      setWsError('WebSocket 连接已断开');
      toast.warning('与仿真服务器的连接已断开');
    }
    prevWsStateRef.current = wsState;
  }, [wsState, reconnectAttempt, maxReconnectAttempts, setWsError, setSimLoading]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case ServerMessageType.SimulationData: {
        const incoming = (lastMessage as SimulationDataMessage).payload;
        const prev = prevResultRef.current;
        if (prev && prev.projectId === incoming.projectId) {
          const mergedChannels = [...prev.channels];
          for (const newCh of incoming.channels) {
            const idx = mergedChannels.findIndex(c => c.name === newCh.name);
            if (idx >= 0) {
              mergedChannels[idx] = { ...mergedChannels[idx], ...newCh };
            } else {
              mergedChannels.push(newCh);
            }
          }
          setSimulationResult({ ...prev, channels: mergedChannels, status: 'running' });
        } else {
          setSimulationResult(incoming);
        }
        prevResultRef.current = useCircuitStore.getState().simulationResult;
        setSimLoading(false);
        break;
      }

      case ServerMessageType.SimulationComplete: {
        const { result } = (lastMessage as SimulationCompleteMessage).payload;
        setSimulationResult(result);
        setIsSimulating(false);
        setSimLoading(false);
        prevResultRef.current = result;
        toast.success('仿真已完成');
        break;
      }

      case ServerMessageType.SimulationError: {
        const { projectId: errProjectId, error } = (lastMessage as SimulationErrorMessage).payload;
        const prev = prevResultRef.current;
        setSimulationResult(
          prev
            ? { ...prev, status: 'error', error }
            : {
                projectId: errProjectId,
                timestamp: Date.now(),
                analysisType: 'dc' as const,
                channels: [],
                status: 'error' as const,
                error,
              }
        );
        setIsSimulating(false);
        setSimLoading(false);
        // Also set the wsError for inline display
        setWsError(`仿真错误: ${error}`);
        // 显示诊断提示
        toast.error(`仿真失败：${error}`, 6000);
        break;
      }

      case ServerMessageType.StatusUpdate: {
        const { status } = (lastMessage as StatusUpdateMessage).payload;
        if (status === 'simulating') {
          setIsSimulating(true);
          setSimLoading(false);
        }
        break;
      }

      default:
        break;
    }
  }, [lastMessage, setSimulationResult, setIsSimulating, setWsError, setSimLoading]);

  return null; // Headless bridge component
}

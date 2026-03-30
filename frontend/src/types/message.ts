/**
 * WebSocket 消息协议类型定义
 * 定义前后端通信的所有消息格式
 */

import type { SimulationConfig, SimulationResult, CircuitComponent, CircuitNode, Wire } from './circuit';

// ==================== 消息类型（const object 模式） ====================

/** 客户端→服务端消息类型 */
export const ClientMessageType = {
  Ping: 'ping',
  StartSimulation: 'start_simulation',
  StopSimulation: 'stop_simulation',
  UpdateParams: 'update_params',
  SubmitCircuit: 'submit_circuit',
} as const;
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType];

/** 服务端→客户端消息类型 */
export const ServerMessageType = {
  Pong: 'pong',
  SimulationData: 'simulation_data',
  SimulationComplete: 'simulation_complete',
  SimulationError: 'simulation_error',
  StatusUpdate: 'status_update',
} as const;
export type ServerMessageType = (typeof ServerMessageType)[keyof typeof ServerMessageType];

// ==================== 客户端消息 ====================

/** 基础客户端消息 */
export interface ClientMessage {
  type: ClientMessageType;
  id: string; // 消息唯一 ID，用于匹配响应
  payload: unknown;
}

/** Ping 消息 */
export interface PingMessage extends ClientMessage {
  type: typeof ClientMessageType.Ping;
  payload: { timestamp: number };
}

/** 启动仿真消息 */
export interface StartSimulationMessage extends ClientMessage {
  type: typeof ClientMessageType.StartSimulation;
  payload: {
    projectId: string;
    config: SimulationConfig;
    /** 电路数据（可选，包含当前电路拓扑） */
    circuit?: {
      id: string;
      name: string;
      components: CircuitComponent[];
      nodes: CircuitNode[];
      wires: Wire[];
    };
  };
}

/** 停止仿真消息 */
export interface StopSimulationMessage extends ClientMessage {
  type: typeof ClientMessageType.StopSimulation;
  payload: { projectId: string };
}

// ==================== 服务端消息 ====================

/** 基础服务端消息 */
export interface ServerMessage {
  type: ServerMessageType;
  id?: string; // 对应请求的 ID
  payload: unknown;
}

/** Pong 响应 */
export interface PongMessage extends ServerMessage {
  type: typeof ServerMessageType.Pong;
  payload: { timestamp: number; serverTime: number };
}

/** 仿真数据推送 */
export interface SimulationDataMessage extends ServerMessage {
  type: typeof ServerMessageType.SimulationData;
  payload: SimulationResult;
}

/** 仿真完成通知 */
export interface SimulationCompleteMessage extends ServerMessage {
  type: typeof ServerMessageType.SimulationComplete;
  payload: {
    projectId: string;
    result: SimulationResult;
  };
}

/** 仿真错误通知 */
export interface SimulationErrorMessage extends ServerMessage {
  type: typeof ServerMessageType.SimulationError;
  payload: {
    projectId: string;
    error: string;
    code: number;
  };
}

/** 服务端状态推送 */
export interface StatusUpdateMessage extends ServerMessage {
  type: typeof ServerMessageType.StatusUpdate;
  payload: {
    status: string;
    details?: Record<string, unknown>;
  };
}

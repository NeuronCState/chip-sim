/**
 * 电路模型工具函数
 * 提供创建、验证、操作电路元件和节点的工具方法
 */

import type {
  CircuitComponent,
  CircuitNode,
  Wire,
  ComponentType,
  ComponentPort,
  Point,
} from '../../types/circuit';
import { NodeType, WireStatus } from '../../types/circuit';

/** 生成唯一 ID */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 创建新的电路元件 */
export function createComponent(
  type: ComponentType,
  name: string,
  position: Point,
  value: number,
  unit: string,
  ports: Omit<ComponentPort, 'id'>[]
): CircuitComponent {
  return {
    id: generateId(),
    type,
    name,
    position,
    rotation: 0,
    value: { value, unit },
    ports: ports.map((p) => ({ ...p, id: generateId() })),
  };
}

/** 创建新的电路节点 */
export function createNode(
  name: string,
  position: Point,
  type: NodeType = NodeType.Normal
): CircuitNode {
  return {
    id: generateId(),
    name,
    type,
    position,
    connectedPorts: [],
  };
}

/** 创建接地节点 */
export function createGroundNode(position: Point): CircuitNode {
  return createNode('GND', position, NodeType.Ground);
}

/** 创建连线 */
export function createWire(
  fromComponentId: string,
  fromPortId: string,
  toComponentId: string,
  toPortId: string,
  points: Wire['points'] = []
): Wire {
  return {
    id: generateId(),
    fromComponentId,
    fromPortId,
    toComponentId,
    toPortId,
    points,
    status: WireStatus.Connected,
  };
}

/** 根据旋转角度获取端口绝对坐标 */
export function getPortAbsolutePosition(
  component: CircuitComponent,
  portId: string
): Point | null {
  const port = component.ports.find((p) => p.id === portId);
  if (!port) return null;

  const rad = (component.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    x: component.position.x + port.offset.x * cos - port.offset.y * sin,
    y: component.position.y + port.offset.x * sin + port.offset.y * cos,
  };
}

/** 获取元件所有端口的绝对坐标 */
export function getAllPortPositions(
  component: CircuitComponent
): Array<{ portId: string; position: Point }> {
  return component.ports.map((port) => {
    const rad = (component.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      portId: port.id,
      position: {
        x: component.position.x + port.offset.x * cos - port.offset.y * sin,
        y: component.position.y + port.offset.x * sin + port.offset.y * cos,
      },
    };
  });
}

/** 查找最近的端口 */
export function findNearestPort(
  canvasX: number,
  canvasY: number,
  components: CircuitComponent[],
  maxDistance: number = 15
): { componentId: string; portId: string; position: Point } | null {
  let nearest: { componentId: string; portId: string; position: Point } | null = null;
  let minDist = maxDistance;

  for (const comp of components) {
    const ports = getAllPortPositions(comp);
    for (const { portId, position } of ports) {
      const dist = Math.hypot(canvasX - position.x, canvasY - position.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = { componentId: comp.id, portId, position };
      }
    }
  }

  return nearest;
}

/** 检查节点是否为接地节点 */
export function isGroundNode(node: CircuitNode): boolean {
  return node.type === NodeType.Ground;
}

/** 查找连接到指定节点的所有元件 */
export function findComponentsConnectedToNode(
  nodeId: string,
  components: CircuitComponent[],
  nodes: CircuitNode[]
): CircuitComponent[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  return components.filter((comp) =>
    comp.ports.some((port) => node.connectedPorts.includes(port.id))
  );
}

/** 对坐标进行网格吸附 */
export function snapToGrid(x: number, y: number, gridSize: number = 20): Point {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

/** 检查点是否在元件边界内 */
export function isPointInComponent(
  x: number,
  y: number,
  component: CircuitComponent,
  padding: number = 5
): boolean {
  const halfW = 30 + padding;
  const halfH = 20 + padding;
  const dx = x - component.position.x;
  const dy = y - component.position.y;

  // 考虑旋转
  const rad = (-component.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH;
}

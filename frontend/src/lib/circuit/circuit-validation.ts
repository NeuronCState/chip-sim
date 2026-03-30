/**
 * 电路验证模块
 * 提供电路完整性检查和错误报告
 */

import type {
  CircuitComponent,
  CircuitNode,
  Wire,
  ValidationMessage,
} from '../../types/circuit';
import { ComponentType, ValidationSeverity } from '../../types/circuit';

/**
 * 执行完整的电路验证
 */
export function validateCircuit(
  components: CircuitComponent[],
  _nodes: CircuitNode[],
  wires: Wire[]
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // 1. 检查是否有元件
  if (components.length === 0) {
    messages.push({
      severity: ValidationSeverity.Info,
      message: '电路为空，请添加元件',
      targetType: 'circuit',
    });
    return messages;
  }

  // 2. 检查是否有接地
  const hasGround = components.some(
    (c) => c.type === ComponentType.Ground
  );
  if (!hasGround) {
    messages.push({
      severity: ValidationSeverity.Error,
      message: '电路缺少接地（GND）元件',
      targetType: 'circuit',
    });
  }

  // 3. 检查连线是否完整
  if (wires.length === 0) {
    messages.push({
      severity: ValidationSeverity.Warning,
      message: '电路中没有任何连线',
      targetType: 'circuit',
    });
  }

  // 4. 检查每个元件的端口连接情况
  const portConnectionMap = new Map<string, boolean>();

  // 先记录所有端口
  for (const comp of components) {
    for (const port of comp.ports) {
      portConnectionMap.set(port.id, false);
    }
  }

  // 标记已连接的端口
  for (const wire of wires) {
    portConnectionMap.set(wire.fromPortId, true);
    portConnectionMap.set(wire.toPortId, true);
  }

  // 统计未连接端口
  const unconnectedPorts: Array<{ componentName: string; componentId: string }> = [];
  for (const comp of components) {
    const hasUnconnected = comp.ports.some(
      (port) => !portConnectionMap.get(port.id)
    );
    if (hasUnconnected) {
      unconnectedPorts.push({ componentName: comp.name, componentId: comp.id });
    }
  }

  if (unconnectedPorts.length > 0) {
    const names = unconnectedPorts.map((p) => p.componentName).join('、');
    messages.push({
      severity: ValidationSeverity.Warning,
      message: `以下元件有未连接的端口：${names}`,
      targetType: 'circuit',
    });
  }

  // 5. 检查是否有孤立元件（没有任何连线的元件）
  const connectedComponentIds = new Set<string>();
  for (const wire of wires) {
    connectedComponentIds.add(wire.fromComponentId);
    connectedComponentIds.add(wire.toComponentId);
  }

  const isolatedComponents = components.filter(
    (c) => !connectedComponentIds.has(c.id)
  );

  if (isolatedComponents.length > 0) {
    const names = isolatedComponents.map((c) => c.name).join('、');
    messages.push({
      severity: ValidationSeverity.Warning,
      message: `以下元件未连接到任何其他元件：${names}`,
      targetType: 'circuit',
    });
  }

  // 6. 检查是否连接成有效网络（至少有一个接地元件连接到其他有源元件）
  const hasSource = components.some(
    (c) =>
      c.type === ComponentType.DCSource ||
      c.type === ComponentType.ACSource ||
      c.type === ComponentType.VoltageSource ||
      c.type === ComponentType.CurrentSource
  );
  if (!hasSource && components.length > 0) {
    messages.push({
      severity: ValidationSeverity.Warning,
      message: '电路中没有电源元件',
      targetType: 'circuit',
    });
  }

  // 7. 如果一切 OK
  if (messages.length === 0) {
    messages.push({
      severity: ValidationSeverity.Info,
      message: '电路结构完整',
      targetType: 'circuit',
    });
  }

  return messages;
}

/**
 * 检查某个连线是否有效（端口是否仍然存在）
 */
export function validateWire(
  wire: Wire,
  components: CircuitComponent[]
): boolean {
  const fromComp = components.find((c) => c.id === wire.fromComponentId);
  const toComp = components.find((c) => c.id === wire.toComponentId);

  if (!fromComp || !toComp) return false;

  const fromPort = fromComp.ports.find((p) => p.id === wire.fromPortId);
  const toPort = toComp.ports.find((p) => p.id === wire.toPortId);

  return !!fromPort && !!toPort;
}

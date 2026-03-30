package handler

import (
	"encoding/json"
	"fmt"
	"time"

	"chip-sim/internal/spice"
	"chip-sim/pkg/types"
)

// toCircuitData 将 ParseResult 转换为前端友好的电路数据
func toCircuitData(result *spice.ParseResult) *CircuitData {
	project := result.Project
	data := &CircuitData{
		ID:   project.ID,
		Name: result.Title,
	}

	if data.ID == "" {
		data.ID = "spice-import-" + fmt.Sprintf("%d", time.Now().Unix())
	}

	// 转换元件
	data.Components = make([]map[string]any, 0, len(project.Components))
	for _, comp := range project.Components {
		m := map[string]any{
			"id":       comp.ID,
			"type":     string(comp.Type),
			"name":     comp.Name,
			"position": comp.Position,
			"rotation": comp.Rotation,
			"value":    comp.Value,
			"ports":    comp.Ports,
		}
		if len(comp.Params) > 0 {
			m["params"] = comp.Params
		}
		data.Components = append(data.Components, m)
	}

	// 转换节点
	data.Nodes = make([]map[string]any, 0, len(project.Nodes))
	for _, node := range project.Nodes {
		data.Nodes = append(data.Nodes, map[string]any{
			"id":       node.ID,
			"name":     node.Name,
			"type":     string(node.Type),
			"position": node.Position,
		})
	}

	// 转换仿真配置
	if project.SimulationConfig.Enabled {
		data.SimulationConfig = map[string]any{
			"enabled":  true,
			"analysis": project.SimulationConfig.Analysis,
		}
	}

	return data
}

// fromExportRequest 从前端请求构建 CircuitProject
func fromExportRequest(req *ExportRequest) (*types.CircuitProject, error) {
	project := &types.CircuitProject{
		ID:         req.ProjectID,
		Name:       req.Name,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		Components: make([]types.Component, 0, len(req.Components)),
		Nodes:      make([]types.CircuitNode, 0, len(req.Nodes)),
		Wires:      make([]types.Wire, 0),
	}

	if project.Name == "" {
		project.Name = "Chip-Sim Export"
	}

	// 转换元件
	for _, compMap := range req.Components {
		comp := types.Component{}

		if id, ok := compMap["id"].(string); ok {
			comp.ID = id
		}
		if name, ok := compMap["name"].(string); ok {
			comp.Name = name
		}
		if typ, ok := compMap["type"].(string); ok {
			comp.Type = types.ComponentType(typ)
		}
		if rot, ok := compMap["rotation"].(float64); ok {
			comp.Rotation = int(rot)
		}

		// 解析 position
		if posMap, ok := compMap["position"].(map[string]any); ok {
			if x, ok := posMap["x"].(float64); ok {
				comp.Position.X = x
			}
			if y, ok := posMap["y"].(float64); ok {
				comp.Position.Y = y
			}
		}

		// 解析 value
		if valMap, ok := compMap["value"].(map[string]any); ok {
			if v, ok := valMap["value"].(float64); ok {
				comp.Value.Value = v
			}
			if u, ok := valMap["unit"].(string); ok {
				comp.Value.Unit = u
			}
			if p, ok := valMap["prefix"].(string); ok {
				comp.Value.Prefix = p
			}
		}

		// 解析 ports
		if portsRaw, ok := compMap["ports"].([]any); ok {
			comp.Ports = make([]types.ComponentPort, 0, len(portsRaw))
			for _, portRaw := range portsRaw {
				portMap, ok := portRaw.(map[string]any)
				if !ok {
					continue
				}
				port := types.ComponentPort{}
				if id, ok := portMap["id"].(string); ok {
					port.ID = id
				}
				if nid, ok := portMap["nodeId"].(string); ok {
					port.NodeID = nid
				}
				if offMap, ok := portMap["offset"].(map[string]any); ok {
					if x, ok := offMap["x"].(float64); ok {
						port.Offset.X = x
					}
					if y, ok := offMap["y"].(float64); ok {
						port.Offset.Y = y
					}
				}
				comp.Ports = append(comp.Ports, port)
			}
		}

		// 解析 params
		if paramsMap, ok := compMap["params"].(map[string]any); ok {
			comp.Params = paramsMap
		}

		project.Components = append(project.Components, comp)
	}

	// 转换节点
	for _, nodeMap := range req.Nodes {
		node := types.CircuitNode{}
		if id, ok := nodeMap["id"].(string); ok {
			node.ID = id
		}
		if name, ok := nodeMap["name"].(string); ok {
			node.Name = name
		}
		if typ, ok := nodeMap["type"].(string); ok {
			node.Type = types.NodeType(typ)
		}
		if posMap, ok := nodeMap["position"].(map[string]any); ok {
			if x, ok := posMap["x"].(float64); ok {
				node.Position.X = x
			}
			if y, ok := posMap["y"].(float64); ok {
				node.Position.Y = y
			}
		}
		project.Nodes = append(project.Nodes, node)
	}

	return project, nil
}

// fromJSON 从 JSON bytes 构建 CircuitProject（便捷方法）
func fromJSON(data []byte) (*types.CircuitProject, error) {
	var req ExportRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, err
	}
	return fromExportRequest(&req)
}

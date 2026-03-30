// Package handler SPICE 网表导入导出 API
package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"chip-sim/internal/spice"
)

// SpiceHandler SPICE 网表导入导出处理器
type SpiceHandler struct{}

// NewSpiceHandler 创建 SPICE 处理器
func NewSpiceHandler() *SpiceHandler {
	return &SpiceHandler{}
}

// ==================== 导入 ====================

// ImportResponse SPICE 导入响应
type ImportResponse struct {
	Success  bool              `json:"success"`
	Circuit  *CircuitData      `json:"circuit,omitempty"`
	Warnings []string          `json:"warnings,omitempty"`
	Error    string            `json:"error,omitempty"`
}

// CircuitData 前端电路数据
type CircuitData struct {
	ID               string                   `json:"id"`
	Name             string                   `json:"name"`
	Components       []map[string]any         `json:"components"`
	Nodes            []map[string]any         `json:"nodes"`
	SimulationConfig map[string]any           `json:"simulationConfig,omitempty"`
}

// HandleImport 处理 POST /api/spice/import
// 请求体: multipart/form-data 或 application/json
//   - file 字段: SPICE 网表文件 (.cir/.sp)
//   - 或 body 直接为 SPICE 网表文本
func (h *SpiceHandler) HandleImport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		writeSpiceError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var content []byte
	var err error

	// 支持 multipart 文件上传
	if r.Header.Get("Content-Type") != "" &&
		(r.Header.Get("Content-Type")[:19] == "multipart/form-data") {
		file, _, err := r.FormFile("file")
		if err != nil {
			writeSpiceError(w, http.StatusBadRequest, "failed to read file: "+err.Error())
			return
		}
		defer file.Close()
		content, err = io.ReadAll(file)
		if err != nil {
			writeSpiceError(w, http.StatusBadRequest, "failed to read file content: "+err.Error())
			return
		}
	} else {
		// 直接读取 body
		content, err = io.ReadAll(r.Body)
		if err != nil {
			writeSpiceError(w, http.StatusBadRequest, "failed to read request body: "+err.Error())
			return
		}
	}

	if len(content) == 0 {
		writeSpiceError(w, http.StatusBadRequest, "empty netlist content")
		return
	}

	log.Printf("[SPICE] Importing netlist (%d bytes)", len(content))

	parser := spice.NewParser()
	result, err := parser.ParseBytes(content)
	if err != nil {
		writeSpiceError(w, http.StatusBadRequest, "parse error: "+err.Error())
		return
	}

	// 转换为前端格式
	circuitData := toCircuitData(result)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ImportResponse{
		Success:  true,
		Circuit:  circuitData,
		Warnings: result.Warnings,
	})
}

// ==================== 导出 ====================

// ExportRequest SPICE 导出请求
type ExportRequest struct {
	ProjectID  string              `json:"projectId"`
	Name       string              `json:"name"`
	Components []map[string]any    `json:"components"`
	Nodes      []map[string]any    `json:"nodes"`
}

// ExportResponse SPICE 导出响应
type ExportResponse struct {
	Success bool   `json:"success"`
	Netlist string `json:"netlist,omitempty"`
	Error   string `json:"error,omitempty"`
}

// HandleExport 处理 POST /api/spice/export
// 请求体: JSON 格式的电路数据，返回 SPICE 网表文本
func (h *SpiceHandler) HandleExport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		writeSpiceError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeSpiceError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	log.Printf("[SPICE] Exporting circuit: %s", req.Name)

	// 从请求构建 CircuitProject
	project, err := fromExportRequest(&req)
	if err != nil {
		writeSpiceError(w, http.StatusBadRequest, "invalid circuit data: "+err.Error())
		return
	}

	exporter := spice.NewExporter()
	netlist := exporter.Export(project)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ExportResponse{
		Success: true,
		Netlist: netlist,
	})
}

// HandleExportFile 处理 POST /api/spice/export-file
// 请求体同 HandleExport，但直接返回 .cir 文件下载
func (h *SpiceHandler) HandleExportFile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	project, err := fromExportRequest(&req)
	if err != nil {
		http.Error(w, "invalid circuit data", http.StatusBadRequest)
		return
	}

	exporter := spice.NewExporter()
	netlist := exporter.Export(project)

	filename := req.Name
	if filename == "" {
		filename = "circuit"
	}
	filename = filename + ".cir"

	w.Header().Set("Content-Type", "text/plain")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, netlist)
}

// ==================== 辅助函数 ====================

func writeSpiceError(w http.ResponseWriter, statusCode int, msg string) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ImportResponse{
		Success: false,
		Error:   msg,
	})
}

// Package handler REST API 端点处理
// 提供 /api/simulation/ac-sweep 和 /api/simulation/transient 端点
package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"chip-sim/internal/engine"
	"chip-sim/pkg/types"
)

// SimulationAPIHandler REST API 仿真端点处理器
type SimulationAPIHandler struct {
	factory engine.EngineFactory
}

// NewSimulationAPIHandler 创建 REST API 处理器
func NewSimulationAPIHandler() *SimulationAPIHandler {
	return &SimulationAPIHandler{
		factory: engine.DefaultFactory,
	}
}

// ACSweepRequest AC 频率扫描请求体
type ACSweepRequest struct {
	ProjectID    string                    `json:"projectId"`
	Config       types.SimulationConfig    `json:"config"`
	Circuit      *types.CircuitProject     `json:"circuit,omitempty"`
}

// TransientRequest 瞬态分析请求体
type TransientRequest struct {
	ProjectID    string                    `json:"projectId"`
	Config       types.SimulationConfig    `json:"config"`
	Circuit      *types.CircuitProject     `json:"circuit,omitempty"`
}

// SimulationAPIResponse 统一 API 响应
type SimulationAPIResponse struct {
	Success bool                   `json:"success"`
	Result  *types.SimulationResult `json:"result,omitempty"`
	Error   string                 `json:"error,omitempty"`
}

// HandleACSweep handles POST /api/simulation/ac-sweep
func (h *SimulationAPIHandler) HandleACSweep(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		writeAPIError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ACSweepRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	// Force AC analysis type
	req.Config.Analysis.Type = types.AnalysisAC

	log.Printf("[API] AC sweep request: freq=%g-%g Hz, mode=%s",
		req.Config.Analysis.StartFreq,
		req.Config.Analysis.StopFreq,
		req.Config.Analysis.SweepMode,
	)

	project := h.buildProject(&req.ProjectID, &req.Config, req.Circuit)

	eng, err := h.factory(types.AnalysisAC)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := eng.Validate(project); err != nil {
		writeAPIError(w, http.StatusBadRequest, "validation failed: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	resultCh, err := eng.Run(ctx, project)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "simulation failed: "+err.Error())
		return
	}

	// Collect final result
	var finalResult *types.SimulationResult
	for result := range resultCh {
		if result.Status == types.StatusCompleted {
			finalResult = result
		} else if result.Status == types.StatusError {
			writeAPIError(w, http.StatusInternalServerError, "simulation error: "+result.Error)
			return
		}
	}

	if finalResult == nil {
		writeAPIError(w, http.StatusInternalServerError, "simulation produced no result")
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(SimulationAPIResponse{
		Success: true,
		Result:  finalResult,
	})
}

// HandleTransient handles POST /api/simulation/transient
func (h *SimulationAPIHandler) HandleTransient(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		writeAPIError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req TransientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	// Force Transient analysis type
	req.Config.Analysis.Type = types.AnalysisTransient

	log.Printf("[API] Transient request: dt=%g s, stop=%g s, adaptive=%v",
		req.Config.Analysis.StepTime,
		req.Config.Analysis.StopTime,
		req.Config.Analysis.AdaptiveStep,
	)

	project := h.buildProject(&req.ProjectID, &req.Config, req.Circuit)

	eng, err := h.factory(types.AnalysisTransient)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := eng.Validate(project); err != nil {
		writeAPIError(w, http.StatusBadRequest, "validation failed: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	resultCh, err := eng.Run(ctx, project)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "simulation failed: "+err.Error())
		return
	}

	var finalResult *types.SimulationResult
	for result := range resultCh {
		if result.Status == types.StatusCompleted {
			finalResult = result
		} else if result.Status == types.StatusError {
			writeAPIError(w, http.StatusInternalServerError, "simulation error: "+result.Error)
			return
		}
	}

	if finalResult == nil {
		writeAPIError(w, http.StatusInternalServerError, "simulation produced no result")
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(SimulationAPIResponse{
		Success: true,
		Result:  finalResult,
	})
}

// buildProject creates a CircuitProject from request data
func (h *SimulationAPIHandler) buildProject(projectID *string, config *types.SimulationConfig, circuit *types.CircuitProject) *types.CircuitProject {
	var project *types.CircuitProject
	if circuit != nil {
		project = circuit
		if project.ID == "" && projectID != nil {
			project.ID = *projectID
		}
		project.SimulationConfig = *config
	} else {
		project = &types.CircuitProject{
			ID:               *projectID,
			Name:             *projectID,
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
			SimulationConfig: *config,
		}
	}
	return project
}

// writeAPIError writes an error JSON response
func writeAPIError(w http.ResponseWriter, statusCode int, msg string) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(SimulationAPIResponse{
		Success: false,
		Error:   msg,
	})
}

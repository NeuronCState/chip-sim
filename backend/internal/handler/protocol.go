// Package handler 协议仿真 HTTP 处理器
package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"chip-sim/internal/engine/protocols"
	"chip-sim/pkg/types"
)

// ProtocolHandler 协议仿真 API 处理器
type ProtocolHandler struct{}

// NewProtocolHandler 创建协议仿真处理器
func NewProtocolHandler() *ProtocolHandler {
	return &ProtocolHandler{}
}

// HandleProtocolSim POST /api/simulation/protocol
func (h *ProtocolHandler) HandleProtocolSim(w http.ResponseWriter, r *http.Request) {
	// CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req types.ProtocolSimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "invalid request body: " + err.Error(),
		})
		return
	}

	log.Printf("[Protocol] Simulate %s protocol", req.Protocol)

	result, err := protocols.Simulate(&req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(result)
}

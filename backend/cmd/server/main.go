// Package main 电路仿真平台后端服务入口
// 启动 HTTP 服务和 WebSocket 端点
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"chip-sim/internal/handler"
	"chip-sim/internal/ws"
)

func main() {
	port := flag.Int("port", 8080, "server port")
	flag.Parse()

	// 创建 WebSocket 处理器
	wsHandler := ws.NewHandler()

	// 创建仿真消息处理器并绑定
	simHandler := handler.NewSimulationHandler()
	wsHandler.SetMessageHandler(simHandler.HandleMessage)

	// 创建 REST API 处理器
	apiHandler := handler.NewSimulationAPIHandler()

	// 创建示例电路 API 处理器
	exampleHandler := handler.NewExampleAPIHandler()

	// 创建 SPICE 网表导入导出处理器
	spiceHandler := handler.NewSpiceHandler()

	// 创建项目管理处理器
	projectHandler := handler.NewProjectHandler()

	// 路由配置
	mux := http.NewServeMux()

	// WebSocket 端点
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		wsHandler.ServeHTTP(w, r)
	})

	// 健康检查端点
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","connections":%d}`, wsHandler.ClientCount())
	})

	// API 信息端点
	mux.HandleFunc("/api/info", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"name":"chip-sim","version":"0.2.0","phase":"Phase 2 - AC Sweep & Transient Enhancement"}`)
	})

	// REST API: AC 频率扫描端点
	mux.HandleFunc("/api/simulation/ac-sweep", apiHandler.HandleACSweep)

	// REST API: 瞬态分析端点
	mux.HandleFunc("/api/simulation/transient", apiHandler.HandleTransient)

	// REST API: SPICE 网表导入导出端点
	mux.HandleFunc("/api/spice/import", spiceHandler.HandleImport)
	mux.HandleFunc("/api/spice/export", spiceHandler.HandleExport)
	mux.HandleFunc("/api/spice/export-file", spiceHandler.HandleExportFile)

	// REST API: 项目管理端点
	mux.HandleFunc("/api/projects", projectHandler.HandleProjects)
	mux.HandleFunc("/api/projects/", projectHandler.HandleProjects)

	// REST API: 示例电路端点
	mux.HandleFunc("/api/examples/categories", exampleHandler.HandleListCategories)
	mux.HandleFunc("/api/examples", exampleHandler.HandleListExamples)
	mux.HandleFunc("/api/examples/", exampleHandler.HandleGetExample)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("🔌 Chip Sim Server starting on %s", addr)
	log.Printf("   WebSocket: ws://localhost%s/ws", addr)
	log.Printf("   Health:    http://localhost%s/health", addr)
	log.Printf("   API Info:  http://localhost%s/api/info", addr)
	log.Printf("   REST AC:   http://localhost%s/api/simulation/ac-sweep", addr)
	log.Printf("   REST Tran: http://localhost%s/api/simulation/transient", addr)
	log.Printf("   REST Ex:   http://localhost%s/api/examples", addr)
	log.Printf("   REST Proj: http://localhost%s/api/projects", addr)
	log.Printf("   SPICE:     http://localhost%s/api/spice/import", addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

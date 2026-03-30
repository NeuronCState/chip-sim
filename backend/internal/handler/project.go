// Package handler 项目管理 REST API 处理器
// 支持项目的 CRUD 操作、本地文件系统存储、版本管理
package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ==================== 数据模型 ====================

// Project 项目数据结构
type Project struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string        `json:"description"`
	CreatedAt   string         `json:"createdAt"`
	UpdatedAt   string         `json:"updatedAt"`
	Version     string         `json:"version"`
	Circuit     ProjectCircuitData `json:"circuit"`
	Metadata    ProjectMetadata `json:"metadata"`
}

// ProjectCircuitData 电路数据
type ProjectCircuitData struct {
	Components      []interface{} `json:"components"`
	Nodes           []interface{} `json:"nodes"`
	Wires           []interface{} `json:"wires"`
	SimulationConfig interface{}  `json:"simulationConfig"`
}

// ProjectMetadata 项目元数据
type ProjectMetadata struct {
	Author      string   `json:"author,omitempty"`
	Tags        []string `json:"tags"`
	Thumbnail   string   `json:"thumbnail,omitempty"`
	Description string   `json:"description"`
	Color       string   `json:"color,omitempty"`
	Starred     bool     `json:"starred,omitempty"`
}

// ProjectSummary 项目摘要（列表用）
type ProjectSummary struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	CreatedAt      string          `json:"createdAt"`
	UpdatedAt      string          `json:"updatedAt"`
	Version        string          `json:"version"`
	ComponentCount int             `json:"componentCount"`
	WireCount      int             `json:"wireCount"`
	Metadata       ProjectMetadata `json:"metadata"`
}

// ProjectVersion 项目版本快照
type ProjectVersion struct {
	VersionNumber int     `json:"versionNumber"`
	CreatedAt     string  `json:"createdAt"`
	Data          Project `json:"data"`
	ChangeNote    string  `json:"changeNote,omitempty"`
}

// ==================== 常量 ====================

const (
	maxVersions    = 10
	projectDirName = ".chipsim"
)

// ==================== 处理器 ====================

// ProjectHandler 项目管理 API 处理器
type ProjectHandler struct {
	baseDir string
	mu      sync.RWMutex
}

// NewProjectHandler 创建项目处理器
func NewProjectHandler() *ProjectHandler {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "/tmp"
	}
	baseDir := filepath.Join(homeDir, projectDirName, "projects")

	// 确保目录存在
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		fmt.Printf("警告：创建项目目录失败: %v\n", err)
	}

	return &ProjectHandler{baseDir: baseDir}
}

// ==================== 路由处理 ====================

// HandleProjects 处理 /api/projects 路由
// GET    /api/projects          - 列出所有项目
// POST   /api/projects          - 创建新项目
// GET    /api/projects/{id}     - 获取单个项目
// PUT    /api/projects/{id}     - 更新项目
// DELETE /api/projects/{id}     - 删除项目
func (h *ProjectHandler) HandleProjects(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// CORS preflight
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 提取路径中的 ID
	path := strings.TrimPrefix(r.URL.Path, "/api/projects")
	path = strings.Trim(path, "/")

	if path == "" {
		// 无 ID：集合操作
		switch r.Method {
		case http.MethodGet:
			h.handleListProjects(w, r)
		case http.MethodPost:
			h.handleCreateProject(w, r)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	} else {
		// 有 ID：单项目操作
		parts := strings.Split(path, "/")
		projectID := parts[0]

		if len(parts) > 1 && parts[1] == "versions" {
			// /api/projects/{id}/versions
			h.handleVersions(w, r, projectID)
			return
		}

		switch r.Method {
		case http.MethodGet:
			h.handleGetProject(w, r, projectID)
		case http.MethodPut:
			h.handleUpdateProject(w, r, projectID)
		case http.MethodDelete:
			h.handleDeleteProject(w, r, projectID)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}
}

// ==================== 集合操作 ====================

// GET /api/projects
func (h *ProjectHandler) handleListProjects(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	search := r.URL.Query().Get("search")
	tag := r.URL.Query().Get("tag")
	starred := r.URL.Query().Get("starred")
	sortBy := r.URL.Query().Get("sortBy")
	sortOrder := r.URL.Query().Get("sortOrder")

	entries, err := os.ReadDir(h.baseDir)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"projects": []ProjectSummary{},
			"total":    0,
		})
		return
	}

	var summaries []ProjectSummary
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		project, err := h.readProjectFile(filepath.Join(h.baseDir, entry.Name()))
		if err != nil {
			continue
		}

		// 搜索过滤
		if search != "" {
			searchLower := strings.ToLower(search)
			if !strings.Contains(strings.ToLower(project.Name), searchLower) &&
				!strings.Contains(strings.ToLower(project.Description), searchLower) {
				continue
			}
		}

		// 标签过滤
		if tag != "" {
			found := false
			for _, t := range project.Metadata.Tags {
				if t == tag {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// 收藏过滤
		if starred == "true" && !project.Metadata.Starred {
			continue
		}

		summary := ProjectSummary{
			ID:             project.ID,
			Name:           project.Name,
			Description:    project.Description,
			CreatedAt:      project.CreatedAt,
			UpdatedAt:      project.UpdatedAt,
			Version:        project.Version,
			ComponentCount: len(project.Circuit.Components),
			WireCount:      len(project.Circuit.Wires),
			Metadata:       project.Metadata,
		}
		summaries = append(summaries, summary)
	}

	// 排序
	if sortBy == "" {
		sortBy = "updatedAt"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	sort.Slice(summaries, func(i, j int) bool {
		var cmp int
		switch sortBy {
		case "name":
			cmp = strings.Compare(summaries[i].Name, summaries[j].Name)
		case "createdAt":
			cmp = strings.Compare(summaries[i].CreatedAt, summaries[j].CreatedAt)
		case "updatedAt":
			cmp = strings.Compare(summaries[i].UpdatedAt, summaries[j].UpdatedAt)
		case "componentCount":
			cmp = summaries[i].ComponentCount - summaries[j].ComponentCount
		default:
			cmp = strings.Compare(summaries[i].UpdatedAt, summaries[j].UpdatedAt)
		}
		if sortOrder == "desc" {
			return cmp > 0
		}
		return cmp < 0
	})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"projects": summaries,
		"total":    len(summaries),
	})
}

// POST /api/projects
func (h *ProjectHandler) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	h.mu.Lock()
	defer h.mu.Unlock()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"读取请求体失败"}`, http.StatusBadRequest)
		return
	}

	var project Project
	if err := json.Unmarshal(body, &project); err != nil {
		http.Error(w, `{"error":"JSON 格式无效"}`, http.StatusBadRequest)
		return
	}

	// 生成 ID 和时间
	if project.ID == "" {
		project.ID = fmt.Sprintf("proj-%d", time.Now().UnixNano())
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if project.CreatedAt == "" {
		project.CreatedAt = now
	}
	project.UpdatedAt = now
	if project.Version == "" {
		project.Version = "2.0.0"
	}

	// 初始化 metadata
	if project.Metadata.Tags == nil {
		project.Metadata.Tags = []string{}
	}

	// 保存到文件
	if err := h.saveProjectFile(&project); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"保存失败: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(project)
}

// ==================== 单项目操作 ====================

// GET /api/projects/{id}
func (h *ProjectHandler) handleGetProject(w http.ResponseWriter, r *http.Request, id string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	project, err := h.getProjectByID(id)
	if err != nil {
		http.Error(w, `{"error":"项目不存在"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(project)
}

// PUT /api/projects/{id}
func (h *ProjectHandler) handleUpdateProject(w http.ResponseWriter, r *http.Request, id string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// 检查是否存在
	existing, err := h.getProjectByID(id)
	if err != nil {
		http.Error(w, `{"error":"项目不存在"}`, http.StatusNotFound)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"读取请求体失败"}`, http.StatusBadRequest)
		return
	}

	var project Project
	if err := json.Unmarshal(body, &project); err != nil {
		http.Error(w, `{"error":"JSON 格式无效"}`, http.StatusBadRequest)
		return
	}

	// 保留原始 ID 和创建时间
	project.ID = id
	project.CreatedAt = existing.CreatedAt
	project.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// 保存旧版本
	h.createVersion(existing)

	// 保存更新
	if err := h.saveProjectFile(&project); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"保存失败: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(project)
}

// DELETE /api/projects/{id}
func (h *ProjectHandler) handleDeleteProject(w http.ResponseWriter, r *http.Request, id string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	filePath := h.projectFilePath(id)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, `{"error":"项目不存在"}`, http.StatusNotFound)
		return
	}

	// 删除项目文件
	if err := os.Remove(filePath); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"删除失败: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// 删除版本目录
	versionDir := filepath.Join(h.baseDir, id+".versions")
	os.RemoveAll(versionDir)

	json.NewEncoder(w).Encode(map[string]string{
		"message": "项目已删除",
		"id":      id,
	})
}

// ==================== 版本管理 ====================

// GET /api/projects/{id}/versions
func (h *ProjectHandler) handleVersions(w http.ResponseWriter, r *http.Request, id string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	versionDir := filepath.Join(h.baseDir, id+".versions")
	entries, err := os.ReadDir(versionDir)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"versions": []ProjectVersion{},
			"total":    0,
		})
		return
	}

	var versions []ProjectVersion
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		data, err := os.ReadFile(filepath.Join(versionDir, entry.Name()))
		if err != nil {
			continue
		}

		var project Project
		if err := json.Unmarshal(data, &project); err != nil {
			continue
		}

		// 从文件名提取版本号
		name := strings.TrimSuffix(entry.Name(), ".json")
		var versionNum int
		fmt.Sscanf(name, "v%d", &versionNum)

		versions = append(versions, ProjectVersion{
			VersionNumber: versionNum,
			CreatedAt:     project.UpdatedAt,
			Data:          project,
		})
	}

	// 按版本号降序
	sort.Slice(versions, func(i, j int) bool {
		return versions[i].VersionNumber > versions[j].VersionNumber
	})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"versions": versions,
		"total":    len(versions),
	})
}

// ==================== 内部方法 ====================

func (h *ProjectHandler) projectFilePath(id string) string {
	return filepath.Join(h.baseDir, id+".json")
}

func (h *ProjectHandler) getProjectByID(id string) (*Project, error) {
	filePath := h.projectFilePath(id)
	return h.readProjectFile(filePath)
}

func (h *ProjectHandler) readProjectFile(filePath string) (*Project, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var project Project
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, err
	}

	return &project, nil
}

func (h *ProjectHandler) saveProjectFile(project *Project) error {
	data, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return err
	}

	filePath := h.projectFilePath(project.ID)
	return os.WriteFile(filePath, data, 0o644)
}

// createVersion 创建项目版本快照（最多保留 maxVersions 个）
func (h *ProjectHandler) createVersion(project *Project) {
	versionDir := filepath.Join(h.baseDir, project.ID+".versions")
	if err := os.MkdirAll(versionDir, 0o755); err != nil {
		return
	}

	// 读取现有版本
	entries, err := os.ReadDir(versionDir)
	if err != nil {
		return
	}

	// 过滤出版本文件
	var versionFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			versionFiles = append(versionFiles, e.Name())
		}
	}

	// 确定新版本号
	nextVersion := len(versionFiles) + 1

	// 保存版本
	versionFile := filepath.Join(versionDir, fmt.Sprintf("v%03d.json", nextVersion))
	data, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(versionFile, data, 0o644)

	// 清理超出限制的旧版本
	if len(versionFiles)+1 > maxVersions {
		sort.Strings(versionFiles)
		excess := len(versionFiles) + 1 - maxVersions
		for i := 0; i < excess; i++ {
			os.Remove(filepath.Join(versionDir, versionFiles[i]))
		}
	}
}

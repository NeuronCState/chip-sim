// Package handler 示例电路库 API 处理器
package handler

import (
	"encoding/json"
	"net/http"
)

// ExampleCircuit 示例电路信息
type ExampleCircuit struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	NameEn      string            `json:"nameEn"`
	Category    string            `json:"category"`
	Difficulty  int               `json:"difficulty"`
	Icon        string            `json:"icon"`
	Tags        []string          `json:"tags"`
	Description string            `json:"description"`
	DescEn      string            `json:"descEn"`
	LearningPts []string          `json:"learningPoints"`
	SimNote     string            `json:"simNote"`
	Params      map[string]string `json:"keyParams"`
}

// ExampleCategory 示例电路分类
type ExampleCategory struct {
	Key     string `json:"key"`
	Title   string `json:"title"`
	TitleEn string `json:"titleEn"`
	Icon    string `json:"icon"`
}

var categories = []ExampleCategory{
	{Key: "basic", Title: "基础电路", TitleEn: "Basic Circuits", Icon: "⚡"},
	{Key: "analog", Title: "模拟电路", TitleEn: "Analog Circuits", Icon: "🔊"},
	{Key: "digital", Title: "数字电路", TitleEn: "Digital Circuits", Icon: "🔀"},
	{Key: "embedded", Title: "嵌入式电路", TitleEn: "Embedded Circuits", Icon: "🖥️"},
	{Key: "power", Title: "电源电路", TitleEn: "Power Circuits", Icon: "🔋"},
}

var examples = []ExampleCircuit{
	// ===== 基础电路 =====
	{
		ID: "led-circuit", Name: "LED 驱动电路", NameEn: "LED Driver Circuit",
		Category: "basic", Difficulty: 1, Icon: "💡",
		Tags:        []string{"LED", "电阻", "直流", "入门"},
		Description: "基础 LED 驱动电路，学习限流电阻计算 R=(V-Vf)/I",
		DescEn:      "Basic LED driver circuit, learn current-limiting resistor calculation",
		LearningPts: []string{"LED 正向导通特性", "限流电阻计算: R=(V-Vf)/I", "串联回路搭建"},
		SimNote:     "运行直流分析，观察 LED 两端电压和回路电流",
		Params:      map[string]string{"电源": "5V DC", "电阻": "330Ω", "LED正向压降": "0.7V"},
	},
	{
		ID: "voltage-divider", Name: "电阻分压器", NameEn: "Voltage Divider",
		Category: "basic", Difficulty: 1, Icon: "⚡",
		Tags:        []string{"分压", "电阻", "入门"},
		Description: "经典电阻分压电路，输出电压 Vout = Vin × R2/(R1+R2)",
		DescEn:      "Classic voltage divider, output Vout = Vin × R2/(R1+R2)",
		LearningPts: []string{"欧姆定律实际应用", "分压公式", "负载效应"},
		SimNote:     "运行直流分析，测量 R1-R2 连接点电压",
		Params:      map[string]string{"电源": "10V DC", "R1": "10kΩ", "R2": "10kΩ", "输出": "5V"},
	},
	{
		ID: "rc-filter", Name: "RC 低通滤波器", NameEn: "RC Low-Pass Filter",
		Category: "basic", Difficulty: 2, Icon: "📊",
		Tags:        []string{"滤波", "RC", "频率响应"},
		Description: "一阶 RC 低通滤波器，截止频率 fc = 1/(2πRC)",
		DescEn:      "First-order RC low-pass filter, cutoff fc = 1/(2πRC)",
		LearningPts: []string{"RC 时间常数 τ=R×C", "截止频率 fc=1/(2πRC)", "频率衰减特性"},
		SimNote:     "运行 AC 扫描（1Hz~1MHz），观察幅频特性曲线",
		Params:      map[string]string{"R": "1kΩ", "C": "1μF", "截止频率": "159Hz"},
	},

	// ===== 模拟电路 =====
	{
		ID: "opamp-inverting", Name: "反相放大器", NameEn: "Inverting Amplifier",
		Category: "analog", Difficulty: 2, Icon: "🔊",
		Tags:        []string{"运放", "放大", "反相"},
		Description: "运算放大器反相放大电路，增益 Av = -R2/R1",
		DescEn:      "Op-amp inverting amplifier, gain Av = -R2/R1",
		LearningPts: []string{"虚短虚断概念", "反相放大增益公式", "负反馈原理"},
		SimNote:     "输入 1V 时输出约 -10V（受供电轨限制）",
		Params:      map[string]string{"R1": "10kΩ", "R2": "100kΩ", "增益": "-10x"},
	},
	{
		ID: "bjt-switch", Name: "三极管开关", NameEn: "BJT Switch",
		Category: "analog", Difficulty: 2, Icon: "🔌",
		Tags:        []string{"三极管", "开关", "BJT"},
		Description: "NPN 三极管电子开关电路，GPIO 控制负载通断",
		DescEn:      "NPN BJT electronic switch, GPIO controls load on/off",
		LearningPts: []string{"BJT 三种工作状态", "基极电阻计算", "开关用法"},
		SimNote:     "修改 GPIO 电压（0V/3.3V）观察开关状态切换",
		Params:      map[string]string{"Vcc": "5V", "R_load": "1kΩ", "R_base": "10kΩ"},
	},

	// ===== 数字电路 =====
	{
		ID: "nand-sr-latch", Name: "NAND SR 锁存器", NameEn: "NAND SR Latch",
		Category: "digital", Difficulty: 3, Icon: "🔀",
		Tags:        []string{"NAND", "锁存器", "SR", "存储"},
		Description: "两个与非门交叉反馈构成的 SR 锁存器",
		DescEn:      "SR latch built with two cross-coupled NAND gates",
		LearningPts: []string{"SR 锁存器原理", "交叉反馈机制", "置位/复位/保持状态"},
		SimNote:     "修改 S̄/R̄ 电压（低电平有效）验证锁存功能",
		Params:      map[string]string{"门电路": "2× NAND", "有效电平": "低电平"},
	},
	{
		ID: "and-gate", Name: "与门逻辑", NameEn: "AND Gate Logic",
		Category: "digital", Difficulty: 2, Icon: "🔀",
		Tags:        []string{"AND", "逻辑门", "布尔"},
		Description: "二输入与门电路，验证布尔运算 Y = A·B",
		DescEn:      "Two-input AND gate, verify Boolean operation Y = A·B",
		LearningPts: []string{"AND 布尔运算", "真值表验证", "逻辑电平定义"},
		SimNote:     "修改 VA/VB（0V/5V），验证四种输入组合",
		Params:      map[string]string{"门电路": "AND", "输入": "2路", "电源": "5V"},
	},

	// ===== 嵌入式电路 =====
	{
		ID: "mcu-gpio-led", Name: "MCU GPIO 驱动 LED", NameEn: "MCU GPIO LED Driver",
		Category: "embedded", Difficulty: 2, Icon: "🖥️",
		Tags:        []string{"MCU", "GPIO", "LED", "嵌入式"},
		Description: "MCU GPIO 输出驱动 LED 的典型电路设计",
		DescEn:      "Typical MCU GPIO output driving LED circuit",
		LearningPts: []string{"GPIO 输出驱动能力", "嵌入式 LED 驱动", "MCU 接口设计"},
		SimNote:     "设置 GPIO 输出高电平，观察 LED 导通电流",
		Params:      map[string]string{"MCU": "STM32F103", "GPIO电压": "3.3V", "限流电阻": "330Ω"},
	},
	{
		ID: "i2c-sensor", Name: "I2C 传感器接口", NameEn: "I2C Sensor Interface",
		Category: "embedded", Difficulty: 3, Icon: "📡",
		Tags:        []string{"I2C", "传感器", "通信"},
		Description: "I2C 总线连接传感器，含上拉电阻设计",
		DescEn:      "I2C bus sensor connection with pull-up resistors",
		LearningPts: []string{"I2C 开漏输出原理", "SCL/SDA 时序", "从设备寻址"},
		SimNote:     "运行协议仿真，观察 I2C 波形",
		Params:      map[string]string{"上拉电阻": "4.7kΩ", "总线速率": "100kHz", "电源": "3.3V"},
	},
	{
		ID: "uart-comm", Name: "UART 串口通信", NameEn: "UART Serial Communication",
		Category: "embedded", Difficulty: 2, Icon: "📟",
		Tags:        []string{"UART", "串口", "通信"},
		Description: "UART 异步串口通信，TX/RX 交叉连接",
		DescEn:      "UART asynchronous serial communication with TX/RX crossover",
		LearningPts: []string{"UART 帧格式", "波特率设置", "TX/RX 交叉连接"},
		SimNote:     "运行协议仿真（115200bps），观察 UART 波形",
		Params:      map[string]string{"波特率": "115200", "数据位": "8", "停止位": "1"},
	},

	// ===== 电源/定时电路 =====
	{
		ID: "timer555", Name: "555 定时器振荡器", NameEn: "555 Timer Oscillator",
		Category: "power", Difficulty: 3, Icon: "⏱️",
		Tags:        []string{"555", "定时器", "方波", "振荡器"},
		Description: "555 定时器非稳态振荡电路，产生方波信号",
		DescEn:      "555 timer astable oscillator generating square wave",
		LearningPts: []string{"555 内部结构", "振荡频率公式 f=1.44/((R1+2R2)×C)", "占空比调节"},
		SimNote:     "运行瞬态分析（10ms），观察充放电波形和方波输出",
		Params:      map[string]string{"R1": "10kΩ", "R2": "10kΩ", "C": "1μF", "频率": "~48Hz"},
	},
}

// ExampleAPIHandler 示例电路 API 处理器
type ExampleAPIHandler struct{}

// NewExampleAPIHandler 创建示例 API 处理器
func NewExampleAPIHandler() *ExampleAPIHandler {
	return &ExampleAPIHandler{}
}

// HandleListCategories 返回电路分类列表
// GET /api/examples/categories
func (h *ExampleAPIHandler) HandleListCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"categories": categories,
	})
}

// HandleListExamples 返回示例电路列表（支持分类过滤）
// GET /api/examples?category=basic
func (h *ExampleAPIHandler) HandleListExamples(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	category := r.URL.Query().Get("category")
	var filtered []ExampleCircuit
	if category != "" {
		for _, ex := range examples {
			if ex.Category == category {
				filtered = append(filtered, ex)
			}
		}
	} else {
		filtered = examples
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"examples": filtered,
		"total":    len(filtered),
	})
}

// HandleGetExample 返回单个示例详情
// GET /api/examples/{id}
func (h *ExampleAPIHandler) HandleGetExample(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	id := r.URL.Path[len("/api/examples/"):]
	if id == "" {
		http.Error(w, `{"error":"missing example id"}`, http.StatusBadRequest)
		return
	}

	for _, ex := range examples {
		if ex.ID == id {
			json.NewEncoder(w).Encode(ex)
			return
		}
	}

	http.Error(w, `{"error":"example not found"}`, http.StatusNotFound)
}

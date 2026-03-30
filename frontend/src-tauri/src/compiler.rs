use regex::Regex;
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::time::Duration;
use tempfile::tempdir;

// ==================== 类型定义 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompilerInfo {
    pub name: String,
    pub family: String,
    pub path: String,
    pub version: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompileRequest {
    pub source: String,          // C 源代码
    pub chip_family: String,     // c51, stm32, esp32, arduino
    pub chip_model: String,      // 具体型号
    pub filename: String,        // 文件名，如 main.c
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompileResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub output_path: Option<String>,  // 编译产物路径 (.hex/.bin/.elf)
    pub output_format: Option<String>, // hex, bin, elf
}

// ==================== 安全校验 ====================

/// 校验文件名白名单：只允许字母、数字、下划线、点、横线，且扩展名为 c/h/ino/cpp
fn is_valid_filename(filename: &str) -> bool {
    let re = Regex::new(r"^[a-zA-Z0-9_.-]+\.(c|h|ino|cpp)$").unwrap();
    re.is_match(filename)
}

// ==================== 带超时的命令执行 ====================

const COMPILE_TIMEOUT: Duration = Duration::from_secs(30);

/// 带超时执行命令，超时后 kill 进程
fn run_command_with_timeout(mut cmd: Command, timeout: Duration) -> Result<std::process::Output, String> {
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("启动进程失败: {}", e))?;

    let start = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                return child.wait_with_output()
                    .map_err(|e| format!("获取输出失败: {}", e));
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("编译超时（{}秒），进程已被终止", timeout.as_secs()));
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => return Err(format!("等待进程失败: {}", e)),
        }
    }
}

// ==================== 编译器路径检测 ====================

/// 跨平台编译器探测：直接尝试执行 `cmd --version`，而非调用系统 `which`
fn which(cmd: &str) -> Option<String> {
    let output = Command::new(cmd)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if output.status.success() {
        Some(cmd.to_string())
    } else {
        None
    }
}

fn get_version(cmd: &str, flag: &str) -> String {
    Command::new(cmd)
        .arg(flag)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout);
            s.lines().next().map(|l| l.to_string())
        })
        .unwrap_or_default()
}

/// 检测系统中已安装的编译器
#[tauri::command]
pub fn detect_compilers() -> Vec<CompilerInfo> {
    let mut compilers = Vec::new();

    // SDCC (51系列)
    compilers.push(check_compiler("sdcc", "sdcc", "c51", "--version"));

    // AVR-GCC (Arduino/AVR)
    compilers.push(check_compiler("avr-gcc", "avr-gcc", "arduino", "--version"));

    // ARM-none-eabi-GCC (STM32)
    compilers.push(check_compiler("arm-none-eabi-gcc", "arm-none-eabi-gcc", "stm32", "--version"));

    // Xtensa GCC (ESP32)
    if let Some(path) = which("xtensa-esp32-elf-gcc") {
        compilers.push(CompilerInfo {
            name: "xtensa-gcc".to_string(),
            family: "esp32".to_string(),
            path,
            version: get_version("xtensa-esp32-elf-gcc", "--version"),
            available: true,
        });
    } else {
        compilers.push(CompilerInfo {
            name: "xtensa-gcc".to_string(),
            family: "esp32".to_string(),
            path: String::new(),
            version: String::new(),
            available: false,
        });
    }

    // RISC-V GCC (CH32V, GD32VF)
    if let Some(path) = which("riscv-none-embed-gcc") {
        compilers.push(CompilerInfo {
            name: "riscv-gcc".to_string(),
            family: "riscv".to_string(),
            path,
            version: get_version("riscv-none-embed-gcc", "--version"),
            available: true,
        });
    }

    compilers
}

fn check_compiler(cmd: &str, name: &str, family: &str, version_flag: &str) -> CompilerInfo {
    if let Some(path) = which(cmd) {
        CompilerInfo {
            name: name.to_string(),
            family: family.to_string(),
            path,
            version: get_version(cmd, version_flag),
            available: true,
        }
    } else {
        CompilerInfo {
            name: name.to_string(),
            family: family.to_string(),
            path: String::new(),
            version: String::new(),
            available: false,
        }
    }
}

// ==================== 编译 ====================

#[tauri::command]
pub fn compile_code(req: CompileRequest) -> CompileResult {
    // 任务1：文件名白名单校验，防止路径注入
    if !is_valid_filename(&req.filename) {
        return CompileResult {
            success: false,
            stdout: String::new(),
            stderr: "非法文件名".to_string(),
            output_path: None,
            output_format: None,
        };
    }

    match req.chip_family.as_str() {
        "c51" => compile_c51(&req),
        "stm32" => compile_stm32(&req),
        "arduino" => compile_arduino(&req),
        "esp32" => compile_esp32(&req),
        _ => CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("不支持的芯片系列: {}", req.chip_family),
            output_path: None,
            output_format: None,
        },
    }
}

// ---------- C51 (SDCC) ----------

fn compile_c51(req: &CompileRequest) -> CompileResult {
    // 使用 tempdir 替代硬编码目录，避免并发竞态
    let work_dir = match tempdir() {
        Ok(d) => d,
        Err(e) => return CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("创建临时目录失败: {}", e),
            output_path: None,
            output_format: None,
        },
    };
    let src_path = work_dir.path().join(&req.filename);
    let _ = std::fs::write(&src_path, &req.source);

    let output_name = req.filename.replace(".c", ".ihx");
    let out_path = work_dir.path().join(&output_name);

    let mut cmd = Command::new("sdcc");
    cmd.arg(&src_path);
    cmd.arg("-o");
    cmd.arg(&out_path);
    cmd.current_dir(work_dir.path());

    match run_command_with_timeout(cmd, COMPILE_TIMEOUT) {
        Ok(o) => {
            let success = o.status.success();
            let ihx_path = work_dir.path().join(&output_name);
            CompileResult {
                success,
                stdout: String::from_utf8_lossy(&o.stdout).to_string(),
                stderr: String::from_utf8_lossy(&o.stderr).to_string(),
                output_path: if ihx_path.exists() {
                    Some(ihx_path.to_string_lossy().to_string())
                } else {
                    None
                },
                output_format: if success { Some("ihx".to_string()) } else { None },
            }
        }
        Err(e) => CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("SDCC 执行失败: {}。请确认已安装 SDCC: brew install sdcc", e),
            output_path: None,
            output_format: None,
        },
    }
}

// ---------- STM32 (arm-none-eabi-gcc) ----------

fn compile_stm32(req: &CompileRequest) -> CompileResult {
    let work_dir = match tempdir() {
        Ok(d) => d,
        Err(e) => return CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("创建临时目录失败: {}", e),
            output_path: None,
            output_format: None,
        },
    };
    let src_path = work_dir.path().join(&req.filename);
    let _ = std::fs::write(&src_path, &req.source);

    let obj_name = req.filename.replace(".c", ".o");
    let elf_name = req.filename.replace(".c", ".elf");
    let bin_name = req.filename.replace(".c", ".bin");

    // Step 1: Compile to object
    let mut cmd = Command::new("arm-none-eabi-gcc");
    cmd.args([
        "-mcpu=cortex-m3", "-mthumb",
        "-Os", "-Wall",
        "-c", src_path.to_str().unwrap(),
        "-o", work_dir.path().join(&obj_name).to_str().unwrap(),
    ]);
    cmd.current_dir(work_dir.path());

    let compile_output = match run_command_with_timeout(cmd, COMPILE_TIMEOUT) {
        Ok(o) => o,
        Err(e) => return CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("arm-none-eabi-gcc 执行失败: {}。请确认已安装: brew install --cask gcc-arm-embedded", e),
            output_path: None,
            output_format: None,
        },
    };

    if !compile_output.status.success() {
        return CompileResult {
            success: false,
            stdout: String::from_utf8_lossy(&compile_output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&compile_output.stderr).to_string(),
            output_path: None,
            output_format: None,
        };
    }

    // Step 2: Link to ELF
    let elf_path = work_dir.path().join(&elf_name);
    let mut cmd = Command::new("arm-none-eabi-gcc");
    cmd.args([
        "-mcpu=cortex-m3", "-mthumb",
        "-nostartfiles",
        work_dir.path().join(&obj_name).to_str().unwrap(),
        "-o", elf_path.to_str().unwrap(),
    ]);
    cmd.current_dir(work_dir.path());

    match run_command_with_timeout(cmd, COMPILE_TIMEOUT) {
        Ok(o) if o.status.success() => {
            // Step 3: Convert ELF to BIN
            let bin_path = work_dir.path().join(&bin_name);
            let mut cmd = Command::new("arm-none-eabi-objcopy");
            cmd.args(["-O", "binary", elf_path.to_str().unwrap(), bin_path.to_str().unwrap()]);
            cmd.current_dir(work_dir.path());
            let _ = run_command_with_timeout(cmd, COMPILE_TIMEOUT);

            CompileResult {
                success: true,
                stdout: String::from_utf8_lossy(&o.stdout).to_string(),
                stderr: String::new(),
                output_path: Some(elf_path.to_string_lossy().to_string()),
                output_format: Some("elf".to_string()),
            }
        }
        Ok(o) => CompileResult {
            success: false,
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            output_path: None,
            output_format: None,
        },
        Err(e) => CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("链接失败: {}", e),
            output_path: None,
            output_format: None,
        },
    }
}

// ---------- Arduino (avr-gcc) ----------

fn compile_arduino(req: &CompileRequest) -> CompileResult {
    let work_dir = match tempdir() {
        Ok(d) => d,
        Err(e) => return CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("创建临时目录失败: {}", e),
            output_path: None,
            output_format: None,
        },
    };

    // Arduino .ino needs to be wrapped for avr-gcc
    let wrapped = format!(
        "#include <Arduino.h>\n{}\n",
        req.source
    );
    let src_path = work_dir.path().join(&req.filename);
    let _ = std::fs::write(&src_path, &wrapped);

    let obj_name = req.filename.replace(".ino", ".o").replace(".c", ".o");
    let elf_name = req.filename.replace(".ino", ".elf").replace(".c", ".elf");

    // Compile
    let mut cmd = Command::new("avr-gcc");
    cmd.args([
        "-mmcu=atmega328p", "-DF_CPU=16000000L",
        "-Os", "-Wall",
        "-c", src_path.to_str().unwrap(),
        "-o", work_dir.path().join(&obj_name).to_str().unwrap(),
    ]);
    cmd.current_dir(work_dir.path());

    let compile_output = match run_command_with_timeout(cmd, COMPILE_TIMEOUT) {
        Ok(o) => o,
        Err(e) => return CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("avr-gcc 执行失败: {}。请确认已安装: brew install avr-gcc", e),
            output_path: None,
            output_format: None,
        },
    };

    if !compile_output.status.success() {
        return CompileResult {
            success: false,
            stdout: String::from_utf8_lossy(&compile_output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&compile_output.stderr).to_string(),
            output_path: None,
            output_format: None,
        };
    }

    // Link
    let elf_path = work_dir.path().join(&elf_name);
    let mut cmd = Command::new("avr-gcc");
    cmd.args([
        "-mmcu=atmega328p",
        work_dir.path().join(&obj_name).to_str().unwrap(),
        "-o", elf_path.to_str().unwrap(),
    ]);
    cmd.current_dir(work_dir.path());

    match run_command_with_timeout(cmd, COMPILE_TIMEOUT) {
        Ok(o) if o.status.success() => {
            // Convert to hex
            let hex_name = req.filename.replace(".ino", ".hex").replace(".c", ".hex");
            let hex_path = work_dir.path().join(&hex_name);
            let mut cmd = Command::new("avr-objcopy");
            cmd.args(["-O", "ihex", "-R", ".eeprom", elf_path.to_str().unwrap(), hex_path.to_str().unwrap()]);
            cmd.current_dir(work_dir.path());
            let _ = run_command_with_timeout(cmd, COMPILE_TIMEOUT);

            CompileResult {
                success: true,
                stdout: String::from_utf8_lossy(&o.stdout).to_string(),
                stderr: String::new(),
                output_path: Some(hex_path.to_string_lossy().to_string()),
                output_format: Some("hex".to_string()),
            }
        }
        Ok(o) => CompileResult {
            success: false,
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            output_path: None,
            output_format: None,
        },
        Err(e) => CompileResult {
            success: false,
            stdout: String::new(),
            stderr: format!("链接失败: {}", e),
            output_path: None,
            output_format: None,
        },
    }
}

// ---------- ESP32 (placeholder) ----------

fn compile_esp32(_req: &CompileRequest) -> CompileResult {
    CompileResult {
        success: false,
        stdout: String::new(),
        stderr: "ESP32 编译暂未实现，需要安装 ESP-IDF 工具链".to_string(),
        output_path: None,
        output_format: None,
    }
}

#!/bin/bash
# download-qemu.sh — 下载 QEMU 二进制文件到 Tauri resources
# 在 CI 构建前调用，或本地开发时手动运行

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$SCRIPT_DIR/../src-tauri/resources/qemu"
QEMU_VERSION="10.2.2"

mkdir -p "$RESOURCES_DIR"

OS="$(uname -s)"
ARCH="$(uname -m)"

echo "下载 QEMU $QEMU_VERSION ($OS $ARCH)..."

case "$OS" in
  Darwin)
    if [ "$ARCH" = "arm64" ]; then
      # macOS ARM — 从 Homebrew 复制（CI 中用 brew install qemu）
      if command -v qemu-system-arm &>/dev/null; then
        QEMU_PATH="$(brew --prefix qemu)/bin"
        cp "$QEMU_PATH/qemu-system-arm" "$RESOURCES_DIR/"
        cp "$QEMU_PATH/qemu-system-xtensa" "$RESOURCES_DIR/" 2>/dev/null || true
        echo "已从 Homebrew 复制 QEMU"
      else
        echo "请先安装 QEMU: brew install qemu"
        exit 1
      fi
    else
      echo "Intel Mac: 从 Homebrew 复制"
      QEMU_PATH="$(brew --prefix qemu)/bin"
      cp "$QEMU_PATH/qemu-system-arm" "$RESOURCES_DIR/"
      cp "$QEMU_PATH/qemu-system-xtensa" "$RESOURCES_DIR/" 2>/dev/null || true
    fi
    ;;
    
  Linux)
    # Linux — 从 apt 安装后复制，或直接下载静态编译版
    if command -v qemu-system-arm &>/dev/null; then
      cp "$(which qemu-system-arm)" "$RESOURCES_DIR/"
      cp "$(which qemu-system-xtensa)" "$RESOURCES_DIR/" 2>/dev/null || true
      echo "已从系统复制 QEMU"
    else
      echo "请先安装 QEMU: sudo apt-get install qemu-system-arm"
      exit 1
    fi
    ;;
    
  MINGW*|MSYS*|CYGWIN*)
    # Windows — 从 GitHub 下载预编译版
    QEMU_URL="https://qemu.weilnetz.de/w64/2024/qemu-w64-setup-20241212.exe"
    echo "Windows: 请从 $QEMU_URL 下载并手动提取 qemu-system-arm.exe"
    echo "放置到: $RESOURCES_DIR/"
    ;;
    
  *)
    echo "不支持的平台: $OS"
    exit 1
    ;;
esac

# 确保文件可执行
chmod +x "$RESOURCES_DIR/"* 2>/dev/null || true

echo "QEMU 二进制文件已就绪:"
ls -lh "$RESOURCES_DIR/"

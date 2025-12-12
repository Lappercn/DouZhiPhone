<div align="center">
  <h1>🤖 豆汁手机 (DouZhi Phone)</h1>
  
  <p>
    <strong>字节有豆包 · 我们有豆汁</strong><br>
    <span style="font-size: 1.2em; color: #409EFF;">✨ Intelligent • Visual • Autonomous ✨</span>
  </p>

  <p>
    <a href="#-introduction">Introduction</a> •
    <a href="#-features">Features</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-contributing">Contributing</a>
  </p>
</div>

---

## 📖 Introduction (项目简介)

**DouZhi Phone** (豆汁手机) is an advanced Android automation agent powered by Large Language Models (LLMs) and Computer Vision. Unlike traditional automation tools that rely on rigid scripts or XML hierarchy dumps, DouZhi "sees" the screen and "thinks" about how to operate apps, just like a human.

Whether you are a QA engineer looking to automate complex test scenarios, or a developer exploring the future of AI agents, DouZhi Phone provides a robust and extensible platform.

**豆汁手机 (DouZhi Phone)** 是一款基于多模态大模型（LLM）与计算机视觉驱动的 Android 智能助手。它不依赖传统的控件树（XML）解析，而是像人类一样通过“视觉”理解屏幕内容，并智能规划操作路径。无论你是自动化测试工程师，还是 AI Agent 探索者，豆汁手机都能为你提供强大的支持。

## ✨ Features (核心特性)

- **🗣️ Natural Language Control**: Tell it what to do (e.g., "Send a message to Mom on WeChat"), and it figures out the rest.
- **👁️ Vision-Driven**: Uses screenshots and normalized coordinates (0-1000) for interaction, making it compatible with apps that block accessibility services.
- **🧠 Smart Reasoning**: Implements an "Observation-Thought-Action" loop with self-correction capabilities. It verifies its own actions and retries if necessary.
- **⚡ High Performance**: Optimized ADB communication and intelligent input handling (automatic keyboard switching, text clearing).
- **🛡️ Safe & Controlled**: Includes loop detection and repetition warnings to prevent runaway automation.

## 🚀 Quick Start (新手教程)

### Prerequisites (准备工作)
1.  **Node.js**: Version 18 or higher.
2.  **ADB Tools**: Ensure `adb` is in your system PATH.
3.  **Android Device**: A physical phone or emulator (USB debugging enabled).
4.  **Doubao API Key**: You need an API key from [Doubao/Volcengine](https://www.volcengine.com/) (or compatible LLM provider).

### Installation (安装步骤)

1.  **Clone the repository**
    ```bash
    git clone https://github.com/YourUsername/DouZhiPhone.git
    cd DouZhiPhone
    ```

2.  **Install Backend Dependencies**
    ```bash
    npm install
    ```

3.  **Configure API Key**
    Edit `config/default.json` (or create `config/local.json`) and add your API key:
    ```json
    {
      "doubao": {
        "apiKey": "YOUR_API_KEY_HERE",
        "model": "doubao-pro-32k"
      }
    }
    ```

### Running the Application (启动运行)

**Step 1: Start the Backend Server**
```bash
# In the root directory
npm run server
```

**Step 2: Start the Frontend UI**
Open a new terminal:
```bash
cd frontend
npm install
npm run dev
```

**Step 3: Connect & Control**
1.  Connect your Android phone via USB.
2.  Open `http://localhost:5173` in your browser.
3.  You should see your device screen mirrored. Type a command like "Open Settings and check WiFi" to start!

## 🏗️ Architecture (技术架构)

DouZhi Phone adopts a modern, decoupled architecture:

*   **Frontend**: Vue 3 + Element Plus (Responsive UI, Screen Mirroring)
*   **Backend**: Node.js + Express (API Server, ADB Management)
*   **Agent Core**: 
    *   **Planner**: LLM-based reasoning (Observation -> Thought -> Action).
    *   **Executor**: Robust command execution (ADB/Monkey/Shell).
    *   **Verifier**: Visual verification loop.

## 🤝 Contributing (加入我们)

We welcome contributions from the community! Whether it's fixing bugs, adding new features, or improving documentation, your help is appreciated.

**开源不易，期待共建！** 如果你对 AI Agent 感兴趣，或者在寻找一个能够落地的自动化方案，欢迎加入我们。

---

<div align="center">
  <p>© 2025 DouZhi Phone Team</p>
</div>

<div align="center">
  <img src="frontend/public/vite.svg" alt="Logo" width="100" height="100">

  <h1>🤖 豆汁手机 (DouZhi Phone)</h1>
  
  <p>
    <strong>字节有豆包 · 我们有豆汁</strong><br>
    <span style="font-size: 1.2em; color: #409EFF;">✨ 豆汁助手，你值得拥有 ✨</span>
  </p>

  <p>
    <a href="https://www.tongzhilian.cn" target="_blank">
      <img src="https://img.shields.io/badge/Website-通智联-blue?style=flat-square&logo=google-chrome" alt="Website">
    </a>
    <a href="https://gitee.com/Lapper/douzhi-phone" target="_blank">
      <img src="https://img.shields.io/badge/Gitee-国内仓库-c71d23?style=flat-square&logo=gitee" alt="Gitee">
    </a>
    <a href="https://github.com/Lappercn/DouZhiPhone" target="_blank">
      <img src="https://img.shields.io/badge/GitHub-国外仓库-181717?style=flat-square&logo=github" alt="GitHub">
    </a>
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
    # 国内推荐使用 Gitee
    git clone https://gitee.com/Lapper/douzhi-phone.git
    
    # Or GitHub
    git clone https://github.com/Lappercn/DouZhiPhone.git
    
    cd douzhi-phone
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

We are a passionate team dedicated to exploring the infinite possibilities of AI on mobile devices. **DouZhi Phone** is an open-source project that thrives on community contributions.

**我们是一个充满激情的技术团队，致力于探索 AI 与移动端的无限可能。**

### 🌟 Why Join Us? (为什么加入我们？)

*   **Cutting-Edge Tech**: Work with the latest LLMs (Doubao, GPT-4o) and Computer Vision tech.
*   **Impact**: Build a tool that could revolutionize mobile testing and automation.
*   **Community**: Connect with like-minded geeks and developers.

### 🚀 How to Contribute (如何贡献)

- **Submit PRs**: Fix bugs, add features (e.g., support for more apps, better reasoning).
- **Report Issues**: Found a bug? Let us know on [Gitee Issues](https://gitee.com/Lapper/douzhi-phone/issues) or [GitHub Issues](https://github.com/Lappercn/DouZhiPhone/issues).
- **Spread the Word**: Star the repo and share it with your friends!

**国内开发者**：推荐使用 [Gitee 仓库](https://gitee.com/Lapper/douzhi-phone) 提交 Issue 和 PR。
**Global Developers**: Please use [GitHub Repository](https://github.com/Lappercn/DouZhiPhone).

### ☕ Connect with Us (联系我们)

- **Official Website**: [www.tongzhilian.cn](https://www.tongzhilian.cn)
- **Email**: contact@tongzhilian.cn (Placeholder, replace if needed)

Let's make mobile automation smarter, together! 让我们一起把“豆汁”熬得更浓、更香！🔥

---

<div align="center">
  <p>© 2025 DouZhi Phone Team | Powered by <a href="https://www.tongzhilian.cn">同智联</a></p>
</div>

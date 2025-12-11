# 豆汁手机 (DouZhi Phone)

AI 驱动的 Android 手机自动化助手，让操作更简单、更智能。

## � 快速启动

### 1. 启动后端服务
在项目根目录下运行：

```bash
# 安装依赖
npm install

# 启动服务
npm run server
```

### 2. 启动前端界面
打开新的终端窗口，进入 `frontend` 目录并运行：

```bash
cd frontend

# 安装依赖
npm install

# 启动界面
npm run dev
```

### 3. 开始使用
1. 确保 Android 手机已通过 USB 连接电脑，并开启 **USB调试** 模式。
2. 浏览器会自动打开或手动访问终端显示的地址（通常是 `http://localhost:5173`）。
3. 在网页控制台输入指令即可控制手机（例如："打开设置"、"截屏"）。

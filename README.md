# AI手机自动化助手

基于豆包大模型和Node.js的Android手机自动化操作工具。用户只需用自然语言描述想要执行的操作，AI会自动理解需求、规划步骤、生成命令并执行。

## 核心特性

- 🤖 **多智能体协同架构**
  - Agent-Intent/Plan: 豆包大模型负责需求理解和命令生成
  - Agent-Exec: Node.js执行器负责命令执行和安全校验
  - Agent-Verifier: 自动验证执行结果

- 🧠 **智能规划**
  - 自然语言直接生成ADB命令序列
  - 自动规划最优执行路径
  - 支持失败重试和重新规划

- 🔒 **安全可靠**
  - 命令白名单机制
  - 危险操作自动拦截
  - 执行结果自动验证

- 📱 **设备管理**
  - 自动发现连接的设备
  - 设备状态检查（亮屏、解锁）
  - 支持多设备操作

## 系统要求

- Node.js 18+ 
- Android设备（Android 8.0+）
- ADB工具（Android SDK Platform Tools）
- 豆包API密钥

## 安装

1. 克隆项目
```bash
git clone <repository-url>
cd ai-phone-automation
```

2. 安装依赖
```bash
npm install
```

3. 配置豆包API
编辑 `config/default.json`，填入你的豆包API配置：
```json
{
  "doubao": {
    "apiKey": "你的API密钥",
    "apiUrl": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    "model": "你的模型端点ID"
  }
}
```

4. 确保ADB可用
```bash
adb version
```

## 使用方法

### 交互模式

直接运行程序，进入交互式界面：

```bash
npm start
```

然后输入自然语言描述，例如：
- "打开设置把亮度调到50%并截屏"
- "打开微信，发送消息给张三说你好"
- "截屏并保存到电脑桌面"

### 命令行模式

```bash
npm start "打开设置把亮度调到50%"
npm start "截屏" <device_serial>
```

## 配置说明

### 豆包API配置

在 `config/default.json` 中配置：

- `apiKey`: 豆包API密钥
- `apiUrl`: API端点URL
- `model`: 模型端点ID
- `timeout`: 请求超时时间（毫秒）

### 安全配置

- `whitelist`: 允许的命令白名单
- `blockedCommands`: 禁止的命令关键词
- `requireConfirm`: 需要确认的命令

### 执行配置

- `maxRetries`: 最大重试次数
- `defaultBackoff`: 默认重试延迟（毫秒）
- `verifyTimeout`: 验证超时时间（毫秒）

## 工作原理

1. **需求理解**: 用户输入自然语言，豆包大模型解析意图
2. **计划生成**: 模型生成结构化的执行计划（JSON格式）
3. **命令执行**: Node.js执行器执行ADB命令
4. **结果验证**: 自动验证执行结果是否符合预期
5. **错误处理**: 失败时自动重试或请求重新规划

## 执行计划格式

模型生成的计划格式如下：

```json
{
  "steps": [
    {
      "id": "s1",
      "desc": "打开设置",
      "cmd": "adb -s {serial} shell am start -n com.android.settings/.Settings",
      "expect": "前台应用为设置",
      "verify": ["check_foreground:com.android.settings"],
      "retry": {"times": 2, "backoff_ms": 500},
      "on_fail": "abort"
    }
  ],
  "risks": [],
  "notes": []
}
```

## 验证方法

支持的验证方法：

- `check_foreground:<package>` - 检查前台应用
- `check_file:<path>` - 检查文件是否存在
- `check_brightness:<value>` - 检查亮度值（0-100）
- `check_node:<selector>` - 检查UI节点
- `uia_select:<by>:<value>:<action>` - UI选择器操作

## 注意事项

1. **设备状态**: 设备必须已解锁且屏幕常亮，程序不会自动解锁
2. **权限要求**: 需要启用USB调试并授权计算机
3. **网络要求**: 需要网络连接以调用豆包API
4. **安全限制**: 某些危险操作会被自动拦截

## 开发

### 项目结构

```
src/
  ├── agent/          # 智能体模块
  │   └── DoubaoAgent.js
  ├── device/         # 设备管理
  │   └── DeviceManager.js
  ├── executor/       # 命令执行
  │   └── CommandExecutor.js
  ├── verifier/       # 结果验证
  │   └── Verifier.js
  ├── orchestrator/   # 协调器
  │   └── Orchestrator.js
  ├── utils/          # 工具类
  │   └── logger.js
  └── index.js        # 入口文件
```

### 扩展开发

- 添加新的验证方法：编辑 `src/verifier/Verifier.js`
- 添加新的命令支持：更新白名单和命令执行逻辑
- 自定义提示词：编辑 `src/agent/DoubaoAgent.js` 中的 `buildSystemPrompt`

## 故障排除

### 设备未找到
- 检查USB连接
- 确认USB调试已启用
- 运行 `adb devices` 检查

### API调用失败
- 检查网络连接
- 验证API密钥和端点配置
- 查看日志文件了解详细错误

### 执行失败
- 确认设备已解锁
- 检查命令是否在白名单中
- 查看执行日志了解失败原因

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！


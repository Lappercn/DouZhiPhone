import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Orchestrator from './orchestrator/Orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载配置
function loadConfig() {
  try {
    const defaultConfigPath = join(__dirname, '../config/default.json');
    const defaultConfig = JSON.parse(readFileSync(defaultConfigPath, 'utf8'));
    
    const localConfigPath = join(__dirname, '../config/local.json');
    let localConfig = {};
    if (existsSync(localConfigPath)) {
      localConfig = JSON.parse(readFileSync(localConfigPath, 'utf8'));
    }
    
    // 简单的深拷贝合并
    const config = { ...defaultConfig, ...localConfig };
    // 确保嵌套对象也被正确合并 (针对 doubao 配置)
    if (localConfig.doubao) {
      config.doubao = { ...defaultConfig.doubao, ...localConfig.doubao };
    }
    
    return config;
  } catch (error) {
    console.error('加载配置失败:', error.message);
    process.exit(1);
  }
}

const config = loadConfig();
const orchestrator = new Orchestrator(config);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // 允许跨域
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// 设置日志回调，推送到 WebSocket
orchestrator.logger.setLogCallback((entry) => {
  if (entry.type === 'screenshot') {
    io.emit('screen_update', entry.data);
  } else {
    io.emit('log', entry);
  }
});

// API: 获取设备列表
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await orchestrator.deviceManager.listDevices();
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 启用 ADB over TCP/IP
app.post('/api/device/tcpip', async (req, res) => {
  const { serial, port } = req.body;
  if (!serial) return res.status(400).json({ success: false, error: 'Serial is required' });
  
  const result = await orchestrator.deviceManager.enableTcpIp(serial, port);
  res.json(result);
});

// API: 连接远程设备
app.post('/api/device/connect', async (req, res) => {
  const { ip, port } = req.body;
  if (!ip) return res.status(400).json({ success: false, error: 'IP is required' });
  
  const result = await orchestrator.deviceManager.connectRemote(ip, port);
  res.json(result);
});

// API: 断开远程设备
app.post('/api/device/disconnect', async (req, res) => {
  const { ip, port } = req.body;
  if (!ip) return res.status(400).json({ success: false, error: 'IP is required' });
  
  const result = await orchestrator.deviceManager.disconnectRemote(ip, port);
  res.json(result);
});

// API: 执行任务
app.post('/api/task', async (req, res) => {
  const { query, deviceSerial } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  // 生成 reqId 并立即返回，以便前端控制
  const reqId = orchestrator.generateRequestId();

  // 异步执行任务，不阻塞响应
  orchestrator.executeRequest(query, deviceSerial, reqId)
    .then(result => {
      io.emit('task_completed', result);
    })
    .catch(error => {
      io.emit('task_error', { message: error.message });
    });

  res.json({ success: true, message: 'Task started', reqId });
});

// API: 停止任务
app.post('/api/task/:reqId/stop', (req, res) => {
  const { reqId } = req.params;
  const success = orchestrator.stopRequest(reqId);
  if (success) {
    res.json({ success: true, message: 'Task stop signal sent' });
  } else {
    res.status(404).json({ success: false, message: 'Task not found or already stopped' });
  }
});

// API: 暂停任务
app.post('/api/task/:reqId/pause', (req, res) => {
  const { reqId } = req.params;
  const success = orchestrator.pauseRequest(reqId);
  if (success) {
    res.json({ success: true, message: 'Task paused' });
  } else {
    res.status(404).json({ success: false, message: 'Task not found or not running' });
  }
});

// API: 恢复任务
app.post('/api/task/:reqId/resume', (req, res) => {
  const { reqId } = req.params;
  const success = orchestrator.resumeRequest(reqId);
  if (success) {
    res.json({ success: true, message: 'Task resumed' });
  } else {
    res.status(404).json({ success: false, message: 'Task not found or not paused' });
  }
});

// API: 获取屏幕截图
app.get('/api/screenshot', async (req, res) => {
  const { serial } = req.query;
  if (!serial) return res.status(400).send('Serial required');
  
  try {
    const base64 = await orchestrator.deviceManager.getScreenshotBase64(serial);
    if (base64) {
      const img = Buffer.from(base64, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
      });
      res.end(img); 
    } else {
      res.status(404).send('Screenshot failed');
    }
  } catch (e) {
    res.status(500).send(e.message);
  }
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

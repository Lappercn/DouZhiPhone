import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Orchestrator from './orchestrator/Orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载配置
function loadConfig() {
  try {
    const configPath = join(__dirname, '../config/default.json');
    return JSON.parse(readFileSync(configPath, 'utf8'));
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

// API: 执行任务
app.post('/api/task', async (req, res) => {
  const { query, deviceSerial } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  // 异步执行任务，不阻塞响应
  // 注意：Orchestrator 目前设计可能不支持并发，这里简单处理
  orchestrator.executeRequest(query, deviceSerial)
    .then(result => {
      io.emit('task_completed', result);
    })
    .catch(error => {
      io.emit('task_error', { message: error.message });
    });

  res.json({ success: true, message: 'Task started' });
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

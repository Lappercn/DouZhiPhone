// 简单的测试脚本
import Orchestrator from './orchestrator/Orchestrator.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadConfig() {
  const configPath = join(__dirname, '../config/default.json');
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

async function test() {
  const config = loadConfig();
  const orchestrator = new Orchestrator(config);

  console.log('测试: 列出设备');
  const devices = await orchestrator.deviceManager.listDevices();
  console.log('设备列表:', devices);

  if (devices.length > 0) {
    const serial = devices[0].serial;
    console.log(`\n测试: 检查设备状态 (${serial})`);
    const state = await orchestrator.deviceManager.checkDeviceReady(serial);
    console.log('设备状态:', state);

    console.log(`\n测试: 获取前台Activity`);
    const activity = await orchestrator.deviceManager.getForegroundActivity(serial);
    console.log('前台Activity:', activity);
  }
}

test().catch(console.error);


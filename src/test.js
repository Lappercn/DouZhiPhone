// 简单的测试脚本
import Orchestrator from './orchestrator/Orchestrator.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadConfig() {
  const defaultConfigPath = join(__dirname, '../config/default.json');
  const defaultConfig = JSON.parse(readFileSync(defaultConfigPath, 'utf8'));
  
  const localConfigPath = join(__dirname, '../config/local.json');
  let localConfig = {};
  if (existsSync(localConfigPath)) {
    localConfig = JSON.parse(readFileSync(localConfigPath, 'utf8'));
  }
  
  const config = { ...defaultConfig, ...localConfig };
  if (localConfig.doubao) {
    config.doubao = { ...defaultConfig.doubao, ...localConfig.doubao };
  }
  
  return config;
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


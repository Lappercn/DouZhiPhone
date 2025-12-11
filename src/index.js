import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Orchestrator from './orchestrator/Orchestrator.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

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
    
    // 简单的深拷贝合并 (或者使用 lodash.merge，这里手动合并关键部分)
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

// CLI 交互模式
async function interactiveMode() {
  const config = loadConfig();
  const orchestrator = new Orchestrator(config);

  console.log(chalk.blue.bold('\n=== AI手机自动化助手 ===\n'));

  // 检查设备
  console.log('正在检查设备...');
  const devices = await orchestrator.deviceManager.listDevices();
  
  if (devices.length === 0) {
    console.error(chalk.red('错误: 没有找到连接的Android设备'));
    console.log(chalk.yellow('请确保:'));
    console.log('  1. 设备已通过USB连接');
    console.log('  2. 已启用USB调试');
    console.log('  3. 已授权此计算机');
    process.exit(1);
  }

  console.log(chalk.green(`找到 ${devices.length} 个设备:`));
  devices.forEach((device, index) => {
    console.log(`  ${index + 1}. ${device.serial} (${device.model}, Android ${device.androidVersion})`);
  });

  let deviceSerial = devices[0].serial;
  if (devices.length > 1) {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: '选择要操作的设备:',
        choices: devices.map(d => ({ name: `${d.serial} (${d.model})`, value: d.serial }))
      }
    ]);
    deviceSerial = selected;
  }

  // 检查设备状态
  console.log('\n正在检查设备状态...');
  const deviceState = await orchestrator.deviceManager.checkDeviceReady(deviceSerial);
  
  if (!deviceState.screenOn) {
    console.error(chalk.red('错误: 设备屏幕未亮屏'));
    console.log(chalk.yellow('请手动唤醒设备后重试'));
    process.exit(1);
  }
  
  if (!deviceState.unlocked) {
    console.error(chalk.red('错误: 设备未解锁'));
    console.log(chalk.yellow('请手动解锁设备后重试'));
    process.exit(1);
  }

  console.log(chalk.green('设备就绪!'));
  console.log(`  前台应用: ${deviceState.foregroundActivity || 'Unknown'}\n`);

  // 主循环
  while (true) {
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: '请输入要执行的操作 (输入 "exit" 退出):',
        validate: (input) => {
          if (!input.trim()) {
            return '请输入操作描述';
          }
          return true;
        }
      }
    ]);

    if (query.toLowerCase() === 'exit') {
      console.log(chalk.blue('再见!'));
      break;
    }

    try {
      console.log(chalk.cyan(`\n正在处理: ${query}\n`));
      
      const result = await orchestrator.executeRequest(query, deviceSerial);
      
      if (result.success) {
        console.log(chalk.green('\n✓ 执行成功!'));
        console.log(`  完成步骤: ${result.summary.success}/${result.summary.total}`);
      } else {
        console.log(chalk.yellow('\n⚠ 执行部分失败'));
        console.log(`  成功: ${result.summary.success}, 失败: ${result.summary.failed}`);
        
        const failedSteps = result.results.filter(r => !r.success);
        failedSteps.forEach(step => {
          console.log(chalk.red(`  - ${step.stepId}: ${step.error || '未知错误'}`));
        });
      }
      
      console.log();
    } catch (error) {
      console.error(chalk.red(`\n✗ 执行失败: ${error.message}\n`));
    }
  }
}

// 命令行参数模式
async function commandLineMode(query, deviceSerial = null) {
  const config = loadConfig();
  const orchestrator = new Orchestrator(config);

  try {
    const result = await orchestrator.executeRequest(query, deviceSerial);
    
    if (result.success) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } else {
      console.error('执行失败');
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

// 主入口
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // 命令行模式
    const query = args[0];
    const deviceSerial = args[1] || null;
    await commandLineMode(query, deviceSerial);
  } else {
    // 交互模式
    await interactiveMode();
  }
}

main().catch(error => {
  console.error('程序异常:', error);
  process.exit(1);
});


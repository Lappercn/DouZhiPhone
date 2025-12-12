import { execa } from 'execa';
import Logger from '../utils/logger.js';
import APP_PACKAGES from '../config/apps.js';

class CommandExecutor {
  constructor(deviceManager, securityConfig = {}, logger = null) {
    this.deviceManager = deviceManager;
    this.whitelist = securityConfig.whitelist || [];
    this.blockedCommands = securityConfig.blockedCommands || [];
    this.requireConfirm = securityConfig.requireConfirm || [];
    this.logger = logger || new Logger();
  }

  /**
   * 检查命令是否允许（已移除白名单/黑名单限制）
   */
  isCommandAllowed(cmd) {
    // 不再进行白名单/黑名单检查，直接允许
    return { allowed: true };
  }

  /**
   * 检查命令是否是完整的 adb 命令
   */
  isFullAdbCommand(cmd) {
    return /^adb\s+(-s\s+\S+\s+)?(shell|pull|push|install|uninstall)/i.test(cmd.trim());
  }

  /**
   * 替换命令中的 {serial} 占位符
   */
  replaceSerialPlaceholder(cmd, serial) {
    return cmd.replace(/\{serial\}/g, serial);
  }

  /**
   * 执行完整的 adb 命令（直接执行，不通过 execAdb）
   */
  async executeFullAdbCommand(cmd, serial) {
    // 替换序列号占位符
    let fullCmd = this.replaceSerialPlaceholder(cmd, serial);
    
    // 解析命令
    const parts = fullCmd.trim().split(/\s+/);
    const adbPath = 'adb';
    const args = parts.slice(1); // 去掉 'adb'
    
    try {
      const { stdout, stderr, exitCode } = await execa(adbPath, args, {
        timeout: 8000,
        encoding: 'utf8'
      });
      
      return {
        success: exitCode === 0,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: -1,
        error
      };
    }
  }

  /**
   * 处理中文输入命令
   */
  async handleChineseInput(cmd, serial) {
    // 检查是否是 input text 命令且包含中文
    const textMatch = cmd.match(/input\s+text\s+["'](.+?)["']/i);
    if (textMatch) {
      const text = textMatch[1];
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      
      if (hasChinese) {
        this.logger.debug('检测到中文输入，使用增强输入方式(ADBKeyBoard/剪贴板)', { text });
        const success = await this.deviceManager.inputText(serial, text);
        return {
          success,
          stdout: '',
          stderr: success ? '' : '中文输入失败',
          exitCode: success ? 0 : -1
        };
      }
    }
    return null;
  }

  /**
   * 执行单个命令
   */
  async executeCommand(step, serial) {
    const { id, cmd, desc } = step;
    
    this.logger.step(id, `执行: ${desc || cmd}`);

    // 检查是否是中文输入，如果是则特殊处理
    const chineseInputResult = await this.handleChineseInput(cmd, serial);
    if (chineseInputResult !== null) {
      if (!chineseInputResult.success) {
        throw new Error(`中文输入失败: ${chineseInputResult.stderr}`);
      }
      return {
        stepId: id,
        success: true,
        stdout: chineseInputResult.stdout,
        stderr: chineseInputResult.stderr,
        exitCode: chineseInputResult.exitCode
      };
    }

    let result;
    
    // 如果豆包生成的是完整的 adb 命令，直接执行
    if (this.isFullAdbCommand(cmd)) {
      this.logger.debug('检测到完整 adb 命令，直接执行', { stepId: id });
      result = await this.executeFullAdbCommand(cmd, serial);
    } else {
      // 否则作为 shell 命令通过 execAdb 执行
      // 替换 {serial} 占位符
      const shellCmd = this.replaceSerialPlaceholder(cmd, serial);
      
      // 检查是否需要确认
      const needsConfirm = this.requireConfirm.some(pattern => shellCmd.includes(pattern));
      if (needsConfirm) {
        this.logger.warn(`命令需要确认: ${shellCmd}`);
        // 这里可以添加用户确认逻辑
      }

      result = await this.deviceManager.execAdb(serial, shellCmd);
    }
    
    if (!result.success) {
      this.logger.error(`命令执行失败: ${cmd}`, null, {
        stepId: id,
        exitCode: result.exitCode,
        stderr: result.stderr
      });
      throw new Error(`命令执行失败: ${result.stderr || 'Unknown error'}`);
    }

    this.logger.debug(`命令执行成功: ${cmd}`, {
      stepId: id,
      stdout: result.stdout.substring(0, 200) // 只记录前200字符
    });

    return {
      stepId: id,
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  }

  /**
   * 执行命令并重试
   */
  async executeWithRetry(step, serial, retryConfig = {}) {
    const maxRetries = retryConfig.times || 1;
    const backoff = retryConfig.backoff_ms || 500;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeCommand(step, serial);
        if (attempt > 1) {
          this.logger.info(`重试成功 (尝试 ${attempt}/${maxRetries})`, { stepId: step.id });
        }
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          this.logger.warn(`执行失败，${backoff}ms后重试 (${attempt}/${maxRetries})`, {
            stepId: step.id,
            error: error.message
          });
          await this.sleep(backoff);
        }
      }
    }

    throw lastError || new Error('执行失败');
  }

  /**
   * 等待
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================
  // High-Level Action Handlers (Open-AutoGLM Style)
  // ==========================================

  /**
   * 执行高层动作
   * @param {Object} action - 动作对象 { action: "Tap", element: [x, y], ... }
   * @param {String} serial - 设备序列号
   * @param {Number} screenWidth - 屏幕宽度
   * @param {Number} screenHeight - 屏幕高度
   */
  async executeAction(action, serial, screenWidth, screenHeight) {
    const actionName = action.action;
    this.logger.info(`Executing action: ${actionName}`, { action, serial });

    try {
      switch (actionName) {
        case 'Tap':
          return await this.handleTap(action, serial, screenWidth, screenHeight);
        case 'Swipe':
          return await this.handleSwipe(action, serial, screenWidth, screenHeight);
        case 'Type':
        case 'Type_Name':
          return await this.handleType(action, serial);
        case 'Back':
          return await this.handleBack(serial);
        case 'Home':
          return await this.handleHome(serial);
        case 'Launch':
          return await this.handleLaunch(action, serial);
        case 'Wait':
          return await this.handleWait(action);
        case 'Double Tap':
            return await this.handleDoubleTap(action, serial, screenWidth, screenHeight);
        case 'Long Press':
            return await this.handleLongPress(action, serial, screenWidth, screenHeight);
        default:
          this.logger.warn(`Unknown action: ${actionName}`, { action });
          return { success: false, message: `Unknown action: ${actionName}` };
      }
    } catch (error) {
      this.logger.error(`Action execution failed: ${actionName}`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 相对坐标转绝对坐标 (1000x1000 -> pixels)
   */
  convertRelativeToAbsolute(element, width, height) {
    if (!element) {
        throw new Error('Element coordinates are undefined');
    }
    
    // 如果 element 是数组 [x, y]
    if (Array.isArray(element)) {
        if (element.length < 2) {
             throw new Error(`Invalid coordinate array length: ${element.length}`);
        }
        const x = Math.floor((element[0] / 1000) * width);
        const y = Math.floor((element[1] / 1000) * height);
        return { x, y };
    }
    
    // 如果 element 是对象 {x, y} (虽然 Open-AutoGLM 通常用数组，但防守式编程)
    if (typeof element === 'object' && element.x !== undefined && element.y !== undefined) {
         const x = Math.floor((element.x / 1000) * width);
         const y = Math.floor((element.y / 1000) * height);
         return { x, y };
    }

    throw new Error(`Invalid element format: ${JSON.stringify(element)}`);
  }

  async handleTap(action, serial, width, height) {
    const { x, y } = this.convertRelativeToAbsolute(action.element, width, height);
    // 使用 swipe 模拟点击更稳定 (100ms)
    // input swipe <x1> <y1> <x2> <y2> [duration(ms)]
    const cmd = `input swipe ${x} ${y} ${x} ${y} 100`;
    return await this.deviceManager.execAdb(serial, cmd);
  }

  async handleDoubleTap(action, serial, width, height) {
      const { x, y } = this.convertRelativeToAbsolute(action.element, width, height);
      // 双击：两次快速点击
      const cmd1 = `input tap ${x} ${y}`;
      const cmd2 = `input tap ${x} ${y}`;
      await this.deviceManager.execAdb(serial, cmd1);
      await this.sleep(50); // 间隔 50ms
      return await this.deviceManager.execAdb(serial, cmd2);
  }

  async handleLongPress(action, serial, width, height) {
      const { x, y } = this.convertRelativeToAbsolute(action.element, width, height);
      // 长按：duration > 500ms
      const cmd = `input swipe ${x} ${y} ${x} ${y} 1000`;
      return await this.deviceManager.execAdb(serial, cmd);
  }

  async handleSwipe(action, serial, width, height) {
    const start = this.convertRelativeToAbsolute(action.start, width, height);
    const end = this.convertRelativeToAbsolute(action.end, width, height);
    // 默认滑动时间 500ms
    const duration = action.duration || 500;
    const cmd = `input swipe ${start.x} ${start.y} ${end.x} ${end.y} ${duration}`;
    return await this.deviceManager.execAdb(serial, cmd);
  }

  async handleType(action, serial) {
    const text = action.text;
    if (!text) return { success: false, message: 'No text provided' };
    
    // 1. 先尝试清除已有文本 (这会自动切换到 ADBKeyboard)
    // 即使失败也不阻断流程，因为可能只是没安装 ADBKeyboard
    await this.deviceManager.clearText(serial);
    
    // 2. 等待一小会儿确保清除完成
    await this.sleep(500);

    // 3. 使用 DeviceManager 的智能输入（自动处理中文/ADBKeyBoard）
    const success = await this.deviceManager.inputText(serial, text);
    return { success };
  }

  async handleBack(serial) {
    return await this.deviceManager.execAdb(serial, 'input keyevent 4'); // KEYCODE_BACK
  }

  async handleHome(serial) {
    return await this.deviceManager.execAdb(serial, 'input keyevent 3'); // KEYCODE_HOME
  }

  // ==========================================
  // App Name to Package Mapping
  // ==========================================
  getAppPackage(appName) {
    // Exact match
    if (APP_PACKAGES[appName]) {
      return APP_PACKAGES[appName];
    }

    // Case-insensitive match
    const lowerName = appName.toLowerCase();
    for (const [name, pkg] of Object.entries(APP_PACKAGES)) {
      if (name.toLowerCase() === lowerName) {
        return pkg;
      }
    }

    // Return original if not found (maybe it's already a package name)
    return appName;
  }

  async handleLaunch(action, serial) {
    let app = action.app;
    if (!app) return { success: false, message: 'No app specified' };
    
    // Resolve package name
    const packageName = this.getAppPackage(app);
    this.logger.debug(`Launch app: ${app} -> ${packageName}`);

    // 特殊处理：如果是微信，直接使用 am start (因为 monkey 在某些设备上启动微信可能有问题，或者微信启动慢导致重复)
    if (packageName === 'com.tencent.mm') {
         this.logger.info('Using direct AM start for WeChat');
         // 微信通常的 Launcher Activity
         const wechatCmd = `am start -n com.tencent.mm/.ui.LauncherUI`;
         const result = await this.deviceManager.execAdb(serial, wechatCmd);
         // 无论成功与否，都等待更长时间
         await this.sleep(3000); 
         return result;
    }

    // 1. 尝试使用 monkey 启动
    const monkeyCmd = `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`;
    const monkeyResult = await this.deviceManager.execAdb(serial, monkeyCmd);

    // 检查 output，如果包含 "No activities found" 或者 events injected 为 0，则认为失败
    const monkeyOutput = monkeyResult.stdout || '';
    const isMonkeySuccess = monkeyResult.success && 
                            !monkeyOutput.includes('No activities found') && 
                            monkeyOutput.includes('Events injected: 1');

    if (isMonkeySuccess) {
        // Monkey 启动成功后，多等待一会儿，让应用加载
        await this.sleep(2000);
        return monkeyResult;
    }

    this.logger.warn(`Monkey launch failed for ${packageName}, trying 'am start'...`, { stdout: monkeyOutput });

    // 2. 回退方案：使用 am start (更可靠)
    // 先获取 Launch Activity
    // 注意：Windows 下使用 grep 可能有问题，直接获取全部输出然后在 JS 处理
    // 使用 dumpsys package 来查找 Main Activity 可能更准确，但输出量大
    // 尝试 cmd package resolve-activity
    const dumpCmd = `cmd package resolve-activity --brief ${packageName}`;
    const dumpResult = await this.deviceManager.execAdb(serial, dumpCmd);
    
    if (dumpResult.success && dumpResult.stdout) {
        // 查找类似 com.tencent.mm/.ui.LauncherUI 的字符串
        // 输出通常是:
        // Service: ...
        // com.package/.Activity
        const lines = dumpResult.stdout.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            // 匹配 com.package/com.package.Activity 格式
            if (trimmed.startsWith(packageName) && trimmed.includes('/')) {
                const activity = trimmed;
                this.logger.info(`Found launch activity: ${activity}`);
                const startCmd = `am start -n ${activity}`;
                const result = await this.deviceManager.execAdb(serial, startCmd);
                await this.sleep(2000);
                return result;
            }
        }
    }

    // 最后的尝试：不指定 Activity，只指定包名 (部分 Android 版本支持)
    const genericStartCmd = `monkey -p ${packageName} 1`;
    return await this.deviceManager.execAdb(serial, genericStartCmd);
  }

  async handleWait(action) {
    const durationStr = action.duration || "1 seconds";
    const duration = parseFloat(durationStr.replace("seconds", "").trim()) * 1000;
    await this.sleep(duration);
    return { success: true };
  }
}

export default CommandExecutor;


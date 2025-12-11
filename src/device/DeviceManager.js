import { execa } from 'execa';
import Logger from '../utils/logger.js';

class DeviceManager {
  constructor(adbPath = 'adb', logger = null) {
    this.adbPath = adbPath;
    this.logger = logger || new Logger();
    this.devices = new Map();
  }

  /**
   * 执行 ADB 命令
   */
  async execAdb(serial, command, options = {}) {
    const timeout = options.timeout || 8000;
    const args = serial ? ['-s', serial, 'shell', command] : ['shell', command];
    
    try {
      const { stdout, stderr, exitCode } = await execa(this.adbPath, args, {
        timeout,
        encoding: 'utf8'
      });
      
      return {
        success: exitCode === 0,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode
      };
    } catch (error) {
      this.logger.error(`ADB command failed: ${command}`, error, { serial });
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
   * 列出所有连接的设备
   */
  async listDevices() {
    try {
      const { stdout } = await execa(this.adbPath, ['devices', '-l'], {
        timeout: 5000
      });
      
      const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('List'));
      const devices = [];
      
      for (const line of lines) {
        const match = line.match(/^(\S+)\s+device/);
        if (match) {
          const serial = match[1];
          const info = await this.getDeviceInfo(serial);
          devices.push({ serial, ...info });
        }
      }
      
      return devices;
    } catch (error) {
      this.logger.error('Failed to list devices', error);
      return [];
    }
  }

  /**
   * 获取设备信息
   */
  async getDeviceInfo(serial) {
    const [model, androidVersion, screenSize] = await Promise.all([
      this.execAdb(serial, 'getprop ro.product.model'),
      this.execAdb(serial, 'getprop ro.build.version.release'),
      this.getScreenSize(serial)
    ]);

    return {
      model: model.stdout.trim() || 'Unknown',
      androidVersion: androidVersion.stdout.trim() || 'Unknown',
      screenSize: screenSize || { width: 0, height: 0 }
    };
  }

  /**
   * 获取屏幕尺寸
   */
  async getScreenSize(serial) {
    const result = await this.execAdb(serial, 'wm size');
    const match = result.stdout.match(/(\d+)x(\d+)/);
    if (match) {
      return { width: parseInt(match[1]), height: parseInt(match[2]) };
    }
    return { width: 0, height: 0 };
  }

  /**
   * 检查设备状态
   */
  async checkDeviceReady(serial) {
    const checks = await Promise.all([
      this.isScreenOn(serial),
      this.isUnlocked(serial),
      this.getForegroundActivity(serial)
    ]);

    return {
      screenOn: checks[0],
      unlocked: checks[1],
      foregroundActivity: checks[2],
      ready: checks[0] && checks[1]
    };
  }

  /**
   * 检查屏幕是否亮屏
   */
  async isScreenOn(serial) {
    const result = await this.execAdb(serial, 'dumpsys power');
    // 在输出中查找 mScreenOn 状态
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      if (line.includes('mScreenOn')) {
        return line.includes('mScreenOn=true');
      }
    }
    // 如果找不到 mScreenOn，尝试其他方法
    // 检查 Display Power: state=ON
    if (result.stdout.includes('Display Power: state=ON') || result.stdout.includes('mWakefulness=Awake')) {
      return true;
    }
    return false;
  }

  /**
   * 检查设备是否解锁（简单检查：是否有锁屏界面）
   */
  async isUnlocked(serial) {
    const result = await this.execAdb(serial, 'dumpsys window');
    const output = result.stdout || '';
    // 查找 mCurrentFocus
    const focusMatch = output.match(/mCurrentFocus[^\n]*/);
    const focus = focusMatch ? focusMatch[0] : '';
    // 如果焦点在锁屏相关界面，则认为未解锁
    const isLocked = focus.includes('Keyguard') || focus.includes('LockScreen') || focus.includes('KeyguardLockedView');
    return !isLocked;
  }

  /**
   * 获取前台 Activity
   */
  async getForegroundActivity(serial) {
    const result = await this.execAdb(serial, 'dumpsys activity activities');
    const output = result.stdout || '';
    // 查找 mResumedActivity
    const match = output.match(/mResumedActivity[^\n]*\{(\S+)\/(\S+)\//);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    // 如果找不到，尝试查找 mCurrentFocus
    const focusMatch = output.match(/mCurrentFocus[^\n]*\{(\S+)\/(\S+)\//);
    if (focusMatch) {
      return `${focusMatch[1]}/${focusMatch[2]}`;
    }
    return null;
  }

  /**
   * 截屏
   */
  async screenshot(serial, savePath = '/sdcard/screenshot.png') {
    const result = await this.execAdb(serial, `screencap -p ${savePath}`);
    return result.success;
  }

  /**
   * 截屏并返回 Base64
   */
  async getScreenshotBase64(serial) {
    try {
      // 使用 exec-out 流式获取，速度最快且不写文件
      const { stdout } = await execa(this.adbPath, ['-s', serial, 'exec-out', 'screencap -p'], {
        encoding: 'buffer',
        maxBuffer: 20 * 1024 * 1024 // 增加缓冲区大小以容纳图片
      });
      return stdout.toString('base64');
    } catch (error) {
      this.logger.error('Screenshot failed, falling back to legacy method', error);
      // 回退到传统方法: save to sdcard -> pull -> read -> delete
      try {
        const remotePath = `/sdcard/temp_screenshot_${Date.now()}.png`;
        await this.execAdb(serial, `screencap -p ${remotePath}`);
        
        // 我们需要一种读取远程文件内容的方法，这里简化处理：
        // 实际上最好还是通过 temp 文件拉取
        // 这里为了简单，如果流式失败，暂时返回 null，或者需要实现完整的回退逻辑
        return null; 
      } catch (e) {
        return null;
      }
    }
  }

  /**
   * 获取 Window Dump 信息
   */
  async getWindowDump(serial) {
    try {
      const { stdout } = await execa(this.adbPath, ['-s', serial, 'shell', 'dumpsys window windows'], {
        timeout: 5000
      });
      return stdout;
    } catch (error) {
      this.logger.error('Failed to dump windows', error);
      return null;
    }
  }

  /**
   * 解析 Window Dump 中的关键信息（简易版）
   */
  parseWindowDump(dumpContent) {
    if (!dumpContent) return null;
    
    const info = {
      focusedApp: null,
      visibleWindows: [],
      hasKeyboard: false
    };

    // 1. 查找当前前台应用 (mCurrentFocus 或 mResumedActivity)
    // mCurrentFocus=Window{... u0 com.package/Activity}
    const focusMatch = dumpContent.match(/mCurrentFocus=Window\{(\S+)\s+(\S+)\s+(\S+)\}/);
    if (focusMatch) {
      info.focusedApp = focusMatch[3]; // 通常是 package/activity
    }

    // 2. 检查键盘是否可见
    // Window #... InputMethod ... isVisible=true
    const imeMatch = dumpContent.match(/Window\s+#\d+\s+Window\{.*\s+InputMethod\s+.*isVisible=true/);
    if (imeMatch) {
      info.hasKeyboard = true;
    }

    // 3. 提取所有可见的应用窗口
    const lines = dumpContent.split('\n');
    let currentWindow = null;
    
    for (const line of lines) {
      const winMatch = line.match(/Window\s+#\d+\s+Window\{(\S+)\s+(\S+)\s+(.+)\}:/);
      if (winMatch) {
        currentWindow = {
          token: winMatch[1],
          package: winMatch[3].split(' ')[0], // 简化处理
          title: winMatch[3],
          isVisible: false
        };
      }
      
      if (currentWindow && line.includes('isVisible=true')) {
        currentWindow.isVisible = true;
        // 只添加可见的
        if (!info.visibleWindows.find(w => w.token === currentWindow.token)) {
          info.visibleWindows.push(currentWindow.title);
        }
      }
    }

    return info;
  }

  /**
   * 拉取文件
   */
  async pullFile(serial, remotePath, localPath) {
    try {
      await execa(this.adbPath, ['-s', serial, 'pull', remotePath, localPath], {
        timeout: 30000
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to pull file: ${remotePath}`, error);
      return false;
    }
  }

  /**
   * 解析 UI XML 并提取关键元素（坐标、文本、ID）
   * 返回简化后的元素列表，极大节省 Token 并提供精准坐标
   */
  parseUIXmlToSimplified(xmlContent) {
    if (!xmlContent) return null;

    try {
      const elements = [];
      // 匹配所有 node 节点
      // 提取关键属性: text, resource-id, content-desc, bounds, checkable, clickable
      const regex = /<node[^>]*?text="([^"]*)"[^>]*?resource-id="([^"]*)"[^>]*?class="([^"]*)"[^>]*?package="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?checkable="([^"]*)"[^>]*?checked="([^"]*)"[^>]*?clickable="([^"]*)"[^>]*?enabled="([^"]*)"[^>]*?focusable="([^"]*)"[^>]*?focused="([^"]*)"[^>]*?scrollable="([^"]*)"[^>]*?long-clickable="([^"]*)"[^>]*?password="([^"]*)"[^>]*?selected="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?>/g;

      let match;
      while ((match = regex.exec(xmlContent)) !== null) {
        const [
          _, 
          text, resourceId, className, packageName, contentDesc, 
          checkable, checked, clickable, enabled, focusable, focused, 
          scrollable, longClickable, password, selected, 
          x1, y1, x2, y2
        ] = match;

        // 过滤掉不可见或无效的元素
        // 1. 必须有文本或描述或ID，或者它是可点击的且有明确边界
        // 修改：即使没有 text/desc/id，只要 clickable=true 且有边界，也保留，方便模型根据位置推断
        const isClickable = clickable === 'true';
        const hasInfo = text || contentDesc || resourceId || isClickable;
        if (!hasInfo) continue;

        // 2. 计算中心点坐标
        const left = parseInt(x1);
        const top = parseInt(y1);
        const right = parseInt(x2);
        const bottom = parseInt(y2);
        
        // 忽略无效坐标 (0,0 - 0,0) 或极小区域
        if (right <= left || bottom <= top) continue;

        const centerX = Math.floor((left + right) / 2);
        const centerY = Math.floor((top + bottom) / 2);

        // 如果没有 text/desc/id，添加一个类型标记
        const typeInfo = isClickable ? 'type="clickable_area"' : '';

        elements.push({
          text: text || '',
          desc: contentDesc || '',
          id: resourceId || '',
          class: className || '',
          bounds: `[${left},${top}][${right},${bottom}]`,
          center: { x: centerX, y: centerY },
          clickable: isClickable,
          // 简化 raw 字段，只保留最关键信息，方便模型理解
          raw: `<element ${typeInfo} class="${className.split('.').pop()}" text="${text}" desc="${contentDesc}" id="${resourceId}" clickable="${clickable}" center="${centerX},${centerY}" bounds="[${left},${top}][${right},${bottom}]" />`
        });
      }
      
      return elements;
    } catch (error) {
      this.logger.error('Failed to parse UI XML', error);
      return null;
    }
  }

  /**
   * 获取 UIAutomator dump
   */
  async getUIADump(serial, savePath = '/sdcard/view.xml') {
    // uiautomator dump 可能需要更长时间，特别是UI层级复杂时
    const result = await this.execAdb(serial, `uiautomator dump ${savePath}`, { timeout: 20000 });
    if (result.success) {
      // 读取 XML 内容
      const readResult = await this.execAdb(serial, `cat ${savePath}`);
      const xmlContent = readResult.stdout || '';
      
      // 检查是否获取到了有效内容（某些应用可能返回空或错误信息）
      if (xmlContent.trim().length > 100 && xmlContent.includes('<hierarchy')) {
        return xmlContent;
      } else {
        this.logger.warn('UI层级内容无效或为空', { 
          serial, 
          contentLength: xmlContent.length,
          preview: xmlContent.substring(0, 200)
        });
        return null;
      }
    }
    return null;
  }

  /**
   * 获取亮度值
   */
  async getBrightness(serial) {
    const result = await this.execAdb(serial, 'settings get system screen_brightness');
    const value = parseInt(result.stdout.trim());
    return isNaN(value) ? null : Math.round((value / 255) * 100);
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(serial, filePath) {
    const result = await this.execAdb(serial, `test -f ${filePath} && echo "exists" || echo "not_exists"`);
    return result.stdout.trim() === 'exists';
  }

  /**
   * 检查应用是否安装
   */
  async isAppInstalled(serial, packageName) {
    const result = await this.execAdb(serial, `pm list packages ${packageName}`);
    return result.stdout.includes(`package:${packageName}`);
  }

  /**
   * 使用 ADBKeyBoard 输入文本
   */
  async inputTextViaADBKeyboard(serial, text) {
    try {
      // 检查是否安装了 ADBKeyBoard
      const isInstalled = await this.isAppInstalled(serial, 'com.android.adbkeyboard');
      if (!isInstalled) {
        this.logger.warn('ADBKeyBoard (com.android.adbkeyboard) 未安装');
        return false;
      }

      // 切换输入法到 ADBKeyBoard
      await this.execAdb(serial, 'ime set com.android.adbkeyboard/.AdbIME');
      
      // 等待一点时间确保切换完成
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 发送广播输入文本 (使用Base64编码避免字符问题)
      const base64Text = Buffer.from(text, 'utf8').toString('base64');
      // 使用 ADB_INPUT_B64 来处理 Base64 编码的文本，避免乱码
      const result = await this.execAdb(serial, `am broadcast -a ADB_INPUT_B64 --es msg "${base64Text}"`);
      
      return result.success;
    } catch (error) {
      this.logger.error('ADBKeyBoard 输入失败', error);
      return false;
    }
  }

  /**
   * 输入文本（自动选择最佳方式）
   */
  async inputText(serial, text) {
    // 检查是否包含中文或特殊字符
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    const hasSpecialChars = /[^a-zA-Z0-9\s%20]/.test(text);
    
    if (hasChinese || hasSpecialChars) {
      // 1. 尝试 ADBKeyBoard (最推荐，支持中文且稳定)
      this.logger.debug('检测到中文或特殊字符，尝试 ADBKeyBoard', { textLength: text.length });
      return await this.inputTextViaADBKeyboard(serial, text);
    } else {
      // 使用普通 input text（英文和数字）
      const result = await this.execAdb(serial, `input text "${text.replace(/ /g, '%20')}"`);
      return result.success;
    }
  }
}

export default DeviceManager;


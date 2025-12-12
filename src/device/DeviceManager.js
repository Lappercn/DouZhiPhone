import { execa } from 'execa';
import Logger from '../utils/logger.js';
import { XMLParser } from 'fast-xml-parser';

class DeviceManager {
  constructor(adbPath = 'adb', logger = null) {
    this.adbPath = adbPath;
    this.logger = logger || new Logger();
    this.devices = new Map();
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true
    });
  }

  /**
   * 获取设备IP地址 (wlan0)
   */
  async getDeviceIp(serial) {
    try {
      const { stdout } = await execa(this.adbPath, ['-s', serial, 'shell', 'ip addr show wlan0'], {
        timeout: 5000
      });
      const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      this.logger.error(`Failed to get IP for ${serial}`, error);
      return null;
    }
  }

  /**
   * 启用 ADB over TCP/IP
   */
  async enableTcpIp(serial, port = 5555) {
    try {
      // 先尝试获取 IP，方便用户连接
      const ip = await this.getDeviceIp(serial);
      
      const { stdout } = await execa(this.adbPath, ['-s', serial, 'tcpip', port], {
        timeout: 5000
      });
      
      return { 
        success: true, 
        message: stdout,
        ip: ip // 返回 IP 地址
      };
    } catch (error) {
      this.logger.error(`Failed to enable tcpip on ${serial}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 连接远程设备
   */
  async connectRemote(ip, port = 5555) {
    const address = `${ip}:${port}`;
    try {
      const { stdout } = await execa(this.adbPath, ['connect', address], {
        timeout: 5000
      });
      if (stdout.includes('connected to')) {
        return { success: true, message: stdout };
      } else {
        return { success: false, message: stdout };
      }
    } catch (error) {
      this.logger.error(`Failed to connect to ${address}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 断开远程设备
   */
  async disconnectRemote(ip, port = 5555) {
    const address = `${ip}:${port}`;
    try {
      const { stdout } = await execa(this.adbPath, ['disconnect', address], {
        timeout: 5000
      });
      return { success: true, message: stdout };
    } catch (error) {
      this.logger.error(`Failed to disconnect ${address}`, error);
      return { success: false, error: error.message };
    }
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
    // 格式通常为: mResumedActivity: ActivityRecord{... u0 com.package/.Activity ...}
    // 我们提取 ComponentName: com.package/.Activity
    const match = output.match(/mResumedActivity[^\n]*\s(\S+?)\/(\S+?)\s/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    
    // 如果找不到，尝试查找 mCurrentFocus
    const focusMatch = output.match(/mCurrentFocus[^\n]*\s(\S+?)\/(\S+?)\s/);
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
    // 优先使用 mResumedActivity，因为它更准确地反映了当前的 Activity，而 mCurrentFocus 可能是输入法或对话框
    const resumedMatch = dumpContent.match(/mResumedActivity[^\n]*\{(\S+)\s+(\S+)\s+(\S+)\}/);
    if (resumedMatch) {
        // match[3] 通常是 com.package/com.package.Activity
        const component = resumedMatch[3];
        if (component) {
            info.focusedApp = component.split('/')[0];
        }
    }
    
    // 如果没有 Resumed，回退到 mCurrentFocus
    if (!info.focusedApp) {
        const focusMatch = dumpContent.match(/mCurrentFocus=Window\{(\S+)\s+(\S+)\s+(\S+)\}/);
        if (focusMatch) {
            const component = focusMatch[3];
            // 排除输入法和系统UI干扰
            if (!component.includes('InputMethod') && !component.includes('StatusBar') && !component.includes('NavigationBar')) {
                info.focusedApp = component.split('/')[0];
            }
        }
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
      // 匹配窗口头: Window #1 Window{...}
      const winMatch = line.match(/Window\s+#\d+\s+Window\{(\S+)\s+(\S+)\s+(.+)\}:/);
      if (winMatch) {
        // 如果上一个窗口是可见的，保存它
        if (currentWindow && currentWindow.isVisible) {
             const boundsStr = currentWindow.bounds || '[Unknown]';
             info.visibleWindows.push(`${currentWindow.title} ${boundsStr}`);
        }

        // 开始新窗口
        currentWindow = {
          token: winMatch[1],
          package: winMatch[3].split(' ')[0], // 简化处理
          title: winMatch[3],
          isVisible: false,
          bounds: null
        };
        continue;
      }

      if (currentWindow) {
        // 检查可见性
        if (line.includes('isVisible=true') || (line.includes('mViewVisibility=0x0') && !line.includes('mViewVisibility=0x8'))) {
          currentWindow.isVisible = true;
        }
        
        // 提取 Bounds (Frames: parent=[...])
        // Frames: parent=[0,0][1080,2388] display=[0,0][1080,2388] frame=[0,2346][1080,2388]
        const framesMatch = line.match(/Frames:.*frame=(\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\])/);
        if (framesMatch) {
            currentWindow.bounds = framesMatch[1];
        } else if (line.match(/mBounds=Rect/)) {
            // 备用: mBounds=Rect(0, 0 - 1080, 2388)
            const rectMatch = line.match(/mBounds=Rect\((\d+),\s*(\d+)\s*-\s*(\d+),\s*(\d+)\)/);
            if (rectMatch) {
                currentWindow.bounds = `[${rectMatch[1]},${rectMatch[2]}][${rectMatch[3]},${rectMatch[4]}]`;
            }
        }
      }
    }
    
    // 处理最后一个窗口
    if (currentWindow && currentWindow.isVisible) {
         const boundsStr = currentWindow.bounds || '[Unknown]';
         info.visibleWindows.push(`${currentWindow.title} ${boundsStr}`);
    }

    return info;
  }

  /**
   * 尝试使用 dumpsys activity top 获取 UI 层级
   * 这是一个强大的备选方案，当 uiautomator dump 失败时使用
   */
  async getUIFromActivityDump(serial) {
    try {
      const result = await this.execAdb(serial, 'dumpsys activity top');
      if (result.success && result.stdout) {
        return this.parseActivityDumpToSimplified(result.stdout);
      }
    } catch (error) {
      this.logger.error('Failed to get UI from activity dump', error);
    }
    return null;
  }

  /**
   * 解析 dumpsys activity top 的 View Hierarchy 输出
   */
  parseActivityDumpToSimplified(dumpContent) {
    const lines = dumpContent.split('\n');
    let inHierarchy = false;
    const elements = [];

    // 正则匹配 View 行
    // 示例: android.widget.TextView{a104890 VFED..C.. ........ 0,657-462,741 #7f0a0597 app:id/widget_title}
    // 关键组: 1.Class 2.Flags 3.Coords 4.ID(可选)
    const viewRegex = /^\s*(\S+)\{[0-9a-f]+ (\S+) .*? (\d+),(\d+)-(\d+),(\d+)(.*)\}/;

    for (const line of lines) {
      if (line.includes('View Hierarchy:')) {
        inHierarchy = true;
        continue;
      }
      
      if (inHierarchy) {
        // 如果遇到空行或非 View 行，可能结束了 (但 dumpsys 有时会断开，暂时假设一直读到最后)
        const match = line.match(viewRegex);
        if (match) {
          const className = match[1];
          const flags = match[2];
          const left = parseInt(match[3]);
          const top = parseInt(match[4]);
          const right = parseInt(match[5]);
          const bottom = parseInt(match[6]);
          const idPart = match[7] || '';

          // 提取 ID
          let id = '';
          const idMatch = idPart.match(/app:id\/(\S+)/) || idPart.match(/android:id\/(\S+)/);
          if (idMatch) {
            id = idMatch[1];
          }

          // 检查可见性 (Flags 中的 V)
          // V: Visible, I: Invisible, G: Gone
          const isVisible = flags.startsWith('V');

          // 检查是否可点击 (Flags 中的 C)
          const isClickable = flags.includes('C');
          
          if (isVisible && right > left && bottom > top) {
            const centerX = Math.floor((left + right) / 2);
            const centerY = Math.floor((top + bottom) / 2);

            // 只保留有意义的节点 (有 ID 或 可点击)
            if (id || isClickable) {
              elements.push({
                text: '', // Activity dump 通常不直接包含文本内容
                desc: '',
                id: id,
                class: className,
                bounds: `[${left},${top}][${right},${bottom}]`,
                center: { x: centerX, y: centerY },
                clickable: isClickable,
                raw: `<element class="${className.split('.').pop()}" id="${id}" clickable="${isClickable}" center="${centerX},${centerY}" bounds="[${left},${top}][${right},${bottom}]" />`
              });
            }
          }
        }
      }
    }

    return elements.length > 0 ? elements : null;
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
   * 使用 fast-xml-parser 替代正则解析，提高健壮性
   */
  parseUIXmlToSimplified(xmlContent) {
    if (!xmlContent) return null;

    try {
      const parsed = this.xmlParser.parse(xmlContent);
      const elements = [];

      // 递归遍历 XML 树
      const traverse = (node) => {
        if (!node) return;

        // 处理当前节点
        // fast-xml-parser 会将属性直接放在对象上 (因为配置了 ignoreAttributes: false)
        // 节点名通常是 'node'
        
        // 提取关键属性
        const text = node.text || '';
        const resourceId = node['resource-id'] || '';
        const contentDesc = node['content-desc'] || '';
        const className = node.class || '';
        const bounds = node.bounds || '';
        const clickable = node.clickable === true || node.clickable === 'true'; // 处理布尔值或字符串

        // 只有当有 bounds 时才处理
        if (bounds) {
          // 解析 bounds "[x1,y1][x2,y2]"
          const boundsMatch = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
          if (boundsMatch) {
            const left = parseInt(boundsMatch[1]);
            const top = parseInt(boundsMatch[2]);
            const right = parseInt(boundsMatch[3]);
            const bottom = parseInt(boundsMatch[4]);

            // 过滤无效区域
            if (right > left && bottom > top) {
              const centerX = Math.floor((left + right) / 2);
              const centerY = Math.floor((top + bottom) / 2);

              // 过滤条件：有语义信息 OR 可点击
              const hasInfo = text || contentDesc || resourceId || clickable;
              
              if (hasInfo) {
                const typeInfo = clickable ? 'type="clickable_area"' : '';
                
                elements.push({
                  text: text,
                  desc: contentDesc,
                  id: resourceId,
                  class: className,
                  bounds: bounds,
                  center: { x: centerX, y: centerY },
                  clickable: clickable,
                  raw: `<element ${typeInfo} class="${className.split('.').pop()}" text="${text}" desc="${contentDesc}" id="${resourceId}" clickable="${clickable}" center="${centerX},${centerY}" bounds="${bounds}" />`
                });
              }
            }
          }
        }

        // 递归处理子节点
        // 子节点可能在 'node' 属性中 (如果是一个数组) 或者直接是子对象
        if (node.node) {
          if (Array.isArray(node.node)) {
            node.node.forEach(child => traverse(child));
          } else {
            traverse(node.node);
          }
        }
      };

      // 从根节点开始 (hierarchy -> node)
      if (parsed.hierarchy) {
        traverse(parsed.hierarchy);
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
    // 强制刷新 UI 缓存
    try {
      // 在 dump 前先清理旧文件，防止读取到脏数据
      // 忽略 rm 失败（例如文件不存在）
      await this.execAdb(serial, `rm ${savePath} || true`);
      
      // uiautomator dump 可能需要更长时间，特别是UI层级复杂时
      const result = await this.execAdb(serial, `uiautomator dump ${savePath}`, { timeout: 20000 });
      
      if (result.success) {
        // 读取 XML 内容
        const readResult = await this.execAdb(serial, `cat ${savePath}`);
        const xmlContent = readResult.stdout || '';
        
        // 检查是否获取到了有效内容
        // 1. 长度足够
        // 2. 包含 hierarchy 标签
        // 3. 关键：不能只有空节点 (bounds="[0,0][0,0]")
        const isLengthValid = xmlContent.trim().length > 100;
        const hasHierarchy = xmlContent.includes('<hierarchy');
        const hasValidNodes = xmlContent.includes('bounds="') && !xmlContent.match(/bounds="\[0,0\]\[0,0\]"\s*\/>\s*<\/hierarchy>/);

        if (isLengthValid && hasHierarchy && hasValidNodes) {
          return xmlContent;
        } else {
          this.logger.warn('UI层级内容无效或为空（可能被应用阻止）', { 
            serial, 
            contentLength: xmlContent.length,
            preview: xmlContent.substring(0, 200)
          });
          return null;
        }
      } else {
          // Dump 失败
          this.logger.warn(`uiautomator dump failed: ${result.stderr}`, { serial });
          return null;
      }
    } catch (error) {
      this.logger.error('UI dump failed', error);
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
   * 清除当前输入框文本 (需要 ADBKeyBoard)
   */
  async clearText(serial) {
    try {
       // 确保 ADBKeyBoard 已启用
       await this.execAdb(serial, 'ime set com.android.adbkeyboard/.AdbIME');
       await new Promise(resolve => setTimeout(resolve, 500));
       
       // 发送清除广播
       const result = await this.execAdb(serial, 'am broadcast -a ADB_CLEAR_TEXT');
       return result.success;
    } catch (error) {
       this.logger.error('Failed to clear text', error);
       return false;
    }
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


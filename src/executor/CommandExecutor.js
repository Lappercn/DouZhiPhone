import { execa } from 'execa';
import Logger from '../utils/logger.js';

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
}

export default CommandExecutor;


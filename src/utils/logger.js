import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor(config = {}) {
    this.level = config.level || 'info';
    this.saveToFile = config.saveToFile || false;
    this.logDir = config.logDir || './logs';
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    
    if (this.saveToFile) {
      this.ensureLogDir();
    }
    
    // 支持回调函数，用于实时推送日志（如 WebSocket）
    this.logCallback = config.logCallback || null;
  }
  
  setLogCallback(callback) {
    this.logCallback = callback;
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const reqId = data.reqId || 'unknown';
    const stepId = data.stepId || '';
    const logEntry = {
      timestamp,
      level,
      reqId,
      stepId,
      message,
      ...data
    };
    return logEntry;
  }

  emitLog(logEntry) {
    if (this.logCallback) {
      this.logCallback(logEntry);
    }
  }

  writeToFile(logEntry) {
    if (!this.saveToFile) return;
    
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `app-${date}.log`);
    const line = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(logFile, line, 'utf8');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  debug(message, data = {}) {
    if (!this.shouldLog('debug')) return;
    const logEntry = this.formatMessage('debug', message, data);
    console.log(chalk.gray(`[DEBUG] ${message}`));
    this.writeToFile(logEntry);
    this.emitLog(logEntry);
  }

  info(message, data = {}) {
    if (!this.shouldLog('info')) return;
    const logEntry = this.formatMessage('info', message, data);
    console.log(chalk.blue(`[INFO] ${message}`));
    this.writeToFile(logEntry);
    this.emitLog(logEntry);
  }

  warn(message, data = {}) {
    if (!this.shouldLog('warn')) return;
    const logEntry = this.formatMessage('warn', message, data);
    console.log(chalk.yellow(`[WARN] ${message}`));
    this.writeToFile(logEntry);
    this.emitLog(logEntry);
  }

  error(message, error = null, data = {}) {
    if (!this.shouldLog('error')) return;
    const logEntry = this.formatMessage('error', message, {
      ...data,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : null
    });
    console.error(chalk.red(`[ERROR] ${message}`), error || '');
    this.writeToFile(logEntry);
    this.emitLog(logEntry);
  }

  step(stepId, message, data = {}) {
    const logEntry = this.formatMessage('info', message, { stepId, ...data });
    console.log(chalk.cyan(`[STEP ${stepId}] ${message}`));
    this.writeToFile(logEntry);
    this.emitLog(logEntry);
  }

  screenshot(base64Data) {
    // 截图不写入日志文件，也不打印到控制台，仅通过回调发送
    const entry = {
      type: 'screenshot',
      data: base64Data,
      timestamp: new Date().toISOString()
    };
    this.emitLog(entry);
  }
}

export default Logger;


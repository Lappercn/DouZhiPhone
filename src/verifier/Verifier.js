import Logger from '../utils/logger.js';
import { XMLParser } from 'fast-xml-parser';

class Verifier {
  constructor(deviceManager, logger = null) {
    this.deviceManager = deviceManager;
    this.logger = logger || new Logger();
    this.xmlParser = new XMLParser();
  }

  /**
   * 验证步骤的期望结果
   */
  async verifyStep(step, serial, commandResult) {
    const { id, verify, expect } = step;
    
    if (!verify || verify.length === 0) {
      this.logger.warn(`步骤 ${id} 没有验证方法，跳过验证`);
      return { success: true, message: '无验证要求' };
    }

    this.logger.debug(`验证步骤 ${id}: ${expect || '无描述'}`);

    const results = [];
    for (const verifyMethod of verify) {
      const result = await this.executeVerify(verifyMethod, serial, step);
      results.push(result);
      
      if (!result.success) {
        this.logger.warn(`验证失败: ${verifyMethod}`, {
          stepId: id,
          reason: result.message
        });
      }
    }

    const allPassed = results.every(r => r.success);
    const message = allPassed 
      ? '所有验证通过' 
      : `部分验证失败: ${results.filter(r => !r.success).map(r => r.message).join(', ')}`;

    return {
      success: allPassed,
      message,
      details: results
    };
  }

  /**
   * 执行单个验证方法
   */
  async executeVerify(verifyMethod, serial, step = {}) {
    const parts = verifyMethod.split(':');
    const method = parts[0];
    const params = parts.slice(1);

    try {
      switch (method) {
        case 'check_foreground':
          return await this.checkForeground(serial, params[0]);
        
        case 'check_file':
          return await this.checkFile(serial, params[0]);
        
        case 'check_brightness':
          return await this.checkBrightness(serial, parseInt(params[0]));
        
        case 'check_node':
          return await this.checkNode(serial, params.join(':'));
        
        case 'uia_select':
          return await this.uiaSelect(serial, params[0], params[1], params[2] || 'tap');
        
        default:
          this.logger.warn(`未知的验证方法: ${method}`);
          return { success: false, message: `未知验证方法: ${method}` };
      }
    } catch (error) {
      this.logger.error(`验证执行错误: ${verifyMethod}`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 检查前台应用
   */
  async checkForeground(serial, expectedPackage) {
    const activity = await this.deviceManager.getForegroundActivity(serial);
    if (!activity) {
      return { success: false, message: '无法获取前台Activity' };
    }

    const packageName = activity.split('/')[0];
    const match = packageName === expectedPackage || activity.includes(expectedPackage);
    
    return {
      success: match,
      message: match 
        ? `前台应用匹配: ${activity}` 
        : `前台应用不匹配: 期望 ${expectedPackage}, 实际 ${activity}`
    };
  }

  /**
   * 检查文件是否存在
   */
  async checkFile(serial, filePath) {
    const exists = await this.deviceManager.fileExists(serial, filePath);
    return {
      success: exists,
      message: exists ? `文件存在: ${filePath}` : `文件不存在: ${filePath}`
    };
  }

  /**
   * 检查亮度值
   */
  async checkBrightness(serial, expectedValue) {
    const currentValue = await this.deviceManager.getBrightness(serial);
    if (currentValue === null) {
      return { success: false, message: '无法获取亮度值' };
    }

    const tolerance = 5; // 允许5%的误差
    const match = Math.abs(currentValue - expectedValue) <= tolerance;
    
    return {
      success: match,
      message: match
        ? `亮度匹配: ${currentValue}% (期望 ${expectedValue}%)`
        : `亮度不匹配: 当前 ${currentValue}%, 期望 ${expectedValue}%`
    };
  }

  /**
   * 检查UI节点
   */
  async checkNode(serial, selector) {
    const xmlContent = await this.deviceManager.getUIADump(serial);
    if (!xmlContent) {
      return { success: false, message: '无法获取UI层级' };
    }

    try {
      const doc = this.xmlParser.parse(xmlContent);
      const found = this.findNodeInXML(doc, selector);
      
      return {
        success: found,
        message: found ? `找到节点: ${selector}` : `未找到节点: ${selector}`
      };
    } catch (error) {
      this.logger.error('解析UI dump失败', error);
      return { success: false, message: '解析UI层级失败' };
    }
  }

  /**
   * UI选择器（查找并操作）
   */
  async uiaSelect(serial, by, value, action = 'tap') {
    const xmlContent = await this.deviceManager.getUIADump(serial);
    if (!xmlContent) {
      return { success: false, message: '无法获取UI层级' };
    }

    try {
      const doc = this.xmlParser.parse(xmlContent);
      const node = this.findNodeBySelector(doc, by, value);
      
      if (!node) {
        return { success: false, message: `未找到元素: ${by}=${value}` };
      }

      const bounds = node.attributes?.bounds;
      if (!bounds) {
        return { success: false, message: '元素没有bounds属性' };
      }

      // 解析bounds: [x1,y1][x2,y2]
      const match = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (!match) {
        return { success: false, message: '无法解析bounds' };
      }

      const x1 = parseInt(match[1]);
      const y1 = parseInt(match[2]);
      const x2 = parseInt(match[3]);
      const y2 = parseInt(match[4]);
      const centerX = Math.floor((x1 + x2) / 2);
      const centerY = Math.floor((y1 + y2) / 2);

      // 执行操作
      if (action === 'tap') {
        await this.deviceManager.execAdb(serial, `input tap ${centerX} ${centerY}`);
      } else if (action === 'long_tap') {
        await this.deviceManager.execAdb(serial, `input swipe ${centerX} ${centerY} ${centerX} ${centerY} 1000`);
      }

      return {
        success: true,
        message: `执行${action}操作: ${by}=${value} at (${centerX}, ${centerY})`,
        coordinates: { x: centerX, y: centerY }
      };
    } catch (error) {
      this.logger.error('UI选择器执行失败', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 在XML中查找节点（简单文本匹配）
   */
  findNodeInXML(doc, selector) {
    // 简单的递归查找
    const search = (obj) => {
      if (typeof obj !== 'object' || obj === null) return false;
      
      if (obj.text && obj.text.includes(selector)) return true;
      if (obj['content-desc'] && obj['content-desc'].includes(selector)) return true;
      if (obj['resource-id'] && obj['resource-id'].includes(selector)) return true;
      
      for (const key in obj) {
        if (search(obj[key])) return true;
      }
      
      return false;
    };

    return search(doc);
  }

  /**
   * 根据选择器查找节点
   */
  findNodeBySelector(doc, by, value) {
    const search = (obj) => {
      if (typeof obj !== 'object' || obj === null) return null;
      
      const attrs = obj.attributes || {};
      let match = false;
      
      switch (by) {
        case 'text':
          match = obj.text === value || (obj.text && obj.text.includes(value));
          break;
        case 'resource-id':
          match = attrs['resource-id'] === value || (attrs['resource-id'] && attrs['resource-id'].includes(value));
          break;
        case 'content-desc':
          match = attrs['content-desc'] === value || (attrs['content-desc'] && attrs['content-desc'].includes(value));
          break;
      }
      
      if (match) return obj;
      
      for (const key in obj) {
        const result = search(obj[key]);
        if (result) return result;
      }
      
      return null;
    };

    return search(doc);
  }
}

export default Verifier;


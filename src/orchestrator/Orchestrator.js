import Logger from '../utils/logger.js';
import DeviceManager from '../device/DeviceManager.js';
import DoubaoAgent from '../agent/DoubaoAgent.js';
import CommandExecutor from '../executor/CommandExecutor.js';
import Verifier from '../verifier/Verifier.js';

class Orchestrator {
  constructor(config = {}) {
    this.config = config;
    this.logger = new Logger(config.logging || {});
    
    // 初始化各个组件
    this.deviceManager = new DeviceManager(
      config.adb?.path || 'adb',
      this.logger
    );
    
    this.doubaoAgent = new DoubaoAgent(
      config.doubao || {},
      this.logger
    );
    
    this.commandExecutor = new CommandExecutor(
      this.deviceManager,
      config.security || {},
      this.logger
    );
    
    this.verifier = new Verifier(
      this.deviceManager,
      this.logger
    );

    this.activeRequests = new Map(); // reqId -> { status: 'running'|'paused'|'stopped', resolvePause: Function }
  }

  /**
   * 生成唯一请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  stopRequest(reqId) {
    if (this.activeRequests.has(reqId)) {
      const req = this.activeRequests.get(reqId);
      req.status = 'stopped';
      if (req.resolvePause) req.resolvePause(); // 如果在暂停中，立即唤醒并停止
      this.logger.info(`收到停止请求指令`, { reqId });
      return true;
    }
    return false;
  }

  pauseRequest(reqId) {
    if (this.activeRequests.has(reqId)) {
      const req = this.activeRequests.get(reqId);
      if (req.status === 'running') {
        req.status = 'paused';
        this.logger.info(`收到暂停请求指令`, { reqId });
        return true;
      }
    }
    return false;
  }

  resumeRequest(reqId) {
    if (this.activeRequests.has(reqId)) {
      const req = this.activeRequests.get(reqId);
      if (req.status === 'paused') {
        req.status = 'running';
        if (req.resolvePause) {
          req.resolvePause();
          req.resolvePause = null;
        }
        this.logger.info(`收到恢复请求指令`, { reqId });
        return true;
      }
    }
    return false;
  }

  /**
   * 执行用户请求（观察-行动循环模式）
   */
  async executeRequest(userQuery, deviceSerial = null, passedReqId = null) {
    const reqId = passedReqId || this.generateRequestId();
    this.logger.info(`开始处理请求: ${userQuery}`, { reqId });
    this.originalQuery = userQuery; // 保存原始查询
    
    this.activeRequests.set(reqId, { status: 'running', resolvePause: null });

    try {
      // 1. 选择设备
      const serial = await this.selectDevice(deviceSerial);
      if (!serial) {
        throw new Error('没有可用的设备');
      }

      // 2. 检查设备状态
      const deviceState = await this.deviceManager.checkDeviceReady(serial);
      if (!deviceState.ready) {
        const issues = [];
        if (!deviceState.screenOn) issues.push('屏幕未亮屏');
        if (!deviceState.unlocked) issues.push('设备未解锁');
        
        throw new Error(`设备未就绪: ${issues.join(', ')}。请手动解锁并保持屏幕常亮。`);
      }

      // 3. 获取设备信息
      const deviceInfo = await this.deviceManager.getDeviceInfo(serial);
      this.logger.info('设备信息', { serial, ...deviceInfo });

      // 4. 执行观察-行动循环
      const result = await this.executeObserveActLoop(userQuery, serial, deviceInfo, reqId);

      this.logger.info('请求处理完成', { reqId, success: result.success });
      return {
        reqId,
        success: result.success,
        results: result.stepResults,
        summary: result.summary,
        completed: result.completed
      };

    } catch (error) {
      this.logger.error('请求处理失败', error, { reqId });
      throw error;
    } finally {
      this.activeRequests.delete(reqId);
    }
  }

  /**
   * 执行观察-行动循环
   */
  async executeObserveActLoop(userQuery, serial, deviceInfo, reqId) {
    const stepResults = [];
    const executionHistory = [];
    const repeatedOperations = new Map(); // 记录重复操作
    let maxIterations = 20; // 最大迭代次数，防止无限循环
    let iteration = 0;
    let completed = false;

    while (iteration < maxIterations && !completed) {
      // 检查任务状态
      const reqState = this.activeRequests.get(reqId);
      if (reqState) {
        if (reqState.status === 'stopped') {
          this.logger.warn('任务已被用户终止', { reqId });
          break;
        }
        if (reqState.status === 'paused') {
          this.logger.info('任务已暂停，等待恢复...', { reqId });
          await new Promise(resolve => {
            reqState.resolvePause = resolve;
          });
          // 恢复后再次检查是否停止
          if (this.activeRequests.get(reqId)?.status === 'stopped') {
             this.logger.warn('任务在暂停期间被用户终止', { reqId });
             break;
          }
        }
      }

      iteration++;
      this.logger.info(`观察-行动循环 第 ${iteration} 轮`, { reqId });

      // 1. 观察：获取当前屏幕状态
      // 第一轮获取初始状态，后续轮次在上一步执行后获取状态
      let uiDump = null;
      let uiElements = null;
      let windowInfo = null;
      let screenshot = null;

      try {
        // 并行获取各种状态信息，提高效率
        const [dump, winDumpRaw, screenBase64] = await Promise.all([
          this.deviceManager.getUIADump(serial),
          this.deviceManager.getWindowDump(serial),
          this.deviceManager.getScreenshotBase64(serial)
        ]);

        uiDump = dump;
        screenshot = screenBase64;
        
        // 实时推送截图给前端
        if (screenshot) {
          this.logger.screenshot(screenshot);
        }
        
        // 解析 UI XML 为简化列表
        if (uiDump) {
          uiElements = this.deviceManager.parseUIXmlToSimplified(uiDump);
        }
        
        if (winDumpRaw) {
          windowInfo = this.deviceManager.parseWindowDump(winDumpRaw);
          this.logger.debug('Window Dump Info:', windowInfo);
        }

        if (!uiDump) {
          this.logger.warn('无法获取UI层级（可能被应用阻止或界面未加载完成）', { reqId });
          // 如果连续多次无法获取，可能是应用阻止了UI层级获取
          const lastFailedCount = repeatedOperations.get('获取UI层级失败') || 0;
          if (lastFailedCount >= 2) {
            this.logger.warn('多次无法获取UI层级，建议模型使用其他方法', { reqId });
          }
          repeatedOperations.set('获取UI层级失败', lastFailedCount + 1);
        } else {
          // 成功获取，清除失败计数
          repeatedOperations.delete('获取UI层级失败');
        }
      } catch (error) {
        this.logger.error('获取设备状态失败', error);
      }

      // 2. 规划：基于当前状态规划下一步
      this.logger.info('基于当前屏幕状态规划下一步...', { reqId });
      let plan;
      
      // 检查是否有重复操作
      const lastOperation = executionHistory.length > 0 ? executionHistory[executionHistory.length - 1] : null;
      if (lastOperation) {
        const opKey = `${lastOperation.desc || lastOperation.id}`;
        const count = repeatedOperations.get(opKey) || 0;
        if (count >= 1) { // 只要重复一次就开始提醒
          // 如果同一个操作重复了，在提示中强调需要换方法或调整坐标
          this.logger.warn(`检测到重复操作: ${opKey}，已执行${count}次，建议调整坐标或方法`, { reqId });
        }
        repeatedOperations.set(opKey, count + 1);
      }
      
      if (iteration === 1) {
        // 第一轮：生成初始计划
        plan = await this.doubaoAgent.generatePlan(userQuery, deviceInfo, uiDump, windowInfo, screenshot, uiElements);
      } else {
        // 后续轮次：基于当前状态规划下一步，并传递重复操作信息
        const repeatedOpsInfo = Array.from(repeatedOperations.entries())
          .filter(([_, count]) => count >= 2)
          .map(([op, count]) => `${op} (已执行${count}次)`);
        
        plan = await this.doubaoAgent.planNextStep(
          userQuery, 
          uiDump, 
          deviceInfo, 
          executionHistory,
          repeatedOpsInfo,
          windowInfo,
          screenshot,
          uiElements
        );
      }

      // 检查是否完成
      if (!plan.steps || plan.steps.length === 0) {
        completed = true;
        this.logger.info('任务完成', { 
          reqId, 
          message: plan.message || '任务已完成',
          completed: plan.completed 
        });
        break;
      }

      // 替换计划中的 {serial} 占位符
      plan = this.replaceSerialInPlan(plan, serial);
      
      this.logger.info(`规划完成，本轮 ${plan.steps.length} 个步骤`, { reqId });

      // 3. 执行：执行规划的步骤
      for (const step of plan.steps) {
        const stepResult = {
          stepId: step.id,
          iteration,
          success: false,
          commandResult: null,
          verifyResult: null,
          error: null
        };

        try {
          this.logger.step(step.id, `[迭代${iteration}] ${step.desc || step.id}`);

          // 执行命令
          const commandResult = await this.commandExecutor.executeWithRetry(
            step,
            serial,
            step.retry || {}
          );
          stepResult.commandResult = commandResult;

          // 等待操作完成（由模型指定等待时间）
          const waitTime = step.wait_after || 500; // 默认500ms
          if (waitTime > 0) {
            this.logger.debug(`等待 ${waitTime}ms 让操作完成`, { stepId: step.id });
            await this.sleep(waitTime);
          }

          // 验证操作结果（如果模型指定了验证方法）
          if (step.verify && step.verify.length > 0) {
            const verifyResult = await this.verifier.verifyStep(step, serial, commandResult);
            stepResult.verifyResult = verifyResult;
            
            if (!verifyResult.success) {
              this.logger.warn(`验证失败: ${verifyResult.message}`, { stepId: step.id });
              // 验证失败时，根据策略处理
              if (step.on_fail === 'abort') {
                stepResult.error = `验证失败: ${verifyResult.message}`;
                stepResult.success = false;
                break;
              } else if (step.on_fail === 'replan_request') {
                // 请求重新规划
                this.logger.info('验证失败，将在下一轮重新规划', { stepId: step.id });
              }
            }
          }

          stepResult.success = true;
          executionHistory.push({
            id: step.id,
            desc: step.desc,
            success: true
          });

        } catch (error) {
          stepResult.error = error.message;
          stepResult.success = false;
          
          this.logger.error(`步骤执行失败: ${step.id}`, error, { reqId, stepId: step.id });
          
          executionHistory.push({
            id: step.id,
            desc: step.desc,
            success: false,
            error: error.message
          });

          // 如果失败策略是abort，则停止
          if (step.on_fail === 'abort') {
            this.logger.error('步骤失败且策略为abort，停止执行', { stepId: step.id });
            return {
              success: false,
              stepResults,
              summary: {
                total: stepResults.length,
                success: stepResults.filter(r => r.success).length,
                failed: stepResults.filter(r => !r.success).length
              },
              completed: false
            };
          }
        }

        stepResults.push(stepResult);
      }

      // 最小等待，让模型决定是否需要等待
      await this.sleep(300);
    }

    if (iteration >= maxIterations) {
      this.logger.warn('达到最大迭代次数，停止执行', { reqId, maxIterations });
    }

    return {
      success: completed || stepResults.filter(r => !r.success).length === 0,
      stepResults,
      summary: {
        total: stepResults.length,
        success: stepResults.filter(r => r.success).length,
        failed: stepResults.filter(r => !r.success).length,
        iterations: iteration
      },
      completed
    };
  }

  /**
   * 等待
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 选择设备
   */
  async selectDevice(preferredSerial = null) {
    const devices = await this.deviceManager.listDevices();
    
    if (devices.length === 0) {
      this.logger.error('没有找到连接的设备');
      return null;
    }

    if (preferredSerial) {
      const device = devices.find(d => d.serial === preferredSerial);
      if (device) {
        return preferredSerial;
      }
      this.logger.warn(`指定设备 ${preferredSerial} 不存在，使用第一个可用设备`);
    }

    return devices[0].serial;
  }

  /**
   * 替换计划中的序列号占位符
   */
  replaceSerialInPlan(plan, serial) {
    const newPlan = JSON.parse(JSON.stringify(plan));
    
    for (const step of newPlan.steps) {
      step.cmd = step.cmd.replace(/\{serial\}/g, serial);
    }
    
    return newPlan;
  }

  /**
   * 执行计划
   */
  async executePlan(plan, serial, reqId) {
    const stepResults = [];
    let overallSuccess = true;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepResult = {
        stepId: step.id,
        stepIndex: i + 1,
        totalSteps: plan.steps.length,
        success: false,
        commandResult: null,
        verifyResult: null,
        error: null
      };

      try {
        this.logger.step(step.id, `[${i + 1}/${plan.steps.length}] ${step.desc || step.id}`);

        // 执行命令
        const commandResult = await this.commandExecutor.executeWithRetry(
          step,
          serial,
          step.retry || {}
        );
        stepResult.commandResult = commandResult;

        // 验证结果
        const verifyResult = await this.verifier.verifyStep(step, serial, commandResult);
        stepResult.verifyResult = verifyResult;

        if (!verifyResult.success) {
          // 验证失败，根据策略处理
          if (step.on_fail === 'abort') {
            stepResult.error = `验证失败: ${verifyResult.message}`;
            stepResult.success = false;
            overallSuccess = false;
            break;
          } else if (step.on_fail === 'replan_request') {
            // 请求重新规划
            this.logger.warn('验证失败，请求重新规划', { stepId: step.id });
            const deviceState = await this.deviceManager.checkDeviceReady(serial);
            const newPlan = await this.doubaoAgent.replan(
              '原始需求', // 这里应该保存原始需求
              step,
              { message: verifyResult.message },
              deviceState
            );
            // 替换序列号并继续执行新计划
            const adjustedPlan = this.replaceSerialInPlan(newPlan, serial);
            plan.steps = [...plan.steps.slice(0, i), ...adjustedPlan.steps];
            i--; // 重新执行当前步骤
            continue;
          }
          // retry 策略已在 executeWithRetry 中处理
        }

        stepResult.success = true;

      } catch (error) {
        stepResult.error = error.message;
        stepResult.success = false;
        
        this.logger.error(`步骤执行失败: ${step.id}`, error, { reqId, stepId: step.id });

        // 根据失败策略处理
        if (step.on_fail === 'abort') {
          overallSuccess = false;
          break;
        } else if (step.on_fail === 'replan_request') {
          // 请求重新规划
          const deviceState = await this.deviceManager.checkDeviceReady(serial);
          const newPlan = await this.doubaoAgent.replan(
            '原始需求',
            step,
            error,
            deviceState
          );
          const adjustedPlan = this.replaceSerialInPlan(newPlan, serial);
          plan.steps = [...plan.steps.slice(0, i), ...adjustedPlan.steps];
          i--;
          continue;
        }
        // retry 策略已在 executeWithRetry 中处理
      }

      stepResults.push(stepResult);
    }

    const summary = {
      total: plan.steps.length,
      success: stepResults.filter(r => r.success).length,
      failed: stepResults.filter(r => !r.success).length
    };

    return {
      success: overallSuccess && summary.failed === 0,
      stepResults,
      summary
    };
  }
}

export default Orchestrator;


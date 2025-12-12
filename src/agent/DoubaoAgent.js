import axios from 'axios';
import Logger from '../utils/logger.js';

class DoubaoAgent {
  constructor(config = {}, logger = null) {
    this.apiKey = config.apiKey || '';
    this.apiUrl = config.apiUrl || '';
    this.model = config.model || '';
    this.timeout = config.timeout || 30000;
    this.logger = logger || new Logger();
  }

  /**
   * 构建系统提示词（通用 Android 智能体模式 - Open-AutoGLM 风格）
   */
  buildSystemPrompt() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    return `今天的日期是: ${dateStr}

你是一个智能体分析专家，可以根据操作历史和当前状态图执行一系列操作来完成任务。
你必须严格按照要求输出以下格式：
<think>{think}</think>
<answer>{action}</answer>

其中：
- {think} 是你的**思考过程（Critical Thinking Process）**。你必须在此处展示你是如何观察截图、分析当前状态、检查上一步结果、并推导出下一步行动的。
- {action} 是本次执行的具体操作指令，必须严格遵循下方定义的指令格式。

**操作指令（Action Definitions）：**
- do(action="Launch", app="xxx")
    Launch是启动目标app的操作。app参数必须指定应用名称（如"微信"）。
    **注意**：只有当当前不在目标App时才使用。如果已经在目标App内（即使在子页面），严禁使用Launch。
- do(action="Tap", element=[x,y])
    Tap是点击操作，点击屏幕上的特定点。element参数是必须的，格式为[x,y]。坐标系统从左上角 (0,0) 开始到右下角 (1000,1000) 结束。
- do(action="Type", text="xxx")
    Type是输入操作，在当前聚焦的输入框中输入文本。text参数是必须的。
    **注意**：Type操作会自动清除输入框中原有的文本（包括占位符），你**不需要**在Type前手动清除文本。
    **前提**：使用Type前，请确保输入框已经处于激活状态（例如看到了光标或键盘）。如果未激活，请先Tap输入框。
- do(action="Swipe", start=[x1,y1], end=[x2,y2])
    Swipe是滑动操作。start和end参数是必须的。坐标系统 (0,0) 到 (1000,1000)。
    如果滑动不生效，尝试增大滑动距离。
- do(action="Back")
    返回上一个界面。
- do(action="Home")
    回到桌面。
- do(action="Wait", duration="x seconds")
    等待页面加载。当页面正在加载，或者上一步操作后界面没有预期变化时使用。
- do(action="Long Press", element=[x,y])
    长按操作。element参数是必须的。
- do(action="Double Tap", element=[x,y])
    双击操作。element参数是必须的。
- finish(message="xxx")
    任务完成。

**思考过程（<think>）必须包含以下步骤：**
1. **观察（Observation）**：
   - 当前截图里有什么？（例如：看到了微信主界面、看到了搜索框、看到了键盘弹出、看到了聊天窗口等）。
   - 当前前台应用是什么？
2. **反思（Reflection）**：
   - **上一步操作是什么？**（查看 User Message 中的 Last Action）
   - **执行成功了吗？** 观察截图，判断界面是否发生了预期的变化。
   - **自我纠错（Self-Correction）**：
     - 如果上一步是 Launch，现在是否已经进入了目标 App？如果已经进入，**绝对不要**再次 Launch。
     - 如果上一步是 Tap，界面是否跳转？如果没跳转，是否需要 Wait？或者点击位置不对？
     - 如果上一步是 Type，输入框里是否有字了？如果有字，**不要**再次 Type，应该寻找下一步操作（如点击搜索）。
     - 如果我正打算执行 Launch，但我发现已经在该 App 里了，我必须取消 Launch，改为执行 App 内的操作。
3. **决策（Decision）**：
   - 基于以上观察和反思，下一步最合理的操作是什么？

**必须遵循的规则：**
 1. 坐标系是 0-1000 的相对坐标。
 2. **Launch 规则（绝对禁止重复启动）**：
    - 只有当用户明确要求打开新 App，且当前界面明显不是该 App 时，才执行 Launch。
    - **如果视觉上已经在目标 App 内（例如看到了微信列表、搜索框等），绝对禁止执行 Launch。**
 3. **Type 规则**：
    - 如果输入框已有文字且正确，不要重复 Type。
    - Type 会自动清空原有文本，不要手动删除。
 4. **视觉闭环验证（CRITICAL）**：
    - 每一步操作前，**必须**先仔细观察截图，确认上一步操作是否生效。
    - 如果连续两次操作无效，请尝试 Wait 或 Back，或者更换策略。
 5. **任务完成判断（CRITICAL）**：
    - **不要恋战**：一旦观察到界面状态已经满足用户需求（例如：用户要求“打开微信”，而你已经看到了微信聊天列表），**必须立即执行 finish**。
    - **不要重复**：如果你发现自己正在重复执行相同的操作（如重复点击同一个按钮），请立即停止。反思任务是否已经完成了？或者是否陷入了死循环？如果是，请 finish 并说明情况。
 6. **参数完整性**：执行 Tap/Double Tap/Long Press 时必须提供 element=[x,y] 参数。执行 Type 时必须提供 text 参数。
 7. 严格遵循用户意图。
`;
  }

  /**
   * 解析动作字符串 do(action="Tap", ...)
   */
  parseAction(actionStr) {
    actionStr = actionStr.trim();
    
    // 处理 finish
    if (actionStr.startsWith('finish')) {
      const msgMatch = actionStr.match(/message=["'](.+?)["']/);
      return {
        action: 'finish',
        message: msgMatch ? msgMatch[1] : 'Task completed',
        _raw: actionStr
      };
    }

    // 处理 do
    if (actionStr.startsWith('do')) {
      const content = actionStr.slice(3, -1); // 去掉 do( ... )
      const result = {};
      
      // 简单的参数解析器
      // 匹配 key="value" 或 key=[1,2] 或 key=[ 1, 2 ]
      // 增强正则：允许数组内有空格
      const regex = /(\w+)=(?:["']([^"']*)["']|\[([\d,\s]+)\])/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        const strValue = match[2];
        const arrayValue = match[3];
        
        if (arrayValue) {
          // 处理数组内的空格
          result[key] = arrayValue.split(',').map(item => Number(item.trim()));
        } else {
          result[key] = strValue;
        }
      }
      
      // 验证必要参数
      if (['Tap', 'Double Tap', 'Long Press'].includes(result.action) && !result.element) {
          throw new Error(`动作 ${result.action} 缺少必须参数: element=[x,y]`);
      }
      if (['Type', 'Type_Name'].includes(result.action) && !result.text) {
          throw new Error(`动作 ${result.action} 缺少必须参数: text="xxx"`);
      }
      if (['Swipe'].includes(result.action) && (!result.start || !result.end)) {
          throw new Error(`动作 ${result.action} 缺少必须参数: start=[x,y], end=[x,y]`);
      }
      if (['Launch'].includes(result.action) && !result.app) {
          throw new Error(`动作 ${result.action} 缺少必须参数: app="xxx"`);
      }

      result._raw = actionStr;
      return result;
    }

    throw new Error(`无法解析动作: ${actionStr}`);
  }

  /**
   * 调用豆包API（支持多模态）
   */
  async callAPI(userMessage, systemPrompt = null, images = []) {
    if (!this.apiKey || !this.apiUrl) {
      throw new Error('豆包API配置不完整，请检查config/default.json');
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // 构建用户消息
    let userContent = [];
    
    // 1. 添加文本内容
    userContent.push({
      type: 'text',
      text: userMessage
    });

    // 2. 添加图片内容（如果有）
    if (images && images.length > 0) {
      for (const base64Img of images) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Img}`
          }
        });
      }
    }

    // 如果没有图片，为了兼容某些不支持 image_url 格式的旧模型接口，
    // 或者为了保持简单，可以将 content 还原为纯字符串
    // 但标准的 OpenAI 格式兼容 content 为 array
    if (images.length === 0) {
       messages.push({ role: 'user', content: userMessage });
    } else {
       messages.push({ role: 'user', content: userContent });
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      const content = response.data.choices?.[0]?.message?.content || '';
      this.logger.debug('Doubao API response', { content });
      return content;
    } catch (error) {
      this.logger.error('Doubao API call failed', error);
      throw error;
    }
  }

  /**
   * 基于当前屏幕状态规划下一步（观察-行动循环）
   */
  async planNextStep(userQuery, uiDump, deviceInfo = {}, executionHistory = [], repeatedOps = [], windowInfo = null, screenshot = null, uiElements = null) {
    const systemPrompt = this.buildSystemPrompt();
    
    let userMessage = `用户需求：${userQuery}

当前界面状态：
`;

    // 添加 Window Dump 信息
    if (windowInfo) {
        userMessage += `\n** Window Info **\n`;
        userMessage += `- App: ${windowInfo.focusedApp || 'Unknown'}\n`;
    }

    // 添加 上一步操作 信息
    if (executionHistory && executionHistory.length > 0) {
        const lastStep = executionHistory[executionHistory.length - 1];
        // 简化 lastStep 信息，只保留关键字段
        const simpleLastStep = {
            action: lastStep.action,
            // 如果有 element, text, app 等参数，也应该展示
            ...lastStep
        };
        // 移除 rawResponse 等冗余信息
        delete simpleLastStep.rawResponse;
        delete simpleLastStep.thinking;
        delete simpleLastStep._raw;

        userMessage += `\n** 上一步操作 (Last Action) **\n${JSON.stringify(simpleLastStep, null, 2)}\n`;
    }

    // 添加 UI 元素 (Open-AutoGLM 风格，只是简单的文本描述辅助，主要靠视觉)
    if (uiElements && uiElements.length > 0) {
        // 转换坐标为 0-1000 相对坐标
        const width = deviceInfo.screenSize?.width || 1080;
        const height = deviceInfo.screenSize?.height || 2400;
        
        const simplifiedList = uiElements.slice(0, 50).map(el => {
            const relX = Math.round((el.center.x / width) * 1000);
            const relY = Math.round((el.center.y / height) * 1000);
            return `- ${el.text || el.desc || el.id} @ [${relX},${relY}]`;
        }).join('\n');
        
        userMessage += `\n** UI Elements (Reference) **\n${simplifiedList}\n`;
    }

    userMessage += `\n请观察截图和上述信息，输出下一步操作。Remember to use <think> and <answer> tags.`;

    try {
       const images = screenshot ? [screenshot] : [];
       const response = await this.callAPI(userMessage, systemPrompt, images);
      
      // 解析 <think> 和 <answer>
      const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/);
      const answerMatch = response.match(/<answer>([\s\S]*?)<\/answer>/);

      const thinking = thinkMatch ? thinkMatch[1].trim() : '';
      const actionStr = answerMatch ? answerMatch[1].trim() : response.trim(); // Fallback if tags missing

      let action;
      try {
        action = this.parseAction(actionStr);
      } catch (e) {
        this.logger.error('动作解析失败', e, { actionStr });
        // 尝试修复或返回错误
        throw new Error(`动作解析失败: ${actionStr}`);
      }

      return {
          action: action,
          thinking: thinking,
          rawResponse: response
      };

    } catch (error) {
      this.logger.error('Failed to plan next step', error);
      throw new Error(`规划失败: ${error.message}`);
    }
  }

  /**
   * 兼容旧接口的 generatePlan (用于第一步)
   * 实际上第一步和后续步骤逻辑一样，只是 prompt 可能不同
   */
  async generatePlan(userQuery, deviceInfo, uiDump, windowInfo, screenshot, uiElements) {
      return this.planNextStep(userQuery, uiDump, deviceInfo, [], [], windowInfo, screenshot, uiElements);
  }


  /**
   * 判断是否需要先观察
   */
  shouldObserveFirst(userQuery, uiDump) {
    // 如果已经有UI层级信息，不需要再观察
    if (uiDump) {
      return false;
    }
    
    // 如果目标明确且可以直接操作，不需要先观察
    const directActions = [
      /打开\s*\w+/i,
      /启动\s*\w+/i,
      /设置\s*(亮度|音量|WiFi|蓝牙)/i,
      /截屏/i,
      /screenshot/i
    ];
    
    if (directActions.some(pattern => pattern.test(userQuery))) {
      return false;
    }
    
    // 如果需要操作UI元素（点击、输入等），可能需要先观察
    const needsUI = [
      /点击/i,
      /输入/i,
      /发送/i,
      /查找/i,
      /搜索/i
    ];
    
    return needsUI.some(pattern => pattern.test(userQuery));
  }

  /**
   * 验证计划结构
   */
  validatePlan(plan) {
    if (!plan.steps || !Array.isArray(plan.steps)) {
      throw new Error('计划必须包含steps数组');
    }

    for (const step of plan.steps) {
      if (!step.id || !step.cmd) {
        throw new Error('每个步骤必须包含id和cmd字段');
      }
      // verify 是可选的
      if (step.verify && !Array.isArray(step.verify)) {
        throw new Error('verify必须是数组');
      }
    }
  }

  /**
   * 请求重新规划（当执行失败时）
   */
  async replan(userQuery, failedStep, errorInfo, deviceState) {
    const systemPrompt = this.buildSystemPrompt();
    
    const userMessage = `之前的执行计划失败了，请重新规划。

原始需求：${userQuery}

失败步骤：
- ID: ${failedStep.id}
- 命令: ${failedStep.cmd}
- 错误: ${errorInfo.message || errorInfo}

当前设备状态：
- 前台应用: ${deviceState.foregroundActivity || 'Unknown'}
- 屏幕状态: ${deviceState.screenOn ? '亮屏' : '息屏'}
- 解锁状态: ${deviceState.unlocked ? '已解锁' : '未解锁'}

请根据当前状态重新生成可行的执行计划。`;

    return this.generatePlan(userMessage);
  }
}

export default DoubaoAgent;


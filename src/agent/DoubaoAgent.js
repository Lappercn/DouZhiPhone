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
   * 构建系统提示词（通用 Android 智能体模式）
   */
  buildSystemPrompt() {
    return `你是一位全能型 Android 智能助手。你的目标是利用一切可用手段（ADB、Shell、UI 操作、视觉识别）来解决用户在 Android 设备上的任何需求。

## 核心角色定义：
你不仅是一个简单的自动化脚本执行者，你是 Android 领域的专家。
- **对于应用操作**：你可以像人类一样点击、滑动、输入，操作任何 App。
- **对于系统管理**：你可以修改设置、管理文件、查看进程、调试系统。
- **对于信息获取**：你可以阅读屏幕内容、提取数据、分析界面布局。

## 你的能力边界：
你可以执行任何 adb shell 允许的操作。不要局限于“点击按钮”。
- 需要安装应用？直接 \`pm install\`
- 需要打开网页？直接 \`am start -a android.intent.action.VIEW -d url\`
- 需要提取日志？直接 \`logcat -d\`
- 需要查看当前 Activity？直接 \`dumpsys activity\`
- 需要操作界面？使用 \`input tap/swipe/text\`

## 决策流程（Observation-Thought-Action）：
1. **感知（Observe）**：
   - 仔细分析用户提供的**屏幕截图**（视觉信息）。
   - **核心参考：UI 元素列表（UI Elements）**。这个列表提供了屏幕上所有可点击元素的**精确中心点坐标 (center)**。
   - 结合**Window Dump**（系统层级状态）。
   
2. **思考（Think）**：
   - **反思（Reflection）**：回顾上一步操作是否成功？界面是否发生了预期变化？
   - **检查（Check）**：如果是发消息任务，检查聊天记录里是否已经出现了刚才发送的内容？输入框是否变空了？
   - **规划（Plan）**：优先在 **UI 元素列表** 中寻找与目标匹配的元素。
   - **如果找到匹配元素，建议直接使用其提供的 center 坐标进行点击**。
   - **如果 UI 列表里找不到明确的 text/desc**，请尝试寻找 type="clickable_area" 且位置（bounds）符合视觉预期的元素。
   - **如果 UI 列表完全没有相关元素**（例如纯图像绘制的界面），请大胆基于**截图**进行视觉估算。
   - 如果必须视觉估算，请参考屏幕分辨率进行比例换算。

3. **行动（Act）**：
   - 生成具体的 ADB 命令。
   - **点击优化**：如果是点击操作，尽量使用 input tap x y，其中 x,y 来自 UI 列表的精确值。
   - **说明理由**：在 thought 字段中说明你选择该坐标的理由。

## 交互协议（JSON）：
为了与执行系统对接，你必须将思考结果转换为以下标准 JSON 格式。
**严禁缺少 steps 中的 id 和 cmd 字段**。

\`\`\`json
{
  "steps": [
    {
      "id": "unique_step_id",
      "desc": "简明扼要的步骤描述",
      "cmd": "adb shell <具体的命令>",
      "wait_after": 1000
    }
  ],
  "thought": "简述你的思考过程（可选）",
  "risks": []
}
\`\`\`

## 关键执行策略：
### 1. 灵活应对 UI 操作（视觉 + 坐标）
- **优先策略：UI 列表坐标 > 视觉估算坐标**。
- 系统会提供一个 ui_elements 列表，其中包含了屏幕上所有可交互元素的文本、ID 和**精确中心点坐标**。
- **任务执行前，先查表**：比如你要点“设置”，先看列表里有没有 text="设置" 的元素。如果有，直接用它的 center 坐标，**准确率 100%**。
- 如果列表中找不到（例如纯图片按钮），请参考 type="clickable_area" 的元素，结合截图位置进行推断。
- 只有当 XML 获取失败或列表里完全没有目标线索时，才使用视觉估算。
- **点击偏差处理**：如果之前的点击无效，请尝试微调坐标（偏移 10-30px）或改变点击位置（中心/边缘）。

### 2. 结果验证（闭环思维）
- 不要盲目执行。每一步操作后，必须考虑“我怎么知道成功了没？”。
- **视觉验证**：例如发送消息后，看到消息气泡出现在屏幕上，即视为成功。
- **状态验证**：例如打开应用后，检查前台 Activity 是否变化。输入文字后，检查输入框是否已有内容。发送后，检查输入框是否变空。
- **防止重复**：如果你发现你正要执行的操作（如点击发送）在之前的步骤中已经做过了，**请立刻停下来检查**！很可能已经成功了，只是你没注意到。
- **任务完成**：一旦确认目标达成（如消息已上屏），立即返回空步骤数组结束任务。

### 3. 文本输入规范
- **必须使用**：\`adb shell input text "内容"\`
- **中文支持**：系统已内置 ADBKeyBoard，直接发送中文即可，无需特殊处理。

### 4. 异常处理
- 如果遇到弹窗干扰，规划步骤去关闭它。
- 如果应用无响应，考虑重启应用 (\`am force-stop\` 后再启动)。
- 如果重复操作无效，**必须**更换策略（例如从点击改为滑动，或使用 Shell 命令直接调起）。

## 任务完成信号：
当且仅当通过视觉或状态确认任务已彻底完成时，返回：
\`\`\`json
{
  "steps": [],
  "completed": true,
  "message": "任务已完成：<简述结果>"
}
\`\`\`

请严格遵守 JSON 格式，不要输出 Markdown 标记以外的多余文本。`;
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
   * 解析用户需求并生成初始执行计划
   */
  async generatePlan(userQuery, deviceInfo = {}, uiDump = null, windowInfo = null, screenshot = null, uiElements = null) {
    const systemPrompt = this.buildSystemPrompt();
    
    // 构建用户消息
    let userMessage = `用户需求：${userQuery}

设备基本信息：
- 序列号：{serial}
- 型号：${deviceInfo.model || 'Unknown'}
- Android版本：${deviceInfo.androidVersion || 'Unknown'}

🔴 **屏幕分辨率（非常重要）**：
- 宽度：${deviceInfo.screenSize?.width || 0} px
- 高度：${deviceInfo.screenSize?.height || 0} px
- 请务必基于此分辨率计算坐标！不要超出边界！`;

    // 添加 Window Dump 信息
    if (windowInfo) {
      userMessage += `\n\n当前窗口状态 (Window Dump)：\n`;
      userMessage += `- 前台应用: ${windowInfo.focusedApp || 'Unknown'}\n`;
      userMessage += `- 键盘状态: ${windowInfo.hasKeyboard ? '已弹出' : '未弹出'}\n`;
      userMessage += `- 可见窗口: ${windowInfo.visibleWindows.join(', ')}\n`;
    }

    // 如果有UI层级信息，添加到消息中
    if (uiElements && uiElements.length > 0) {
      // 优先使用简化的UI元素列表（提供精确坐标）
      // 限制元素数量，避免 Prompt 过长，但提高上限
      const simplifiedList = uiElements.slice(0, 200).map(el => 
        `- [${el.text || el.desc || el.id}] Center: (${el.center.x}, ${el.center.y}) Bounds: ${el.bounds} Raw: ${el.raw}`
      ).join('\n');
      
      userMessage += `\n\n【强烈推荐】已识别的UI元素列表（请优先使用此处的精确坐标）：\n${simplifiedList}`;
      if (uiElements.length > 200) {
        userMessage += `\n... (还有 ${uiElements.length - 200} 个元素未显示)`;
      }
    } else if (uiDump) {
      // 降级使用 raw XML
      userMessage += `\n\n当前屏幕UI层级信息：\n\`\`\`xml\n${uiDump.substring(0, 10000)}\n\`\`\``; // 截断过长的XML
    } else {
      userMessage += `\n\n(无法获取UI层级，请完全依赖视觉和分辨率进行坐标估算)`;
    }
    
    if (screenshot) {
      userMessage += `\n\n(已附带当前屏幕截图，请结合图片分析界面)`;
    }

    try {
      // 传递 screenshot
      const images = screenshot ? [screenshot] : [];
      const response = await this.callAPI(userMessage, systemPrompt, images);
      
      // 尝试提取JSON（可能包含markdown代码块）
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '').trim();
      }

      let plan;
      try {
        plan = JSON.parse(jsonStr);
      } catch (e) {
        this.logger.error('JSON解析失败', e, { jsonStr });
        throw new Error('模型返回的JSON格式无效');
      }
      
      // 验证计划结构（允许空步骤数组表示完成）
      if (plan.steps && plan.steps.length > 0) {
        try {
          this.validatePlan(plan);
        } catch (validationError) {
          this.logger.error('计划验证失败', validationError, { plan });
          throw validationError;
        }
      }
      
      return plan;
    } catch (error) {
      this.logger.error('Failed to generate plan', error);
      throw new Error(`计划生成失败: ${error.message}`);
    }
  }

  /**
   * 基于当前屏幕状态规划下一步（观察-行动循环）
   */
  async planNextStep(userQuery, uiDump, deviceInfo = {}, executionHistory = [], repeatedOps = [], windowInfo = null, screenshot = null, uiElements = null) {
    const systemPrompt = this.buildSystemPrompt();
    
    let userMessage = `用户需求：${userQuery}

设备基本信息：
- 序列号：{serial}
- 型号：${deviceInfo.model || 'Unknown'}
- Android版本：${deviceInfo.androidVersion || 'Unknown'}

🔴 **屏幕分辨率（非常重要）**：
- 宽度：${deviceInfo.screenSize?.width || 0} px
- 高度：${deviceInfo.screenSize?.height || 0} px
- 请务必基于此分辨率计算坐标！不要超出边界！`;

    // 添加 Window Dump 信息
    if (windowInfo) {
      userMessage += `\n\n当前窗口状态 (Window Dump)：\n`;
      userMessage += `- 前台应用: ${windowInfo.focusedApp || 'Unknown'}\n`;
      userMessage += `- 键盘状态: ${windowInfo.hasKeyboard ? '已弹出' : '未弹出'}\n`;
      userMessage += `- 可见窗口: ${windowInfo.visibleWindows.join(', ')}\n`;
    }

    // 添加执行历史
    if (executionHistory.length > 0) {
      userMessage += `\n\n已执行步骤：\n`;
      executionHistory.slice(-5).forEach((step, idx) => {
        userMessage += `${idx + 1}. ${step.desc || step.id}: ${step.success ? '成功' : '失败'}\n`;
      });
    }
    
    // 如果有重复操作，提醒模型换方法
    if (repeatedOps.length > 0) {
      userMessage += `\n\n⚠️ 重要提醒：以下操作已经重复执行多次但没有进展：\n`;
      repeatedOps.forEach(op => {
        userMessage += `- ${op}\n`;
      });
      userMessage += `\n请立即停止重复这些操作，尝试以下策略：\n`;
      userMessage += `- **微调坐标**：如果是点击操作，请尝试在原坐标周围偏移 10-30 像素\n`;
      userMessage += `- **换个位置**：如果是按钮，尝试点击按钮的中心或边缘\n`;
      userMessage += `- **换种方法**：如果多次获取UI层级没有进展，尝试滑动、点击或返回\n`;
    }

    // 如果有UI层级信息，添加到消息中
    if (uiElements && uiElements.length > 0) {
      const simplifiedList = uiElements.slice(0, 200).map(el => 
        `- [${el.text || el.desc || el.id}] Center: (${el.center.x}, ${el.center.y}) Bounds: ${el.bounds} Raw: ${el.raw}`
      ).join('\n');
      
      userMessage += `\n\n【强烈推荐】已识别的UI元素列表（请优先使用此处的精确坐标）：\n${simplifiedList}`;
      if (uiElements.length > 200) {
        userMessage += `\n... (还有 ${uiElements.length - 200} 个元素未显示)`;
      }
    } else if (uiDump) {
      userMessage += `\n\n当前屏幕UI层级信息：\n\`\`\`xml\n${uiDump.substring(0, 10000)}\n\`\`\``;
    }
    
    if (screenshot) {
      userMessage += `\n\n(已附带当前屏幕截图，请结合图片分析界面)`;
    }

    userMessage += `\n\n请基于当前实际状态，规划下一步操作。`;

    try {
       // 传递 screenshot
       const images = screenshot ? [screenshot] : [];
       const response = await this.callAPI(userMessage, systemPrompt, images);
      
      // 尝试提取JSON
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '').trim();
      }

      let plan;
      try {
        plan = JSON.parse(jsonStr);
      } catch (e) {
        this.logger.error('JSON解析失败', e, { jsonStr });
        throw new Error('模型返回的JSON格式无效');
      }

      if (plan.steps && plan.steps.length > 0) {
        try {
          this.validatePlan(plan);
        } catch (validationError) {
          this.logger.error('计划验证失败', validationError, { plan });
          throw validationError;
        }
      }
      return plan;
    } catch (error) {
      this.logger.error('Failed to plan next step', error);
      throw new Error(`规划失败: ${error.message}`);
    }
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


import DeviceManager from './device/DeviceManager.js';
import Logger from './utils/logger.js';
import fs from 'fs';
import path from 'path';

async function testUIExtraction() {
  const logger = new Logger();
  const deviceManager = new DeviceManager('adb', logger);

  try {
    console.log('正在查找已连接的设备...');
    const devices = await deviceManager.listDevices();
    
    if (devices.length === 0) {
      console.error('❌ 未找到已连接的设备，请先连接手机');
      return;
    }

    const serial = devices[0].serial;
    console.log(`✅ 找到设备: ${serial} (${devices[0].model})`);

    // 方法1: 标准 uiautomator dump
    console.log('\n[Method 1] 尝试标准 uiautomator dump...');
    await deviceManager.execAdb(serial, 'rm /sdcard/window_dump.xml'); // 清理
    const start1 = Date.now();
    let xmlContent = await deviceManager.getUIADump(serial, '/sdcard/window_dump.xml');
    const end1 = Date.now();

    if (xmlContent) {
      console.log(`✅ [Method 1] 获取成功！耗时: ${end1 - start1}ms`);
      saveAndParse(xmlContent, 'dump_standard.xml', deviceManager);
    } else {
      console.warn('⚠️ [Method 1] 获取失败或内容判定为无效，尝试备选方案...');
      
      // 方法2: 压缩模式
      console.log('\n[Method 2] 尝试 uiautomator dump --compressed...');
      await deviceManager.execAdb(serial, 'rm /sdcard/window_dump_comp.xml');
      const start2 = Date.now();
      const res2 = await deviceManager.execAdb(serial, 'uiautomator dump --compressed /sdcard/window_dump_comp.xml', { timeout: 20000 });
      
      if (res2.success) {
        const readRes2 = await deviceManager.execAdb(serial, 'cat /sdcard/window_dump_comp.xml');
        let compContent = readRes2.stdout || '';
        const end2 = Date.now();
        
        // 使用同样的校验逻辑
        const isValid = compContent.length > 100 && compContent.includes('<hierarchy') && !compContent.match(/bounds="\[0,0\]\[0,0\]"\s*\/>\s*<\/hierarchy>/);

        if (isValid) {
          console.log(`✅ [Method 2] 获取成功！耗时: ${end2 - start2}ms`);
          saveAndParse(compContent, 'dump_compressed.xml', deviceManager);
        } else {
           console.warn(`⚠️ [Method 2] 获取内容仍无效 (Length: ${compContent.length})`);
           if (compContent) saveAndParse(compContent, 'dump_compressed_failed.xml', deviceManager);
        }
      } else {
         console.warn('⚠️ [Method 2] 命令执行失败');
      }
    }
    
    // 方法3: 检查是否是空层级（Hierarchy Empty）
    if (xmlContent && xmlContent.includes('bounds="[0,0][0,0]"')) {
       console.error('❌ 检测到无效的空层级结构！可能是应用阻止了截屏或界面未加载。');
    }

    // 方法4: Dumpsys Window (作为最后手段)
    console.log('\n[Method 4] 尝试 dumpsys window windows (获取窗口信息)...');
    const winDump = await deviceManager.getWindowDump(serial);
    if (winDump) {
       const winPath = path.resolve(process.cwd(), 'dumpsys_window.txt');
       fs.writeFileSync(winPath, winDump);
       console.log(`✅ 已保存 Window Dump 到: ${winPath}`);
       
       const winInfo = deviceManager.parseWindowDump(winDump);
       console.log('当前窗口信息:', winInfo);
    }

    // 方法5: Dumpsys Activity Top (尝试获取 View Hierarchy)
    console.log('\n[Method 5] 尝试 dumpsys activity top (获取顶层 Activity 视图信息)...');
    const actDumpRes = await deviceManager.execAdb(serial, 'dumpsys activity top');
    if (actDumpRes.success) {
        const actDumpPath = path.resolve(process.cwd(), 'dumpsys_activity_top.txt');
        fs.writeFileSync(actDumpPath, actDumpRes.stdout);
        console.log(`✅ 已保存 Activity Dump 到: ${actDumpPath}`);
        
        // 简单分析
        const viewHierarchyLines = actDumpRes.stdout.split('\n').filter(l => l.includes('View Hierarchy:'));
        if (viewHierarchyLines.length > 0) {
            console.log('✅ 发现 View Hierarchy 信息！');
        } else {
            console.log('⚠️ 未发现显式的 View Hierarchy 信息');
        }
    }

    // 方法6: Dumpsys Accessibility (获取无障碍节点信息)
    console.log('\n[Method 6] 尝试 dumpsys accessibility (获取无障碍服务信息)...');
    const accDumpRes = await deviceManager.execAdb(serial, 'dumpsys accessibility');
    if (accDumpRes.success) {
        const accDumpPath = path.resolve(process.cwd(), 'dumpsys_accessibility.txt');
        fs.writeFileSync(accDumpPath, accDumpRes.stdout);
        console.log(`✅ 已保存 Accessibility Dump 到: ${accDumpPath}`);
        
        if (accDumpRes.stdout.length > 1000) {
            console.log(`📄 内容长度: ${accDumpRes.stdout.length}，可能包含有用信息`);
        }
    }


  } catch (error) {
    console.error('❌ 测试过程发生错误:', error);
  }
}

function saveAndParse(xmlContent, filename, deviceManager) {
    const dumpPath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(dumpPath, xmlContent);
    console.log(`💾 已保存 XML 到: ${dumpPath}`);
    
    const elements = deviceManager.parseUIXmlToSimplified(xmlContent);
    console.log(`🔍 解析结果: 识别到 ${elements ? elements.length : 0} 个元素`);
    
    if (elements && elements.length > 0) {
        // 检查是否有任何元素的 bounds 不是 [0,0][0,0] 且不是全屏
        const validElements = elements.filter(el => {
            return el.bounds !== '[0,0][0,0]' && !el.bounds.startsWith('[0,0][1080,'); // 简单过滤全屏背景
        });
        console.log(`✨ 有效交互元素: ${validElements.length} 个`);
    }
}

testUIExtraction();
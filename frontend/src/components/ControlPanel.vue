<template>
  <div class="control-panel">
    <div class="split-layout">
      <!-- 左侧：任务控制与日志 -->
      <div class="left-section">
        <div class="glass-card control-area">
          <div class="panel-header">
            <div class="header-left">
              <el-icon class="pulse-icon"><Operation /></el-icon>
              <span>任务控制中心</span>
              <el-tooltip content="连接远程 Wi-Fi 设备" placement="top">
                <el-button type="primary" link @click="showWifiDialog = true" class="wifi-btn">
                  <el-icon><Connection /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
            <el-select 
              v-model="form.deviceSerial" 
              placeholder="选择设备" 
              size="small"
              class="device-selector"
              @visible-change="refreshDevices"
            >
              <el-option
                v-for="device in devices"
                :key="device.serial"
                :label="device.model"
                :value="device.serial"
              >
                <span style="float: left">{{ device.model }}</span>
                <span style="float: right; color: #8492a6; font-size: 13px">{{ device.serial }}</span>
              </el-option>
            </el-select>
          </div>

          <div class="input-area">
            <el-input
              v-model="form.query"
              type="textarea"
              :rows="3"
              placeholder="请输入自然语言指令，例如：打开抖音查看评论..."
              class="custom-textarea"
              resize="none"
            />
            <div class="action-buttons">
              <el-button 
                v-if="!loading"
                type="primary" 
                class="send-btn" 
                @click="startTask"
              >
                <el-icon><Position /></el-icon> 执行
              </el-button>
              
              <template v-else>
                <el-button 
                  v-if="taskStatus === 'running'"
                  type="warning" 
                  class="control-btn" 
                  @click="pauseTask"
                >
                  <el-icon><VideoPause /></el-icon> 暂停
                </el-button>
                
                <el-button 
                  v-if="taskStatus === 'paused'"
                  type="success" 
                  class="control-btn" 
                  @click="resumeTask"
                >
                  <el-icon><VideoPlay /></el-icon> 恢复
                </el-button>

                <el-button 
                  type="danger" 
                  class="control-btn" 
                  @click="stopTask"
                >
                  <el-icon><SwitchButton /></el-icon> 终止
                </el-button>
              </template>
            </div>
          </div>
        </div>

        <div class="glass-card agent-area">
          <div class="agent-header">
            <span><el-icon><Cpu /></el-icon> AI 智能体状态</span>
            <el-button link type="danger" size="small" @click="clearLogs">清空日志</el-button>
          </div>
          
          <div class="agent-visualizer">
            <div class="agent-core" :class="{ 'active': loading, 'paused': taskStatus === 'paused' }">
              <div class="core-inner"></div>
              <div class="core-outer"></div>
              <div class="core-ring"></div>
              <div class="particles">
                <span v-for="n in 8" :key="n" :style="{ '--i': n }"></span>
              </div>
            </div>
            <div class="agent-status-text">
              {{ getStatusText() }}
            </div>
          </div>

          <div class="terminal-view" ref="logWindow">
            <div v-if="logs.length === 0" class="terminal-empty">
              > 等待指令...
            </div>
            <div v-else class="log-stream">
              <div v-for="(log, index) in logs" :key="index" class="log-row" :class="log.level">
                <span class="time">{{ formatTime(log.timestamp) }}</span>
                <span class="content">
                  <span v-if="log.stepId" class="step-tag">STEP {{ log.stepId }}</span>
                  {{ log.message }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：手机预览 -->
      <div class="right-section">
        <div class="phone-mockup">
          <div class="phone-body">
            <div class="dynamic-island"></div>
            <div class="side-button volume-up"></div>
            <div class="side-button volume-down"></div>
            <div class="side-button power"></div>
            
            <div class="screen-display">
              <transition name="fade" mode="out-in">
                <img 
                  v-if="screenshotUrl" 
                  :src="screenshotUrl" 
                  class="screen-img"
                  alt="Screen"
                />
                <div v-else class="screen-placeholder">
                  <div class="scan-line"></div>
                  <el-icon class="loading-icon"><Iphone /></el-icon>
                  <p>等待画面同步...</p>
                </div>
              </transition>
              
              <!-- 状态指示灯 -->
              <div class="status-indicator" :class="{ active: loading }">
                <span class="dot"></span>
                {{ loading ? 'AI 执行中...' : '就绪' }}
              </div>
            </div>
          </div>
          <div class="phone-shadow"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Wi-Fi 连接对话框 -->
  <el-dialog v-model="showWifiDialog" title="无线连接设备" width="400px" append-to-body>
    <el-form :model="wifiForm" label-width="80px">
      <el-alert
        title="提示：首次连接需先用 USB 连接并开启 TCP/IP 模式"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 20px"
      />
      <el-form-item label="IP地址">
        <el-input v-model="wifiForm.ip" placeholder="例如: 192.168.1.5" />
      </el-form-item>
      <el-form-item label="端口">
        <el-input v-model="wifiForm.port" placeholder="默认: 5555" />
      </el-form-item>
      <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #606266;">
        <p style="font-weight: bold; margin-bottom: 5px;">如何查看手机 IP？</p>
        <p>1. 打开手机【设置】->【WLAN】</p>
        <p>2. 点击当前连接的 Wi-Fi 详情</p>
        <p>3. 找到【IP地址】一栏 (例如 192.168.1.5)</p>
        <p style="margin-top: 5px; color: #e6a23c;">注意：电脑和手机必须连接同一个 Wi-Fi</p>
      </div>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="enableTcpIpMode" type="success" plain size="small" style="float: left" v-if="form.deviceSerial && !form.deviceSerial.includes(':')">
          <el-icon><Iphone /></el-icon> 对当前USB设备开启WIFI模式
        </el-button>
        <el-button @click="showWifiDialog = false">取消</el-button>
        <el-button type="primary" @click="connectWifi" :loading="wifiConnecting">
          连接
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import axios from 'axios'
import { io } from 'socket.io-client'
import { ElMessage } from 'element-plus'
import { Operation, Position, Tickets, Iphone, VideoPause, VideoPlay, SwitchButton, Cpu, Connection } from '@element-plus/icons-vue'

const API_BASE = 'http://localhost:3000'
const socket = io(API_BASE)

const devices = ref([])
const logs = ref([])
const loading = ref(false)
const taskStatus = ref('idle') // idle, running, paused
const currentReqId = ref(null)
const screenshotUrl = ref('')
const logWindow = ref(null)

// Wi-Fi 连接相关
const showWifiDialog = ref(false)
const wifiConnecting = ref(false)
const wifiForm = ref({
  ip: '',
  port: '5555'
})

const form = ref({
  deviceSerial: '',
  query: ''
})

const getStatusText = () => {
  if (taskStatus.value === 'paused') return '已暂停 - 等待人工干预'
  if (loading.value) return 'AI 正在思考与执行...'
  return 'AI 智能体就绪'
}

const formatTime = (isoString) => {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour12: false })
}

watch(logs.value, () => {
  nextTick(() => {
    if (logWindow.value) {
      logWindow.value.scrollTop = logWindow.value.scrollHeight
    }
  })
})

const refreshDevices = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/devices`)
    if (res.data.success) {
      devices.value = res.data.devices
      if (devices.value.length > 0 && !form.value.deviceSerial) {
        form.value.deviceSerial = devices.value[0].serial
        manualRefreshScreenshot()
      }
    }
  } catch (err) {
    ElMessage.error('设备列表获取失败')
  }
}

const startTask = async () => {
  if (!form.value.deviceSerial) return ElMessage.warning('请先选择设备')
  if (!form.value.query) return ElMessage.warning('指令不能为空')

  loading.value = true
  taskStatus.value = 'running'
  logs.value = []
  
  try {
    const res = await axios.post(`${API_BASE}/api/task`, {
      query: form.value.query,
      deviceSerial: form.value.deviceSerial
    })
    if (res.data.success) {
      currentReqId.value = res.data.reqId
    }
  } catch (err) {
    ElMessage.error('任务启动失败')
    loading.value = false
    taskStatus.value = 'idle'
  }
}

const pauseTask = async () => {
  if (!currentReqId.value) return
  try {
    await axios.post(`${API_BASE}/api/task/${currentReqId.value}/pause`)
    taskStatus.value = 'paused'
    ElMessage.info('任务已暂停，您可以进行人工干预')
  } catch (err) {
    ElMessage.error('暂停失败')
  }
}

const resumeTask = async () => {
  if (!currentReqId.value) return
  try {
    await axios.post(`${API_BASE}/api/task/${currentReqId.value}/resume`)
    taskStatus.value = 'running'
    ElMessage.success('任务继续执行')
  } catch (err) {
    ElMessage.error('恢复失败')
  }
}

const stopTask = async () => {
  if (!currentReqId.value) return
  try {
    await axios.post(`${API_BASE}/api/task/${currentReqId.value}/stop`)
    loading.value = false
    taskStatus.value = 'idle'
    ElMessage.warning('任务已终止')
  } catch (err) {
    ElMessage.error('终止失败')
  }
}

const manualRefreshScreenshot = () => {
  if (!form.value.deviceSerial) return
  screenshotUrl.value = `${API_BASE}/api/screenshot?serial=${form.value.deviceSerial}&t=${Date.now()}`
}

const clearLogs = () => logs.value = []

// 开启 TCP/IP 模式
const enableTcpIpMode = async () => {
  if (!form.value.deviceSerial) return ElMessage.warning('请先选择一个已连接的 USB 设备')
  
  try {
    const res = await axios.post(`${API_BASE}/api/device/tcpip`, {
      serial: form.value.deviceSerial,
      port: 5555
    })
    if (res.data.success) {
      ElMessage.success('已开启 Wi-Fi 调试模式，请断开 USB 线并输入 IP 连接')
    } else {
      ElMessage.error('开启失败: ' + res.data.error)
    }
  } catch (err) {
    ElMessage.error('请求失败')
  }
}

// 连接 Wi-Fi 设备
const connectWifi = async () => {
  if (!wifiForm.value.ip) return ElMessage.warning('请输入 IP 地址')
  
  wifiConnecting.value = true
  try {
    const res = await axios.post(`${API_BASE}/api/device/connect`, {
      ip: wifiForm.value.ip,
      port: parseInt(wifiForm.value.port) || 5555
    })
    
    if (res.data.success) {
      ElMessage.success('连接成功')
      showWifiDialog.value = false
      refreshDevices() // 刷新设备列表
    } else {
      ElMessage.error('连接失败: ' + res.data.message)
    }
  } catch (err) {
    ElMessage.error('连接请求失败')
  } finally {
    wifiConnecting.value = false
  }
}

onMounted(() => {
  refreshDevices()
  
  socket.on('log', (entry) => logs.value.push(entry))
  
  // 监听后端推送的实时截图流
  socket.on('screen_update', (base64) => {
    screenshotUrl.value = `data:image/png;base64,${base64}`
  })

  socket.on('task_completed', () => {
    loading.value = false
    taskStatus.value = 'idle'
    ElMessage.success('执行完成')
  })

  socket.on('task_error', (data) => {
    loading.value = false
    taskStatus.value = 'idle'
    ElMessage.error(data.message)
  })
})
</script>

<style scoped>
.control-panel {
  height: calc(100vh - 140px);
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.split-layout {
  display: flex;
  gap: 40px;
  height: 100%;
  align-items: stretch;
}

.left-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0; /* 防止flex子项溢出 */
}

.right-section {
  flex: 0 0 360px;
  display: flex;
  justify-content: center;
  align-items: center;
  perspective: 1000px;
}

/* Glass Card Style - Enhanced */
.glass-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.glass-card:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 15px 50px rgba(0, 0, 0, 0.12),
    inset 0 0 0 1px rgba(255, 255, 255, 0.6);
}

.control-area {
  padding: 24px;
  background: linear-gradient(145deg, rgba(255,255,255,0.9), rgba(245,247,250,0.9));
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  color: #2c3e50;
  font-weight: 600;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.wifi-btn {
  margin-left: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  color: #409EFF;
}

.wifi-btn:hover {
  background: rgba(64, 158, 255, 0.1);
}

.pulse-icon {
  color: #409EFF;
  animation: pulse 2s infinite;
}

.input-area {
  display: flex;
  gap: 12px;
}

.custom-textarea {
  flex: 1;
}

.custom-textarea :deep(.el-textarea__inner) {
  border-radius: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.6);
  border: 2px solid transparent;
  box-shadow: 
    inset 0 2px 6px rgba(0,0,0,0.04),
    0 1px 2px rgba(255,255,255,1);
  font-size: 15px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Inter', system-ui, sans-serif;
  line-height: 1.6;
}

.custom-textarea :deep(.el-textarea__inner:focus) {
  background: #fff;
  border-color: rgba(64, 158, 255, 0.3);
  box-shadow: 
    0 0 0 4px rgba(64, 158, 255, 0.1),
    0 8px 24px rgba(64, 158, 255, 0.15);
  transform: translateY(-1px);
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-left: 10px;
}

/* Button Styling */
.send-btn {
  background: linear-gradient(135deg, #409EFF, #3a8ee6) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  transition: all 0.3s !important;
  font-weight: 600;
  letter-spacing: 0.5px;
  height: auto !important;
  padding: 0 20px !important;
}

.send-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
  filter: brightness(1.1);
}

.send-btn:active {
  transform: translateY(0);
}

.control-btn {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s !important;
  border: none !important;
  height: auto !important;
  padding: 0 15px !important;
}

.control-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

/* 按钮图标间距 */
.el-button .el-icon {
  margin-right: 4px;
}

/* AI Agent Visualizer Styles - Enhanced */
.agent-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.95);
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  font-weight: 600;
  color: #2c3e50;
}

.agent-visualizer {
  height: 160px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: radial-gradient(circle at center, #f8fafd 0%, #edf2f7 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  position: relative;
}

.agent-status-text {
  margin-top: 15px;
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.agent-core {
  position: relative;
  width: 60px;
  height: 60px;
  filter: drop-shadow(0 0 15px rgba(64, 158, 255, 0.2));
}

.core-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 30px;
  background: linear-gradient(135deg, #409EFF, #36D1DC);
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(64, 158, 255, 0.4);
  transition: all 0.3s ease;
}

.core-outer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(64, 158, 255, 0.2);
  border-radius: 50%;
  animation: pulse 3s infinite ease-in-out;
}

.core-ring {
  position: absolute;
  top: -5px;
  left: -5px;
  width: calc(100% + 10px);
  height: calc(100% + 10px);
  border: 1px solid transparent;
  border-top-color: #409EFF;
  border-right-color: #409EFF;
  border-radius: 50%;
  animation: spin 4s linear infinite;
  opacity: 0.5;
}

.particles span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  background: #409EFF;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
}

/* Active State Animations */
.agent-core.active .core-inner {
  background: linear-gradient(135deg, #FF4081, #FF80AB); /* Pink/Red for active */
  box-shadow: 0 0 30px rgba(255, 64, 129, 0.6);
  animation: heartbeat 1s infinite ease-in-out;
}

.agent-core.active .core-outer {
  border-color: rgba(255, 64, 129, 0.3);
  animation: pulse-fast 1s infinite ease-in-out;
}

.agent-core.active .core-ring {
  border-top-color: #FF4081;
  border-right-color: #FF4081;
  animation: spin 1s linear infinite;
}

.agent-core.active .particles span {
  animation: particle-orbit 2s infinite linear;
  animation-delay: calc(var(--i) * 0.25s);
}

/* Paused State */
.agent-core.paused .core-inner {
  background: linear-gradient(135deg, #FFC107, #FFD54F); /* Yellow for paused */
  box-shadow: 0 0 20px rgba(255, 193, 7, 0.4);
  animation: none;
}

.agent-core.paused .core-ring {
  border-top-color: #FFC107;
  border-right-color: #FFC107;
  animation-play-state: paused;
}

/* Animations */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0.5; }
}

@keyframes pulse-fast {
  0% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 0.6; }
}

@keyframes heartbeat {
  0% { transform: translate(-50%, -50%) scale(1); }
  15% { transform: translate(-50%, -50%) scale(1.2); }
  30% { transform: translate(-50%, -50%) scale(1); }
  45% { transform: translate(-50%, -50%) scale(1.1); }
  60% { transform: translate(-50%, -50%) scale(1); }
  100% { transform: translate(-50%, -50%) scale(1); }
}

@keyframes particle-orbit {
  0% { transform: rotate(0deg) translateX(40px) rotate(0deg); opacity: 1; }
  100% { transform: rotate(360deg) translateX(40px) rotate(-360deg); opacity: 0; }
}

/* Terminal View - Enhanced */
.terminal-view {
  flex: 1;
  background: #fdfdfd;
  background-image: 
    linear-gradient(#f1f5f9 1px, transparent 1px),
    linear-gradient(90deg, #f1f5f9 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: -1px -1px;
  padding: 16px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

/* Custom Scrollbar for Terminal */
.terminal-view::-webkit-scrollbar {
  width: 8px;
}

.terminal-view::-webkit-scrollbar-track {
  background: transparent;
}

.terminal-view::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
  border: 2px solid #fdfdfd;
}

.terminal-view::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.terminal-empty {
  color: #909399;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: italic;
}

/* Log Stream */
.log-stream {
  position: relative;
  padding-left: 15px;
}

.log-stream::before {
  content: '';
  position: absolute;
  top: 0;
  left: 6px;
  width: 2px;
  height: 100%;
  background: linear-gradient(to bottom, transparent, #e0e6ed, transparent);
}

/* Log Rows - Enhanced */
.log-row {
  position: relative;
  margin-bottom: 12px;
  display: flex;
  gap: 12px;
  line-height: 1.5;
  opacity: 0;
  animation: slideInUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(226, 232, 240, 0.6);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.2s;
}

.log-row:hover {
  background: #fff;
  border-color: rgba(64, 158, 255, 0.3);
  box-shadow: 
    0 4px 12px rgba(64, 158, 255, 0.08),
    0 0 0 1px rgba(64, 158, 255, 0.1);
  transform: translateX(6px) scale(1.005);
}

.log-row::before {
  content: '';
  position: absolute;
  left: -13px;
  top: 16px;
  width: 8px;
  height: 8px;
  background: #fff;
  border: 2px solid #409EFF;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  z-index: 1;
  transition: all 0.3s;
}

.log-row:hover::before {
  background: #409EFF;
  transform: scale(1.2);
}

.log-row .time {
  color: #909399;
  font-size: 12px;
  min-width: 55px;
  font-weight: 500;
  margin-top: 2px;
}

.log-row .content {
  color: #606266;
  word-break: break-all;
  font-weight: 500;
}

.log-row.info .content { color: #303133; }
.log-row.warn .content { color: #e6a23c; }
.log-row.error .content { color: #f56c6c; }

.log-row.warn { background: rgba(253, 246, 236, 0.5); border-left: 3px solid #e6a23c; }
.log-row.error { background: rgba(254, 240, 240, 0.5); border-left: 3px solid #f56c6c; }

.log-row.warn::before { border-color: #e6a23c; box-shadow: 0 0 0 2px rgba(230, 162, 60, 0.2); }
.log-row.error::before { border-color: #f56c6c; box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2); }

.step-tag {
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 10px;
  margin-right: 8px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border: none;
}

@keyframes slideInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Phone Mockup - Enhanced */
.phone-mockup {
  position: relative;
  width: 320px;
  height: 650px;
  transform-style: preserve-3d;
  transform: rotateY(-5deg) rotateX(5deg);
  transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
  filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.25));
}

.phone-mockup:hover {
  transform: rotateY(0) rotateX(0);
}

.phone-body {
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 48px;
  border: 6px solid #1a1a1a;
  box-shadow: 
    inset 0 0 0 2px #333,
    inset 0 0 20px rgba(255,255,255,0.1);
  position: relative;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
}

.dynamic-island {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 28px;
  background: #000;
  border-radius: 14px;
  z-index: 20;
}

.screen-display {
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 36px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
}

.screen-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 0.2s;
}

.side-button {
  position: absolute;
  background: #2c2c2c;
  border-radius: 2px;
}

.volume-up { left: -6px; top: 120px; width: 4px; height: 40px; }
.volume-down { left: -6px; top: 170px; width: 4px; height: 40px; }
.power { right: -6px; top: 140px; width: 4px; height: 60px; }

.status-indicator {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(10px);
  padding: 6px 16px;
  border-radius: 20px;
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.3s;
}

.status-indicator.active {
  opacity: 1;
}

.dot {
  width: 6px;
  height: 6px;
  background: #67C23A;
  border-radius: 50%;
  box-shadow: 0 0 8px #67C23A;
}

.screen-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #444;
}

.loading-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
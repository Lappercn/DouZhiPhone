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
            <el-button 
              type="primary" 
              class="send-btn" 
              :loading="loading"
              @click="startTask"
            >
              <el-icon><Position /></el-icon>
            </el-button>
          </div>
        </div>

        <div class="glass-card log-area">
          <div class="panel-header compact">
            <span><el-icon><tickets /></el-icon> 实时日志</span>
            <el-button link type="danger" size="small" @click="clearLogs">清空</el-button>
          </div>
          <div class="terminal-view" ref="logWindow">
            <div v-if="logs.length === 0" class="terminal-empty">
              > Ready to execute commands...
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
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import axios from 'axios'
import { io } from 'socket.io-client'
import { ElMessage } from 'element-plus'
import { Operation, Position, Tickets, Iphone } from '@element-plus/icons-vue'

const API_BASE = 'http://localhost:3000'
const socket = io(API_BASE)

const devices = ref([])
const logs = ref([])
const loading = ref(false)
const screenshotUrl = ref('')
const logWindow = ref(null)

const form = ref({
  deviceSerial: '',
  query: ''
})

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
  logs.value = []
  
  try {
    await axios.post(`${API_BASE}/api/task`, {
      query: form.value.query,
      deviceSerial: form.value.deviceSerial
    })
  } catch (err) {
    ElMessage.error('任务启动失败')
    loading.value = false
  }
}

const manualRefreshScreenshot = () => {
  if (!form.value.deviceSerial) return
  screenshotUrl.value = `${API_BASE}/api/screenshot?serial=${form.value.deviceSerial}&t=${Date.now()}`
}

const clearLogs = () => logs.value = []

onMounted(() => {
  refreshDevices()
  
  socket.on('log', (entry) => logs.value.push(entry))
  
  // 监听后端推送的实时截图流
  socket.on('screen_update', (base64) => {
    screenshotUrl.value = `data:image/png;base64,${base64}`
  })

  socket.on('task_completed', () => {
    loading.value = false
    ElMessage.success('执行完成')
  })

  socket.on('task_error', (data) => {
    loading.value = false
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

/* Glass Card Style */
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: transform 0.3s ease;
}

.control-area {
  padding: 24px;
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
}

.pulse-icon {
  color: #409EFF;
  animation: pulse 2s infinite;
}

.input-area {
  position: relative;
}

.custom-textarea :deep(.el-textarea__inner) {
  border-radius: 16px;
  padding: 16px;
  padding-right: 60px;
  background: rgba(245, 247, 250, 0.8);
  border: none;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
  font-size: 15px;
  transition: all 0.3s;
}

.custom-textarea :deep(.el-textarea__inner:focus) {
  background: #fff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.send-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  border-radius: 12px !important;
  width: 40px;
  height: 40px;
  padding: 0 !important;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

/* Log Area */
.log-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.log-area .panel-header {
  padding: 16px 24px;
  margin-bottom: 0;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  background: rgba(255,255,255,0.5);
}

.terminal-view {
  flex: 1;
  background: #1e1e1e;
  padding: 16px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
}

.terminal-empty {
  color: #5c6370;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-row {
  margin-bottom: 6px;
  display: flex;
  gap: 12px;
  line-height: 1.5;
}

.log-row .time {
  color: #5c6370;
  font-size: 12px;
  min-width: 60px;
}

.log-row .content {
  color: #abb2bf;
  word-break: break-all;
}

.step-tag {
  background: #98c379;
  color: #1e1e1e;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 11px;
  margin-right: 6px;
}

.log-row.info .content { color: #61afef; }
.log-row.warn .content { color: #e5c07b; }
.log-row.error .content { color: #e06c75; }

/* Phone Mockup */
.phone-mockup {
  position: relative;
  width: 320px;
  height: 650px;
  transform-style: preserve-3d;
  transform: rotateY(-5deg) rotateX(5deg);
  transition: transform 0.5s ease;
}

.phone-mockup:hover {
  transform: rotateY(0) rotateX(0);
}

.phone-body {
  width: 100%;
  height: 100%;
  background: #121212;
  border-radius: 48px;
  border: 4px solid #2c2c2c;
  box-shadow: 
    0 0 0 2px #4a4a4a,
    0 20px 50px rgba(0,0,0,0.4),
    inset 0 0 20px rgba(0,0,0,0.8);
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

<template>
  <div class="splash-screen" v-if="isLoading">
    <div class="splash-content">
      <div class="splash-logo">🤖</div>
      <h1 class="splash-title">豆汁手机</h1>
      <div class="splash-slogan">
        <div class="slogan-line">字节有豆包</div>
        <div class="slogan-line">我们有豆汁</div>
        <div class="slogan-line highlight">豆汁助手你值得拥有</div>
      </div>
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  </div>

  <div class="app-container" v-else>
    <el-container class="main-layout">
      <el-header class="app-header">
        <div class="header-content">
          <div class="logo">
            <span class="logo-icon">🤖</span>
            <h1>豆汁手机</h1>
          </div>
          <div class="header-actions">
            <a href="https://www.tongzhilian.cn" target="_blank" class="nav-link team-link">
              <el-icon><UserFilled /></el-icon> 欢迎更多小伙伴加入
            </a>
            <div class="repo-links">
              <a href="https://gitee.com/Lapper/douzhi-phone" target="_blank" class="repo-btn gitee">
                <img src="https://gitee.com/static/images/logo-black.svg" alt="Gitee" />
                <span>国内仓库</span>
              </a>
              <a href="https://github.com/Lappercn/DouZhiPhone" target="_blank" class="repo-btn github">
                <svg height="20" viewBox="0 0 16 16" version="1.1" width="20" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
                <span>国外仓库</span>
              </a>
            </div>
            <el-tag type="success" effect="dark" round class="status-tag">Online</el-tag>
          </div>
        </div>
      </el-header>
      
      <el-main class="app-main">
        <ControlPanel />
      </el-main>

      <el-footer class="app-footer">
        <p>
          © 2025 AI Phone Automation | Powered by 
          <a href="https://www.tongzhilian.cn" target="_blank" class="footer-link">同智联</a>
        </p>
      </el-footer>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import { UserFilled } from '@element-plus/icons-vue'

const isLoading = ref(true)

onMounted(() => {
  // Show splash screen for 5 seconds to allow reading the slogan
  setTimeout(() => {
    isLoading.value = false
  }, 5000)
})
</script>

<style>
/* Splash Screen Styles - Professional & Atmospheric */
.splash-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at 50% 50%, #1a2a40 0%, #0f172a 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
}

/* Subtle background pattern */
.splash-screen::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
}

.splash-content {
  text-align: center;
  position: relative;
  z-index: 1;
}

.splash-logo {
  font-size: 72px;
  margin-bottom: 24px;
  filter: drop-shadow(0 0 30px rgba(64, 158, 255, 0.4));
  animation: logoFloat 3s ease-in-out infinite;
}

.splash-title {
  font-size: 42px;
  color: #ffffff;
  margin: 0 0 48px 0;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  opacity: 0;
  animation: titleReveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.5s forwards;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.splash-slogan {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 60px;
}

.slogan-line {
  font-size: 18px;
  color: #94a3b8;
  font-weight: 300;
  letter-spacing: 1px;
  opacity: 0;
  transform: translateY(15px);
  animation: fadeInUp 1s ease-out forwards;
}

.slogan-line:nth-child(1) { animation-delay: 1.2s; }
.slogan-line:nth-child(2) { animation-delay: 2.0s; }
.slogan-line:nth-child(3) { 
  animation-delay: 3.0s;
  font-size: 28px;
  font-weight: 600;
  margin-top: 16px;
  background: linear-gradient(120deg, #60a5fa, #c084fc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 2px;
  filter: drop-shadow(0 2px 10px rgba(96, 165, 250, 0.3));
}

.loading-dots {
  display: flex;
  justify-content: center;
  gap: 12px;
  opacity: 0;
  animation: fadeIn 0.8s ease-out 4.0s forwards;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: dotPulse 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes logoFloat {
  0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 30px rgba(64, 158, 255, 0.4)); }
  50% { transform: translateY(-10px) scale(1.02); filter: drop-shadow(0 0 40px rgba(64, 158, 255, 0.6)); }
}

@keyframes titleReveal {
  from { opacity: 0; transform: translateY(20px) scale(0.95); filter: blur(10px); }
  to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dotPulse {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 10px rgba(255, 255, 255, 0.5); }
}

:root {
  --primary-color: #409EFF;
  --bg-color: #f0f2f5;
  --header-height: 64px;
}

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg-color);
  color: #303133;
  /* Add subtle background pattern */
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(64, 158, 255, 0.08), transparent 25%),
    radial-gradient(circle at 85% 30%, rgba(54, 209, 220, 0.08), transparent 25%);
  background-attachment: fixed;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-layout {
  min-height: 100vh;
}

.app-header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 1px 0 rgba(0,0,0,0.05);
  height: var(--header-height) !important;
  display: flex;
  align-items: center;
  padding: 0 40px;
  z-index: 100;
  position: sticky;
  top: 0;
  transition: all 0.3s ease;
}

.app-header:hover {
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}

.header-content {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-link {
  text-decoration: none;
  color: #606266;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s;
  font-weight: 500;
}

.nav-link:hover {
  color: var(--primary-color);
}

.repo-links {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 12px;
  padding-right: 12px;
  border-right: 1px solid #e4e7ed;
}

.repo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 16px;
  background: #f5f7fa;
  transition: all 0.2s;
  color: #606266;
  text-decoration: none;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.repo-btn:hover {
  background: #e6e8eb;
  transform: translateY(-1px);
  color: #303133;
}

.repo-btn img {
  width: 20px;
  height: 20px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 32px;
}

.logo h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: -0.5px;
}

.app-main {
  padding: 24px 40px;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.app-footer {
  text-align: center;
  color: #909399;
  font-size: 12px;
  padding: 20px 0;
}

.footer-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.2s;
}

.footer-link:hover {
  opacity: 0.8;
}
</style>

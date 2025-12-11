<template>
  <div class="app-container">
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
import ControlPanel from './components/ControlPanel.vue'
import { UserFilled } from '@element-plus/icons-vue'
</script>

<style>
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
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  height: var(--header-height) !important;
  display: flex;
  align-items: center;
  padding: 0 40px;
  z-index: 100;
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

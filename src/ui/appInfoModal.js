// src/ui/appInfoModal.js
// Modular Modal Component for App Info, Version Checking, Windows Portable Download & Tablet PWA Guide

import { APP_CONFIG } from '../config/appConfig.js';

export class AppInfoModal {
  constructor(options = {}) {
    this.versionManager = options.versionManager;
    this.pwaManager = options.pwaManager;
    this.modalEl = null;

    this._createModalDOM();
    this._bindEvents();
  }

  _createModalDOM() {
    const isPWA = this.pwaManager ? this.pwaManager.isPWAEnvironment() : false;
    const isElectron = this.versionManager ? this.versionManager.isElectron() : false;

    let envBadge = '🌐 웹 브라우저';
    if (isElectron) envBadge = '💻 Windows 전용 실행 모드';
    else if (isPWA) envBadge = '📱 태블릿 홈화면 앱 (PWA)';

    const template = document.createElement('div');
    template.id = 'appInfoModal';
    template.className = 'modal-backdrop';
    template.style.display = 'none';

    template.innerHTML = `
      <div class="modal-card app-info-modal-card">
        <div class="modal-header">
          <div class="app-info-title-group">
            <span class="app-info-logo">🎨</span>
            <div>
              <h3 class="app-info-title">${APP_CONFIG.name}</h3>
              <span class="app-info-env-badge">${envBadge}</span>
            </div>
          </div>
          <button id="btnCloseAppInfoModal" class="btn-modal-close" title="닫기">&times;</button>
        </div>

        <div class="modal-body app-info-body">
          <!-- 1. Version Status Box -->
          <div class="info-section-card version-status-card">
            <div class="version-status-header">
              <div>
                <div class="version-label">현재 실행 버전</div>
                <div class="version-number-display">v${APP_CONFIG.version}</div>
              </div>
              <button id="btnCheckUpdateManual" class="btn btn-secondary btn-check-update">
                <span class="icon">🔄</span> 최신 버전 확인
              </button>
            </div>
            <div id="versionCheckStatusText" class="version-status-text">
              ✨ 최신 버전 체크 준비 완료
            </div>
          </div>

          <!-- 2. Windows Portable Download Section -->
          <div class="info-section-card portable-download-card">
            <div class="section-card-icon">💻</div>
            <div class="section-card-content">
              <h4>윈도우 무설치 버전 (단일 실행 파일)</h4>
              <p>설치 과정 없이 <strong>.exe 파일 하나</strong>만 다운로드하여 USB나 원하는 폴더에서 즉시 실행할 수 있습니다.</p>
              <div class="action-btn-group">
                <button id="btnDownloadPortableExe" class="btn btn-primary btn-download-portable">
                  <span class="icon">⬇️</span> 무설치 파일 다운로드 (RotoSketch Studio.exe)
                </button>
              </div>
            </div>
          </div>

          <!-- 3. Tablet PWA Home Screen Section -->
          <div class="info-section-card tablet-pwa-card">
            <div class="section-card-icon">📱</div>
            <div class="section-card-content">
              <h4>태블릿 홈 화면에 앱 추가하기 (PWA)</h4>
              <p>아이패드, 갤럭시 탭 등의 홈 화면에 앱 아이콘을 추가하면 브라우저 주소창 없이 <strong>전체화면 네이티브 앱</strong>으로 실행됩니다.</p>
              <div class="action-btn-group">
                <button id="btnPromptPWAInstall" class="btn btn-secondary btn-pwa-install">
                  <span class="icon">➕</span> 홈 화면에 앱으로 추가
                </button>
              </div>
              <!-- Guide for iOS / General fallback -->
              <div id="pwaManualGuide" class="pwa-guide-box" style="display: none;">
                <div class="guide-item">
                  <strong>🍎 아이패드 (Safari)</strong>: 브라우저 상단/하단의 <span class="guide-pill">공유(Square with Arrow)</span> 버튼 누른 후 <strong>[홈 화면에 추가]</strong>를 선택하세요.
                </div>
                <div class="guide-item">
                  <strong>🤖 갤럭시 탭 (Chrome)</strong>: 우측 상단 메뉴(⋮) 클릭 후 <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong>를 누르세요.
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Project & Build Details -->
          <div class="app-info-footer-details">
            <span>빌드 일자: ${APP_CONFIG.buildDate}</span>
            <span>&bull;</span>
            <a href="${APP_CONFIG.urls.repositoryUrl}" target="_blank" rel="noopener noreferrer" class="link-github">GitHub 저장소 방문</a>
          </div>
        </div>

        <div class="modal-footer">
          <button id="btnCloseAppInfoModalFooter" class="btn btn-secondary">닫기</button>
        </div>
      </div>
    `;

    document.body.appendChild(template);
    this.modalEl = template;
  }

  _bindEvents() {
    if (!this.modalEl) return;

    const btnClose = this.modalEl.querySelector('#btnCloseAppInfoModal');
    const btnCloseFooter = this.modalEl.querySelector('#btnCloseAppInfoModalFooter');
    const btnCheckUpdate = this.modalEl.querySelector('#btnCheckUpdateManual');
    const statusText = this.modalEl.querySelector('#versionCheckStatusText');
    const btnDownloadPortable = this.modalEl.querySelector('#btnDownloadPortableExe');
    const btnPromptPWA = this.modalEl.querySelector('#btnPromptPWAInstall');
    const pwaGuide = this.modalEl.querySelector('#pwaManualGuide');

    // Close handlers
    const close = () => this.hide();
    if (btnClose) btnClose.addEventListener('click', close);
    if (btnCloseFooter) btnCloseFooter.addEventListener('click', close);

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) close();
    });

    // Check Update Manual Handler
    if (btnCheckUpdate) {
      btnCheckUpdate.addEventListener('click', async () => {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.classList.add('loading');
        statusText.textContent = '⏳ 서버에서 최신 버전을 조회하고 있습니다...';

        try {
          const result = await this.versionManager.checkForUpdates(true);
          if (result.hasUpdate) {
            statusText.innerHTML = `<span style="color:#38bdf8;">🎉 새 버전 <strong>v${result.latestVersion}</strong>이 있습니다!</span>`;
          } else {
            statusText.innerHTML = `<span style="color:#4ade80;">✅ 현재 최신 버전(v${APP_CONFIG.version})을 사용 중입니다.</span>`;
          }
        } catch (err) {
          statusText.textContent = '⚠️ 버전 확인 실패: 인터넷 연결을 확인해 주세요.';
        } finally {
          btnCheckUpdate.disabled = false;
          btnCheckUpdate.classList.remove('loading');
        }
      });
    }

    // Windows Portable Download Handler
    if (btnDownloadPortable) {
      btnDownloadPortable.addEventListener('click', () => {
        const downloadUrl = (this.versionManager.latestMetadata &&
          this.versionManager.latestMetadata.download &&
          this.versionManager.latestMetadata.download.windowsPortable &&
          this.versionManager.latestMetadata.download.windowsPortable.url)
          || APP_CONFIG.urls.windowsPortableDownload;

        this.versionManager.showToast('📥 윈도우 무설치 버전 다운로드를 시작합니다...', 'info');
        window.open(downloadUrl, '_blank');
      });
    }

    // PWA Install Prompt Handler
    if (btnPromptPWA) {
      btnPromptPWA.addEventListener('click', async () => {
        if (!this.pwaManager) return;
        const result = await this.pwaManager.promptInstall();

        if (result.outcome === 'accepted') {
          this.versionManager.showToast('🎉 앱이 기기에 성공적으로 설치되었습니다!', 'success');
          btnPromptPWA.style.display = 'none';
        } else if (result.outcome === 'already_installed') {
          this.versionManager.showToast('✅ 이미 기기에 홈 화면 앱으로 설치되어 있습니다.', 'info');
        } else {
          // Show manual guide box
          pwaGuide.style.display = pwaGuide.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    // Escape Key to Close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl.style.display === 'flex') {
        this.hide();
      }
    });
  }

  show() {
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
    }
  }

  hide() {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
  }
}

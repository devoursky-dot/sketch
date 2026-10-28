// src/versionManager.js
// Automated Version Management & Update Checker for RotoSketch Studio

import { APP_CONFIG } from './config/appConfig.js';

export class VersionManager {
  constructor(options = {}) {
    this.currentVersion = APP_CONFIG.version;
    this.checkIntervalMs = APP_CONFIG.update.checkIntervalMs;
    this.versionCheckEndpoint = APP_CONFIG.urls.versionCheckEndpoint;
    this.onUpdateDetected = options.onUpdateDetected || null;
    this.pwaManager = options.pwaManager || null;

    this.latestMetadata = null;
    this.lastCheckedTime = null;
    this.isChecking = false;
    this.timerId = null;

    this._initToastContainer();
    this._startAutoCheck();
  }

  /**
   * Determine if running inside Electron desktop container
   */
  isElectron() {
    return Boolean(
      (typeof window !== 'undefined' && window.process && window.process.type) ||
      (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0)
    );
  }

  /**
   * Semver comparison: returns 1 if vA > vB, -1 if vA < vB, 0 if equal
   */
  compareVersions(vA, vB) {
    const cleanA = (vA || '').replace(/^[vV]/, '').trim();
    const cleanB = (vB || '').replace(/^[vV]/, '').trim();

    const partsA = cleanA.split('.').map((n) => parseInt(n, 10) || 0);
    const partsB = cleanB.split('.').map((n) => parseInt(n, 10) || 0);

    const maxLength = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLength; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
  }

  /**
   * Check for latest version via remote metadata
   * @param {boolean} isManual - whether triggered manually by user
   * @returns {Promise<{hasUpdate: boolean, latestVersion: string, metadata: object}>}
   */
  async checkForUpdates(isManual = false) {
    if (this.isChecking) return { hasUpdate: false, status: 'already_checking' };
    this.isChecking = true;

    try {
      // Add cache buster query parameter to bypass intermediate caches
      const cacheBusterUrl = `${this.versionCheckEndpoint}?_t=${Date.now()}`;
      const response = await fetch(cacheBusterUrl, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      this.latestMetadata = data;
      this.lastCheckedTime = new Date();

      const latestVer = data.version || this.currentVersion;
      const hasUpdate = this.compareVersions(latestVer, this.currentVersion) > 0;

      if (hasUpdate) {
        this._notifyUpdate(latestVer, data);
      } else if (isManual) {
        this.showToast('✅ 현재 최신 버전(' + this.currentVersion + ')을 사용하고 계십니다.', 'success');
      }

      return {
        hasUpdate,
        latestVersion: latestVer,
        currentVersion: this.currentVersion,
        metadata: data
      };
    } catch (err) {
      console.warn('[VersionManager] Remote version check warning:', err.message);

      // Fallback: Check GitHub Releases API if remote static file fails
      return this._checkGitHubReleasesFallback(isManual);
    } finally {
      this.isChecking = false;
    }
  }

  async _checkGitHubReleasesFallback(isManual) {
    try {
      const ghUrl = `https://api.github.com/repos/${APP_CONFIG.github.owner}/${APP_CONFIG.github.repo}/releases/latest`;
      const ghRes = await fetch(ghUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
      if (ghRes.ok) {
        const release = await ghRes.json();
        const latestTag = (release.tag_name || '').replace(/^[vV]/, '');
        const hasUpdate = this.compareVersions(latestTag, this.currentVersion) > 0;

        if (hasUpdate) {
          const meta = {
            version: latestTag,
            changelog: release.body || '새로운 기능 및 버그 수정이 포함되었습니다.',
            download: {
              windowsPortable: {
                fileName: 'RotoSketch Studio.exe',
                url: release.html_url
              }
            }
          };
          this._notifyUpdate(latestTag, meta);
          return { hasUpdate: true, latestVersion: latestTag, metadata: meta };
        }
      }
    } catch (e) {
      console.warn('[VersionManager] Fallback GitHub check failed:', e);
    }

    if (isManual) {
      this.showToast('ℹ️ 버전 확인 완료: 현재 버전(' + this.currentVersion + ')이 최신 상태입니다.', 'info');
    }
    return { hasUpdate: false, latestVersion: this.currentVersion, metadata: null };
  }

  _notifyUpdate(latestVersion, metadata) {
    if (this.onUpdateDetected) {
      this.onUpdateDetected(latestVersion, metadata);
    }

    if (this.isElectron()) {
      // Electron Windows Portable Mode Toast
      const downloadUrl = (metadata.download && metadata.download.windowsPortable && metadata.download.windowsPortable.url)
        || APP_CONFIG.urls.windowsPortableDownload;

      this.showToastWithAction({
        title: `🚀 새로운 버전 (${latestVersion})이 출시되었습니다!`,
        message: metadata.changelog || '최신 무설치 버전을 다운로드하여 바로 사용하실 수 있습니다.',
        actionText: '💻 최신 무설치 파일 받기',
        onAction: () => {
          window.open(downloadUrl, '_blank');
        }
      });
    } else {
      // Web / Tablet PWA Mode Toast
      this.showToastWithAction({
        title: `✨ 새로운 버전 (${latestVersion})이 업데이트되었습니다!`,
        message: metadata.changelog || '지금 새로고침하면 최신 기능이 즉시 적용됩니다.',
        actionText: '🔄 지금 바로 적용하기',
        onAction: () => {
          if (this.pwaManager) {
            this.pwaManager.applyUpdate();
          } else {
            window.location.reload();
          }
        }
      });
    }
  }

  _startAutoCheck() {
    // Initial check after 3 seconds on startup
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 3000);

    // Periodic check in the background
    this.timerId = setInterval(() => {
      this.checkForUpdates(false);
    }, this.checkIntervalMs);
  }

  _initToastContainer() {
    if (document.getElementById('appToastContainer')) return;
    const container = document.createElement('div');
    container.id = 'appToastContainer';
    container.className = 'app-toast-container';
    document.body.appendChild(container);
  }

  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('appToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `app-toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  showToastWithAction({ title, message, actionText, onAction }) {
    const container = document.getElementById('appToastContainer');
    if (!container) return;

    // Remove existing update toasts to avoid stacking
    const oldToast = container.querySelector('.toast-update-action');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'app-toast toast-update-action';
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-desc">${message}</div>
      </div>
      <div class="toast-btns">
        <button class="toast-action-btn" id="btnToastAction">${actionText}</button>
        <button class="toast-close-btn" id="btnToastClose" title="닫기">&times;</button>
      </div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const actionBtn = toast.querySelector('#btnToastAction');
    const closeBtn = toast.querySelector('#btnToastClose');

    actionBtn.addEventListener('click', () => {
      if (onAction) onAction();
      toast.remove();
    });

    closeBtn.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });
  }

  destroy() {
    if (this.timerId) clearInterval(this.timerId);
  }
}

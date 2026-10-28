// src/pwaManager.js
// PWA (Progressive Web App) Manager for Tablet & Desktop Installation

import { APP_CONFIG } from './config/appConfig.js';

export class PWAManager {
  constructor(options = {}) {
    this.onUpdateFound = options.onUpdateFound || null;
    this.deferredPrompt = null;
    this.isInstalled = this._checkIfInstalled();
    this.swRegistration = null;

    this._init();
  }

  _checkIfInstalled() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  _init() {
    // 1. Listen for PWA Install Prompt Event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[PWA] beforeinstallprompt event captured and ready.');
      window.dispatchEvent(new CustomEvent('pwa-installable', { detail: { installable: true } }));
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
      console.log('[PWA] App successfully installed on device!');
      window.dispatchEvent(new CustomEvent('pwa-installed'));
    });

    // 2. Register Service Worker if supported and running via HTTP/HTTPS
    if ('serviceWorker' in navigator && (window.location.protocol.startsWith('http') || window.location.hostname === 'localhost')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(APP_CONFIG.pwa.serviceWorkerPath)
          .then((reg) => {
            this.swRegistration = reg;
            console.log('[PWA] Service Worker registered with scope:', reg.scope);

            // Listen for waiting service worker (new version ready)
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New version ready for activation.');
                    if (this.onUpdateFound) {
                      this.onUpdateFound(newWorker);
                    }
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration skipped or failed:', err);
          });

        // Ensure refresh is smooth when controller changes
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      });
    }
  }

  /**
   * Prompts user to install PWA on Tablet/Mobile/PC
   * @returns {Promise<{outcome: 'accepted'|'dismissed'|'unsupported'|'ios_guide'}>}
   */
  async promptInstall() {
    if (this.isInstalled) {
      return { outcome: 'already_installed' };
    }

    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        this.deferredPrompt = null;
      }
      return choiceResult;
    }

    // iOS Safari Detection (where beforeinstallprompt is not supported)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      return { outcome: 'ios_guide' };
    }

    return { outcome: 'unsupported' };
  }

  /**
   * Applies latest service worker update immediately
   */
  applyUpdate(worker) {
    const target = worker || (this.swRegistration && this.swRegistration.waiting);
    if (target) {
      target.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }

  isPWAEnvironment() {
    return this.isInstalled;
  }
}

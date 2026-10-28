// src/config/appConfig.js
// Centralized configuration module for RotoSketch Studio
// Eliminates hardcoded magic values and allows easy maintenance

export const APP_CONFIG = {
  name: 'RotoSketch Studio',
  shortName: 'RotoSketch',
  version: '1.0.0',
  buildDate: '2026-10-29',
  description: '스케치북 Pro 역추적 분석 기반 동영상 로토스코핑 & 2D 애니메이션 제작 스튜디오',

  github: {
    owner: 'devoursky-dot',
    repo: 'sketch',
    releaseBaseUrl: 'https://github.com/devoursky-dot/sketch/releases'
  },

  urls: {
    // Relative endpoint for web deployment to fetch latest version metadata
    versionCheckEndpoint: './version.json',
    // Fallback or direct Windows portable binary download link
    windowsPortableDownload: 'https://github.com/devoursky-dot/sketch/releases/latest/download/RotoSketch.Studio.exe',
    // Direct repository link
    repositoryUrl: 'https://github.com/devoursky-dot/sketch'
  },

  update: {
    // Check for updates every 30 minutes in background
    checkIntervalMs: 30 * 60 * 1000,
    // Minimum interval between manual checks (5 seconds debounce)
    manualCheckThrottleMs: 5000
  },

  pwa: {
    serviceWorkerPath: './sw.js',
    manifestPath: './manifest.json'
  }
};

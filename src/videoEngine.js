// videoEngine.js
// Frame-accurate video controller, frame-step, 5-second jump, and thumbnail extraction

export class VideoEngine {
  constructor(options = {}) {
    this.fps = options.fps || 24;
    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.preload = 'auto';
    this.video.playsInline = true;
    this.video.muted = true;

    this.duration = 0;
    this.totalFrames = 0;
    this.currentFrame = 0;
    this.isLoaded = false;
    this.isPlaying = false;
    this.thumbnailCache = new Map(); // frameIndex -> canvas
    this.playbackRate = 1.0;
    this.previewVideo = document.createElement('video');
    this.previewVideo.crossOrigin = 'anonymous';
    this.previewVideo.preload = 'auto';
    this.previewVideo.muted = true;
    this.previewVideo.playsInline = true;
    this.previewVideo.style.position = 'fixed';
    this.previewVideo.style.width = '1px';
    this.previewVideo.style.height = '1px';
    this.previewVideo.style.opacity = '0';
    this.previewVideo.style.pointerEvents = 'none';
    this.previewVideo.style.zIndex = '-9999';
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(this.previewVideo);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', () => {
        if (document.body) document.body.appendChild(this.previewVideo);
      });
    }

    this.onFrameChange = null;
    this.onLoaded = null;
    this.onSeeked = null;

    this._bindEvents();
  }

  _bindEvents() {
    this.video.addEventListener('seeked', () => {
      this.currentFrame = Math.min(
        this.totalFrames - 1,
        Math.max(0, Math.round(this.video.currentTime * this.fps))
      );
      if (this.onSeeked) this.onSeeked(this.currentFrame);
      if (this.onFrameChange) this.onFrameChange(this.currentFrame);
    });

    this.video.addEventListener('timeupdate', () => {
      const calcFrame = Math.round(this.video.currentTime * this.fps);
      if (calcFrame !== this.currentFrame) {
        this.currentFrame = Math.min(this.totalFrames - 1, Math.max(0, calcFrame));
        if (this.onFrameChange) this.onFrameChange(this.currentFrame);
      }
    });

    this.isLoop = true;

    this.video.addEventListener('ended', () => {
      if (this.isLoop) {
        this.video.currentTime = 0;
        this.video.play();
      } else {
        this.isPlaying = false;
      }
    });
  }

  async _resolveDuration(videoEl) {
    if (videoEl.readyState < 1) {
      await new Promise((res) => {
        videoEl.addEventListener('loadedmetadata', res, { once: true });
        setTimeout(res, 600);
      });
    }

    if (videoEl.duration && videoEl.duration !== Infinity && !isNaN(videoEl.duration) && videoEl.duration > 0) {
      return videoEl.duration;
    }

    // Fix for Chrome/Chromium WebM blob duration issue (where duration is reported as Infinity)
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        videoEl.removeEventListener('seeked', finish);
        videoEl.removeEventListener('timeupdate', finish);

        let d = videoEl.duration;
        if (d === Infinity || isNaN(d) || d <= 0) {
          d = videoEl.currentTime > 0 ? videoEl.currentTime : 5.0;
        }
        videoEl.currentTime = 0;
        resolve(d);
      };

      videoEl.addEventListener('seeked', finish, { once: true });
      videoEl.addEventListener('timeupdate', finish, { once: true });
      videoEl.currentTime = 1e101;

      setTimeout(() => {
        if (!done) finish();
      }, 500);
    });
  }

  setFPS(fps) {
    this.fps = fps;
    if (this.isLoaded && this.duration > 0) {
      this.totalFrames = Math.max(1, Math.floor(this.duration * this.fps));
      this.currentFrame = Math.min(this.totalFrames - 1, Math.round(this.video.currentTime * this.fps));
      this.thumbnailCache.clear();
      if (this.onFrameChange) this.onFrameChange(this.currentFrame);
    }
  }

  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.1, Math.min(4.0, parseFloat(rate) || 1.0));
    if (this.video) {
      this.video.playbackRate = this.playbackRate;
    }
    if (this.previewVideo) {
      this.previewVideo.playbackRate = this.playbackRate;
    }
  }

  async loadVideo(sourceUrl) {
    return new Promise((resolve, reject) => {
      this.isLoaded = false;
      this.thumbnailCache.clear();

      const onLoadHandler = async () => {
        this.video.removeEventListener('loadedmetadata', onLoadHandler);

        // Resolve finite duration
        const dur = await this._resolveDuration(this.video);
        this.duration = dur;
        this.totalFrames = Math.max(1, Math.round(this.duration * this.fps));
        this.currentFrame = 0;
        this.isLoaded = true;

        // Setup preview video and wait for loadedmetadata
        this.previewVideo.src = sourceUrl;
        this.previewVideo.load();
        await new Promise((res) => {
          if (this.previewVideo.readyState >= 1) return res();
          this.previewVideo.addEventListener('loadedmetadata', res, { once: true });
          setTimeout(res, 600);
        });

        if (this.onLoaded) {
          this.onLoaded({
            duration: this.duration,
            totalFrames: this.totalFrames,
            width: this.video.videoWidth || 854,
            height: this.video.videoHeight || 480
          });
        }

        resolve();
        setTimeout(() => this.prebakeFilmstripThumbnails(64), 50);
      };

      const onErrorHandler = (e) => {
        this.video.removeEventListener('error', onErrorHandler);
        reject(e);
      };

      this.video.addEventListener('loadedmetadata', onLoadHandler, { once: true });
      this.video.addEventListener('error', onErrorHandler, { once: true });
      this.video.src = sourceUrl;
      this.video.load();
    });
  }

  seekFrame(frameIndex) {
    if (!this.isLoaded) return;
    const clampedFrame = Math.min(this.totalFrames - 1, Math.max(0, frameIndex));
    const targetTime = clampedFrame / this.fps;
    this.video.currentTime = targetTime;
  }

  stepFrame(delta) {
    if (!this.isLoaded) return;
    this.seekFrame(this.currentFrame + delta);
  }

  jumpSeconds(secondsDelta) {
    if (!this.isLoaded) return;
    const targetTime = Math.max(0, Math.min(this.duration, this.video.currentTime + secondsDelta));
    this.video.currentTime = targetTime;
  }

  togglePlay() {
    if (!this.isLoaded) return;
    if (this.video.paused) {
      this.video.playbackRate = this.playbackRate;
      this.video.play();
      this.isPlaying = true;
    } else {
      this.video.pause();
      this.isPlaying = false;
    }
    return this.isPlaying;
  }

  pause() {
    if (this.video && !this.video.paused) {
      this.video.pause();
      this.isPlaying = false;
    }
  }

  drawFrame(ctx, width, height) {
    if (!this.isLoaded || !this.video) return;
    try {
      ctx.drawImage(this.video, 0, 0, width, height);
    } catch (e) {
      console.warn('Video render error:', e);
    }
  }

  /**
   * Synchronously retrieves the nearest available thumbnail from cache.
   * If exact frame is not ready, immediately returns the closest previous/next cached frame
   * to guarantee ZERO flicker and instant hover response!
   */
  getNearestCachedThumbnail(frameIndex, width = 160, height = 90) {
    if (this.thumbnailCache.has(frameIndex)) {
      return this.thumbnailCache.get(frameIndex);
    }

    const cachedKeys = Array.from(this.thumbnailCache.keys());
    if (cachedKeys.length > 0) {
      let nearest = cachedKeys[0];
      let minDist = Math.abs(nearest - frameIndex);
      for (const k of cachedKeys) {
        const d = Math.abs(k - frameIndex);
        if (d < minDist) {
          minDist = d;
          nearest = k;
        }
      }
      return this.thumbnailCache.get(nearest);
    }

    // If cache is completely empty but video element is ready, capture current frame
    if (this.video && this.video.readyState >= 2) {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      c.getContext('2d').drawImage(this.video, 0, 0, width, height);
      this.thumbnailCache.set(this.currentFrame || 0, c);
      return c;
    }

    return null;
  }

  /**
   * Generates or retrieves cached thumbnail for a frame (for hover preview and filmstrip)
   */
  async getFrameThumbnail(frameIndex, width = 160, height = 90) {
    if (this.thumbnailCache.has(frameIndex)) {
      return this.thumbnailCache.get(frameIndex);
    }

    // Capture current frame if main video matches
    if (Math.abs(this.currentFrame - frameIndex) <= 1 && this.video && this.video.readyState >= 2) {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = width;
      thumbCanvas.height = height;
      const tCtx = thumbCanvas.getContext('2d');
      tCtx.drawImage(this.video, 0, 0, width, height);
      this.thumbnailCache.set(frameIndex, thumbCanvas);
      return thumbCanvas;
    }

    // Return nearest cached thumbnail immediately
    const nearest = this.getNearestCachedThumbnail(frameIndex, width, height);
    if (nearest) {
      return nearest;
    }

    return null;
  }

  /**
   * On-demand asynchronous request for the exact frame thumbnail.
   * Uses previewVideo to decode in background without affecting main playback.
   */
  requestExactThumbnail(frameIndex, width = 160, height = 90) {
    if (this.thumbnailCache.has(frameIndex)) {
      return Promise.resolve(this.thumbnailCache.get(frameIndex));
    }
    if (!this.isLoaded || !this.previewVideo) {
      return Promise.resolve(null);
    }

    if (this._isSeekingPreview) {
      this._pendingSeekFrame = frameIndex;
      return Promise.resolve(null);
    }

    this._isSeekingPreview = true;
    const targetTime = frameIndex / this.fps;

    return new Promise((resolve) => {
      let done = false;
      const onSeeked = () => {
        if (done) return;
        done = true;
        this.previewVideo.removeEventListener('seeked', onSeeked);

        if (this.previewVideo.readyState >= 1 && this.previewVideo.videoWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(this.previewVideo, 0, 0, width, height);
          this.thumbnailCache.set(frameIndex, canvas);
          this._isSeekingPreview = false;

          if (this._pendingSeekFrame !== null && this._pendingSeekFrame !== frameIndex) {
            const nextFrame = this._pendingSeekFrame;
            this._pendingSeekFrame = null;
            this.requestExactThumbnail(nextFrame, width, height);
          }
          resolve(canvas);
        } else {
          this._isSeekingPreview = false;
          resolve(null);
        }
      };

      this.previewVideo.addEventListener('seeked', onSeeked, { once: true });
      this.previewVideo.currentTime = targetTime;

      setTimeout(() => {
        if (!done) {
          done = true;
          this.previewVideo.removeEventListener('seeked', onSeeked);
          this._isSeekingPreview = false;
          resolve(null);
        }
      }, 300);
    });
  }

  // Pre-generate thumbnails for timeline filmstrip in the background
  async prebakeFilmstripThumbnails(maxThumbnails = 64, onThumbReady = null) {
    if (!this.isLoaded || this.totalFrames <= 0 || !this.previewVideo) return;
    
    try {
      const total = this.totalFrames;
      const count = Math.min(total, maxThumbnails);
      const step = Math.max(1, Math.floor(total / count));
      const thumbWidth = 160;
      const thumbHeight = 90;

      for (let f = 0; f < total; f += step) {
        if (this.thumbnailCache.has(f)) continue;

        // If user is actively hovering over timeline, pause prebaking to give instant priority
        while (this._isSeekingPreview) {
          await new Promise((r) => setTimeout(r, 100));
        }

        const targetTime = Math.max(0, Math.min(this.duration, f / this.fps));

        await new Promise((res) => {
          let done = false;
          const onSeeked = () => {
            if (!done) { done = true; res(); }
          };
          this.previewVideo.addEventListener('seeked', onSeeked, { once: true });
          this.previewVideo.currentTime = targetTime;
          setTimeout(() => {
            if (!done) { done = true; res(); }
          }, 150);
        });

        if (this.previewVideo.readyState >= 1 && this.previewVideo.videoWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = thumbWidth;
          canvas.height = thumbHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(this.previewVideo, 0, 0, thumbWidth, thumbHeight);

          this.thumbnailCache.set(f, canvas);
          if (onThumbReady) onThumbReady(f, canvas);
        }

        // Small yield so browser UI remains completely responsive
        await new Promise((r) => setTimeout(r, 15));
      }
    } catch (e) {
      console.warn('Prebake thumbnails non-fatal error:', e);
    }
  }
}

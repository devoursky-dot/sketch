// keyframeEngine.js
// Keyframe management, Onion Skinning, Animation Playback loop, and History stack

export class KeyframeEngine {
  constructor(canvasWidth = 854, canvasHeight = 480) {
    this.width = canvasWidth;
    this.height = canvasHeight;

    // frameIndex -> HTMLCanvasElement
    this.keyframes = new Map();

    // Onion Skin settings
    this.onionSkinEnabled = true;
    this.onionPrevCount = 1;
    this.onionNextCount = 1;
    this.onionOpacity = 0.35;

    // Animation playback state
    this.isAnimPlaying = false;
    this.animFps = 24;
    this.animTimer = null;
    this.currentAnimFrame = 0;
    this.animLoop = true;
    this.hideVideoDuringAnim = false;

    // History stack for Undo/Redo: { frameIndex, beforeData, afterData }
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 30;

    // Hold Drawing (Exposure): Keep drawing visible until next keyframe is reached
    this.holdDrawing = true;

    this.onKeyframeListChanged = null;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    // Resize existing keyframe canvases while keeping content
    for (const [idx, canvas] of this.keyframes.entries()) {
      const temp = document.createElement('canvas');
      temp.width = canvas.width;
      temp.height = canvas.height;
      temp.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(temp, 0, 0, width, height);
    }
  }

  setHoldDrawing(enabled) {
    this.holdDrawing = !!enabled;
  }

  hasKeyframe(frameIndex) {
    return this.keyframes.has(frameIndex);
  }

  /**
   * Retrieves the drawing canvas strictly for the specified frame during editing/scrubbing.
   * If the frame has no keyframe, returns null so the canvas remains completely blank!
   */
  getDrawingForEdit(frameIndex) {
    if (this.keyframes.has(frameIndex)) {
      return this.keyframes.get(frameIndex);
    }
    return null;
  }

  /**
   * Retrieves drawing canvas for continuous video or animation playback.
   * If hold is true, holds the nearest preceding drawing so the animation does not vanish instantly.
   */
  getDrawingForPlayback(frameIndex, hold = true) {
    if (this.keyframes.has(frameIndex)) {
      return this.keyframes.get(frameIndex);
    }

    if (hold) {
      const indices = this.getKeyframeIndices().filter(i => i <= frameIndex);
      if (indices.length > 0) {
        return this.keyframes.get(indices[indices.length - 1]);
      }
      // Fallback if before first keyframe: show first keyframe so there is never a blank flash
      const all = this.getKeyframeIndices();
      if (all.length > 0) {
        return this.keyframes.get(all[0]);
      }
    }

    return null;
  }

  getKeyframe(frameIndex, createIfAbsent = false) {
    if (this.keyframes.has(frameIndex)) {
      return this.keyframes.get(frameIndex);
    }

    if (createIfAbsent) {
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      this.keyframes.set(frameIndex, canvas);
      if (this.onKeyframeListChanged) this.onKeyframeListChanged(this.getKeyframeIndices());
      return canvas;
    }

    return null;
  }

  saveSnapshotForUndo(frameIndex, currentCanvas) {
    const ctx = currentCanvas.getContext('2d');
    const snapshot = ctx.getImageData(0, 0, this.width, this.height);
    this.undoStack.push({ frameIndex, snapshot });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // clear redo on new action
  }

  undo(currentFrameIndex, drawingCanvas) {
    if (this.undoStack.length === 0) return false;

    // Find the most recent action for this frame or top of stack
    const action = this.undoStack.pop();
    const ctx = drawingCanvas.getContext('2d');

    // Save current state to redo
    const currentData = ctx.getImageData(0, 0, this.width, this.height);
    this.redoStack.push({ frameIndex: action.frameIndex, snapshot: currentData });

    ctx.putImageData(action.snapshot, 0, 0);

    // Sync back to stored keyframe canvas
    const kf = this.getKeyframe(action.frameIndex, true);
    kf.getContext('2d').putImageData(action.snapshot, 0, 0);

    return true;
  }

  redo(currentFrameIndex, drawingCanvas) {
    if (this.redoStack.length === 0) return false;

    const action = this.redoStack.pop();
    const ctx = drawingCanvas.getContext('2d');

    const currentData = ctx.getImageData(0, 0, this.width, this.height);
    this.undoStack.push({ frameIndex: action.frameIndex, snapshot: currentData });

    ctx.putImageData(action.snapshot, 0, 0);

    const kf = this.getKeyframe(action.frameIndex, true);
    kf.getContext('2d').putImageData(action.snapshot, 0, 0);

    return true;
  }

  deleteKeyframe(frameIndex) {
    const existed = this.keyframes.delete(frameIndex);
    if (existed && this.onKeyframeListChanged) {
      this.onKeyframeListChanged(this.getKeyframeIndices());
    }
    return existed;
  }

  deleteFrames(frameIndices = []) {
    let changed = false;
    for (const f of frameIndices) {
      if (this.keyframes.delete(f)) {
        changed = true;
      }
    }
    if (changed && this.onKeyframeListChanged) {
      this.onKeyframeListChanged(this.getKeyframeIndices());
    }
    return changed;
  }

  clearKeyframe(frameIndex, drawingCanvas) {
    if (this.keyframes.has(frameIndex)) {
      const kf = this.keyframes.get(frameIndex);
      kf.getContext('2d').clearRect(0, 0, this.width, this.height);
    }
    if (drawingCanvas) {
      drawingCanvas.getContext('2d').clearRect(0, 0, this.width, this.height);
    }
  }

  getKeyframeIndices() {
    return Array.from(this.keyframes.keys()).sort((a, b) => a - b);
  }

  /**
   * Renders Onion Skinning onto the onionCanvas:
   * Previous frame drawn in tinted cyan/red, Next frame drawn in tinted green
   */
  renderOnionSkin(onionCtx, currentFrameIndex) {
    onionCtx.clearRect(0, 0, this.width, this.height);
    if (!this.onionSkinEnabled) return;

    const indices = this.getKeyframeIndices();
    if (indices.length === 0) return;

    // Find previous keyframe index
    const prevIndices = indices.filter(i => i < currentFrameIndex);
    const prevIdx = prevIndices.length > 0 ? prevIndices[prevIndices.length - 1] : null;

    // Find next keyframe index
    const nextIndices = indices.filter(i => i > currentFrameIndex);
    const nextIdx = nextIndices.length > 0 ? nextIndices[0] : null;

    // Draw Previous Keyframe (Red / Coral Ghost Tint)
    if (prevIdx !== null && this.keyframes.has(prevIdx)) {
      this._drawTintedGhost(onionCtx, this.keyframes.get(prevIdx), '#f43f5e', this.onionOpacity);
    }

    // Draw Next Keyframe (Green / Mint Ghost Tint)
    if (nextIdx !== null && this.keyframes.has(nextIdx)) {
      this._drawTintedGhost(onionCtx, this.keyframes.get(nextIdx), '#10b981', this.onionOpacity * 0.9);
    }
  }

  _drawTintedGhost(targetCtx, sourceCanvas, tintColor, alpha) {
    targetCtx.save();
    targetCtx.globalAlpha = alpha;

    // Use offscreen canvas to tint pixels
    const ghost = document.createElement('canvas');
    ghost.width = this.width;
    ghost.height = this.height;
    const gCtx = ghost.getContext('2d');

    // 1. Draw source graphics
    gCtx.drawImage(sourceCanvas, 0, 0);

    // 2. Tint using source-in composite
    gCtx.globalCompositeOperation = 'source-in';
    gCtx.fillStyle = tintColor;
    gCtx.fillRect(0, 0, this.width, this.height);

    // 3. Render ghost into target canvas
    targetCtx.drawImage(ghost, 0, 0);
    targetCtx.restore();
  }

  /**
   * Start animation playback loop through specified frame range [startFrame, endFrame] with speed multiplier
   */
  startAnimation(startFrame = 0, endFrame = 100, onTick = null, fps = 24, speed = 1.0) {
    this.stopAnimation();
    this.isAnimPlaying = true;
    this.animFps = fps;

    const effectiveFps = Math.max(1, fps * speed);
    const interval = 1000 / effectiveFps;
    let lastTime = performance.now();

    this.currentAnimFrame = startFrame;
    if (onTick) onTick(this.currentAnimFrame);

    const loop = (currentTime) => {
      if (!this.isAnimPlaying) return;

      if (currentTime - lastTime >= interval) {
        lastTime = currentTime - ((currentTime - lastTime) % interval);
        this.currentAnimFrame++;
        if (this.currentAnimFrame > endFrame) {
          if (this.animLoop) {
            this.currentAnimFrame = startFrame;
          } else {
            this.stopAnimation();
            return;
          }
        }
        if (onTick) onTick(this.currentAnimFrame);
      }

      this.animTimer = requestAnimationFrame(loop);
    };

    this.animTimer = requestAnimationFrame(loop);
  }

  /**
   * Start sequential animation through a custom array of frames (e.g. all strips skipping blank video gaps)
   */
  startSequenceAnimation(sequence = [], onTick = null, fps = 24, speed = 1.0) {
    this.stopAnimation();
    if (!sequence || sequence.length === 0) return false;

    this.isAnimPlaying = true;
    this.animFps = fps;
    let seqIndex = 0;

    const effectiveFps = Math.max(1, fps * speed);
    const interval = 1000 / effectiveFps;
    let lastTime = performance.now();

    this.currentAnimFrame = sequence[seqIndex];
    if (onTick) onTick(this.currentAnimFrame);

    const loop = (currentTime) => {
      if (!this.isAnimPlaying) return;

      if (currentTime - lastTime >= interval) {
        lastTime = currentTime - ((currentTime - lastTime) % interval);
        seqIndex++;
        if (seqIndex >= sequence.length) {
          if (this.animLoop) {
            seqIndex = 0;
          } else {
            this.stopAnimation();
            return;
          }
        }
        this.currentAnimFrame = sequence[seqIndex];
        if (onTick) onTick(this.currentAnimFrame);
      }

      this.animTimer = requestAnimationFrame(loop);
    };

    this.animTimer = requestAnimationFrame(loop);
    return true;
  }

  /**
   * Start Flipbook loop ONLY through frames that have drawings, with speed multiplier
   */
  startKeyframeOnlyPlayback(onTick, fps = 12, speed = 1.0) {
    this.stopAnimation();
    const indices = this.getKeyframeIndices();
    if (indices.length === 0) return false;

    this.isAnimPlaying = true;
    this.animFps = fps;
    let stepIndex = 0;

    const effectiveFps = Math.max(1, fps * speed);
    const interval = 1000 / effectiveFps;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      if (!this.isAnimPlaying) return;

      if (currentTime - lastTime >= interval) {
        lastTime = currentTime - ((currentTime - lastTime) % interval);
        const targetFrame = indices[stepIndex];
        if (onTick) onTick(targetFrame);
        stepIndex = (stepIndex + 1) % indices.length;
      }

      this.animTimer = requestAnimationFrame(loop);
    };

    this.animTimer = requestAnimationFrame(loop);
    return true;
  }

  stopAnimation() {
    this.isAnimPlaying = false;
    if (this.animTimer) {
      cancelAnimationFrame(this.animTimer);
      this.animTimer = null;
    }
  }
}

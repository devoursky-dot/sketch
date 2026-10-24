// viewportEngine.js
// Canvas Zoom (up to 3.0x), Pan, Fit-to-Screen, and Coordinate Transformation Engine

export class ViewportEngine {
  constructor(canvasStackElement, stageViewportElement) {
    this.canvasStack = canvasStackElement;
    this.stageViewport = stageViewportElement;

    // Viewport transformation states
    this.zoom = 1.0;     // 0.5x (50%) to 3.0x (300%)
    this.minZoom = 0.5;
    this.maxZoom = 3.0;
    this.panX = 0;       // Horizontal pixel offset
    this.panY = 0;       // Vertical pixel offset

    // Drag interaction tracking
    this.isDragging = false;
    this.dragMode = null; // 'pan' | 'zoom' | null
    this.startClientX = 0;
    this.startClientY = 0;
    this.initialPanX = 0;
    this.initialPanY = 0;
    this.initialZoom = 1.0;
    this.dragDistance = 0;

    // Callbacks
    this.onTransformChange = null;

    this.applyTransform();
  }

  setZoom(newZoom, smooth = false) {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, parseFloat(newZoom)));
    this.zoom = Math.round(clamped * 100) / 100;
    this.applyTransform(smooth);
    if (this.onTransformChange) {
      this.onTransformChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
    }
    return this.zoom;
  }

  setPan(x, y, smooth = false) {
    this.panX = Math.round(x);
    this.panY = Math.round(y);
    this.applyTransform(smooth);
    if (this.onTransformChange) {
      this.onTransformChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
    }
  }

  zoomBy(delta, smooth = false) {
    return this.setZoom(this.zoom + delta, smooth);
  }

  resetView(smooth = true) {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform(smooth);
    if (this.onTransformChange) {
      this.onTransformChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
    }
  }

  applyTransform(smooth = false) {
    if (!this.canvasStack) return;

    if (smooth) {
      this.canvasStack.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
      this.canvasStack.style.transition = 'none';
    }

    this.canvasStack.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.canvasStack.style.transformOrigin = 'center center';
  }

  getZoomPercent() {
    return `${Math.round(this.zoom * 100)}%`;
  }
}

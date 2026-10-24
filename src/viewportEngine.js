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

    // Track mouse position over viewport for mouse-centered zooming
    this.lastPointerX = null;
    this.lastPointerY = null;
    if (this.stageViewport) {
      this.stageViewport.addEventListener('pointermove', (e) => {
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      });
    }

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
    if (this.lastPointerX !== null && this.lastPointerY !== null) {
      return this.zoomAt(this.lastPointerX, this.lastPointerY, newZoom, smooth);
    }
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, parseFloat(newZoom)));
    this.zoom = Math.round(clamped * 100) / 100;
    this.applyTransform(smooth);
    if (this.onTransformChange) {
      this.onTransformChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
    }
    return this.zoom;
  }

  zoomAt(clientX, clientY, newZoom, smooth = false) {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, parseFloat(newZoom)));
    const targetZoom = Math.round(clamped * 100) / 100;

    if (!this.stageViewport || this.zoom === targetZoom) {
      this.zoom = targetZoom;
      this.applyTransform(smooth);
      if (this.onTransformChange) {
        this.onTransformChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
      }
      return this.zoom;
    }

    const vpRect = this.stageViewport.getBoundingClientRect();
    const centerX = vpRect.left + vpRect.width / 2;
    const centerY = vpRect.top + vpRect.height / 2;

    const vx = clientX - centerX;
    const vy = clientY - centerY;

    const ratio = targetZoom / this.zoom;
    this.panX = Math.round(vx - (vx - this.panX) * ratio);
    this.panY = Math.round(vy - (vy - this.panY) * ratio);
    this.zoom = targetZoom;

    this.applyTransform(smooth);
    if (this.onTransformChange) {
      this.onTransformChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
    }
    return this.zoom;
  }

  zoomByAt(clientX, clientY, delta, smooth = false) {
    return this.zoomAt(clientX, clientY, this.zoom + delta, smooth);
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
    if (this.lastPointerX !== null && this.lastPointerY !== null) {
      return this.zoomByAt(this.lastPointerX, this.lastPointerY, delta, smooth);
    }
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

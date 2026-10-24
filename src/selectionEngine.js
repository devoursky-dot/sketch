// selectionEngine.js
// SketchBook Pro inspired Lasso Selection & Masking Engine:
// 1. Freehand closed polygon path tracing (AVTpLassoSelect)
// 2. Continuous Marching Ants animated boundary rendering
// 3. Selection Bounding Box & Polygon Point-in-Polygon testing
// 4. Extraction of selected pixel data into an isolated floating buffer

export class SelectionEngine {
  constructor() {
    this.isActive = false; // Is a selection currently active
    this.isSelecting = false; // Is the user actively dragging the lasso
    this.points = []; // [{x, y}]
    this.bounds = null; // { minX, minY, maxX, maxY, width, height, cx, cy }
    this.marchingOffset = 0;
    this.floatingBuffer = null; // Offscreen canvas holding the extracted selection
    this.originalCanvasSnapshot = null; // Snapshot before cut
  }

  startSelection(x, y) {
    this.isSelecting = true;
    this.isActive = false;
    this.points = [{ x, y }];
    this.bounds = null;
    this.floatingBuffer = null;
  }

  continueSelection(x, y) {
    if (!this.isSelecting) return;
    const last = this.points[this.points.length - 1];
    const dist = Math.hypot(x - last.x, y - last.y);
    if (dist > 3) {
      this.points.push({ x, y });
    }
  }

  endSelection() {
    if (!this.isSelecting) return false;
    this.isSelecting = false;

    if (this.points.length < 3) {
      this.clear();
      return false;
    }

    // Auto-close polygon
    this.points.push({ x: this.points[0].x, y: this.points[0].y });
    this._calculateBounds();

    if (this.bounds.width < 4 || this.bounds.height < 4) {
      this.clear();
      return false;
    }

    this.isActive = true;
    return true;
  }

  _calculateBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);
    this.bounds = {
      minX,
      minY,
      maxX,
      maxY,
      width,
      height,
      cx: minX + width / 2,
      cy: minY + height / 2
    };
  }

  clear() {
    this.isActive = false;
    this.isSelecting = false;
    this.points = [];
    this.bounds = null;
    this.floatingBuffer = null;
    this.originalCanvasSnapshot = null;
  }

  containsPoint(px, py) {
    if (!this.isActive || !this.bounds) return false;
    // Fast AABB check first
    if (px < this.bounds.minX || px > this.bounds.maxX || py < this.bounds.minY || py > this.bounds.maxY) {
      return false;
    }

    // Ray-casting algorithm for point in polygon
    let inside = false;
    for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
      const xi = this.points[i].x, yi = this.points[i].y;
      const xj = this.points[j].x, yj = this.points[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Cuts or extracts the selected pixels from the source canvas into an isolated floating buffer
   */
  extractFromCanvas(sourceCanvas, clearOriginal = true) {
    if (!this.isActive || !this.bounds || this.bounds.width <= 0 || this.bounds.height <= 0) return null;

    const { minX, minY, width, height } = this.bounds;
    const sCtx = sourceCanvas.getContext('2d');

    // 1. Save original state in case of cancel
    this.originalCanvasSnapshot = sCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

    // 2. Create offscreen canvas for extracted graphic
    const buffer = document.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    const bCtx = buffer.getContext('2d');

    // Clip to the lasso polygon shifted to buffer origin (0, 0)
    bCtx.save();
    bCtx.beginPath();
    bCtx.moveTo(this.points[0].x - minX, this.points[0].y - minY);
    for (let i = 1; i < this.points.length; i++) {
      bCtx.lineTo(this.points[i].x - minX, this.points[i].y - minY);
    }
    bCtx.closePath();
    bCtx.clip();

    // Draw the source canvas slice
    bCtx.drawImage(sourceCanvas, -minX, -minY);
    bCtx.restore();

    // 3. Clear those pixels from the source canvas
    if (clearOriginal) {
      sCtx.save();
      sCtx.beginPath();
      sCtx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        sCtx.lineTo(this.points[i].x, this.points[i].y);
      }
      sCtx.closePath();
      sCtx.globalCompositeOperation = 'destination-out';
      sCtx.fillStyle = 'rgba(0,0,0,1)';
      sCtx.fill();
      sCtx.restore();
    }

    this.floatingBuffer = buffer;
    return buffer;
  }

  /**
   * Restores source canvas snapshot if transform is cancelled
   */
  restoreSource(sourceCanvas) {
    if (this.originalCanvasSnapshot) {
      const sCtx = sourceCanvas.getContext('2d');
      sCtx.putImageData(this.originalCanvasSnapshot, 0, 0);
      this.originalCanvasSnapshot = null;
    }
  }

  /**
   * Renders the marching ants animated outline on the overlay canvas
   */
  renderMarchingAnts(ctx) {
    if (this.points.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    if (this.isActive) {
      ctx.closePath();
    }

    // Step the marching ants offset
    this.marchingOffset = (this.marchingOffset + 0.6) % 12;

    // Dual pass for high visibility on any background
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -this.marchingOffset;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    ctx.lineDashOffset = -(this.marchingOffset + 6);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }
}

// brushEngine.js
// Advanced Wacom Stylus & SketchBook Pro Inking Engine
// 1. Hardware Wacom Pressure Response Curve & Smoothness (SID_PRESSURE_HARDNESS / SMOOTHNESS)
// 2. 3-Level Hand Jitter Stabilizer (Level 1: Natural, Level 2: Steady, Level 3: Ultra Rope)
// 3. Continuous Variable-Width Ribbon & Circle interpolation for seamless pressure swelling/tapering

export class BrushEngine {
  constructor() {
    this.tool = 'brush'; // 'brush' | 'eraser'
    this.color = '#38bdf8';
    this.size = 8;
    this.opacity = 1.0;

    // 3 Stabilizer Levels: 0 (Off), 1 (Natural), 2 (Steady Inking), 3 (Ultra Rope)
    this.stabilizerLevel = 2; // Default to Level 2 (Steady)

    // Wacom Pressure Calibration Settings
    this.pressureThreshold = 0.02; // Deadzone to ignore accidental feather touches
    this.pressureHardness = 0.85;  // Non-linear gamma curve for expressive touch
    this.pressureSmoothness = 0.35; // Exponential smoothing on pressure values
    this.smoothedPressure = 0.5;

    // Drawing state
    this.isDrawing = false;
    this.points = []; // [{x, y, w, p, a}]
    this.currentPos = { x: 0, y: 0 };
    this.targetPos = { x: 0, y: 0 };
    this.lastRenderPoint = null;

    // Callbacks
    this.onStrokeStart = null;
    this.onStrokeEnd = null;
    this.onPressureChange = null; // (p, width) -> for UI pressure meter
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(hex) {
    this.color = hex;
  }

  setSize(size) {
    this.size = Math.max(1, Math.min(100, size));
  }

  setOpacity(val) {
    this.opacity = Math.max(0.05, Math.min(1.0, val));
  }

  setStabilizerLevel(level) {
    this.stabilizerLevel = Math.max(0, Math.min(3, parseInt(level, 10)));
  }

  /**
   * Calibrates raw hardware stylus pressure using SketchBook Pro response dynamics
   */
  calibratePressure(rawPressure, pointerType = 'pen') {
    if (pointerType === 'mouse') {
      // If using mouse, return simulated moderate pressure
      return 0.7;
    }

    if (rawPressure === undefined || rawPressure === null || isNaN(rawPressure)) {
      return 0.5;
    }

    // Deadzone threshold
    if (rawPressure < this.pressureThreshold) {
      return 0.05;
    }

    // Non-linear response curve: p^gamma
    const normalized = (rawPressure - this.pressureThreshold) / (1.0 - this.pressureThreshold);
    const curved = Math.pow(Math.max(0, Math.min(1, normalized)), this.pressureHardness);

    // Exponential smoothing across consecutive pressure events
    this.smoothedPressure = this.smoothedPressure * (1.0 - this.pressureSmoothness) + curved * this.pressureSmoothness;
    return this.smoothedPressure;
  }

  calculateWidth(pressure) {
    // Dynamic width: hairline thin (8% of base size) at lightest touch up to 100% at full press
    const minRatio = 0.08;
    const factor = minRatio + (1.0 - minRatio) * pressure;
    return Math.max(0.8, this.size * factor);
  }

  startStroke(ctx, x, y, rawPressure = 0.5, pointerType = 'pen') {
    this.isDrawing = true;
    this.smoothedPressure = (rawPressure > 0.05) ? rawPressure : 0.4;
    const p = this.calibratePressure(rawPressure, pointerType);
    const width = this.calculateWidth(p);

    this.currentPos = { x, y };
    this.targetPos = { x, y };
    this.points = [{ x, y, w: width, p }];
    this.lastRenderPoint = { x, y, w: width, p };

    // Draw initial dot with anti-aliasing
    ctx.save();
    this._applyComposite(ctx, p);
    ctx.beginPath();
    ctx.arc(x, y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.onPressureChange) this.onPressureChange(p, width);
    if (this.onStrokeStart) this.onStrokeStart();
  }

  continueStroke(ctx, x, y, rawPressure = 0.5, pointerType = 'pen') {
    if (!this.isDrawing) return;

    this.targetPos = { x, y };
    const p = this.calibratePressure(rawPressure, pointerType);
    const width = this.calculateWidth(p);

    if (this.onPressureChange) this.onPressureChange(p, width);

    // Apply 3-Level Stabilizer
    // Level 0: Direct (raw coordinates)
    // Level 1: Natural (fast response, light smoothing)
    // Level 2: Steady Inking (standard inking stabilizer, clean curves)
    // Level 3: Ultra Rope (heavy pull-string leash, eliminates all tremor)
    if (this.stabilizerLevel === 0) {
      this.currentPos = { x, y };
    } else if (this.stabilizerLevel === 1) {
      const follow = 0.80;
      this.currentPos.x += (this.targetPos.x - this.currentPos.x) * follow;
      this.currentPos.y += (this.targetPos.y - this.currentPos.y) * follow;
    } else if (this.stabilizerLevel === 2) {
      const follow = 0.48;
      this.currentPos.x += (this.targetPos.x - this.currentPos.x) * follow;
      this.currentPos.y += (this.targetPos.y - this.currentPos.y) * follow;
    } else if (this.stabilizerLevel === 3) {
      // Ultra Rope Stabilizer with leash deadzone
      const dx = this.targetPos.x - this.currentPos.x;
      const dy = this.targetPos.y - this.currentPos.y;
      const dist = Math.hypot(dx, dy);
      const ropeLength = 12; // Virtual string length
      if (dist > ropeLength) {
        const angle = Math.atan2(dy, dx);
        const pullX = this.targetPos.x - Math.cos(angle) * ropeLength;
        const pullY = this.targetPos.y - Math.sin(angle) * ropeLength;
        this.currentPos.x += (pullX - this.currentPos.x) * 0.35;
        this.currentPos.y += (pullY - this.currentPos.y) * 0.35;
      }
    }

    const last = this.points[this.points.length - 1];
    const dist = Math.hypot(this.currentPos.x - last.x, this.currentPos.y - last.y);

    // Spacing threshold based on brush size
    const minDistance = this.stabilizerLevel === 0 ? 0.8 : (this.stabilizerLevel === 3 ? 3.0 : 1.5);
    if (dist < minDistance) return;

    const newPt = {
      x: this.currentPos.x,
      y: this.currentPos.y,
      w: width,
      p
    };
    this.points.push(newPt);

    // Render continuous variable-width ribbon between points
    this._renderRibbonTo(ctx, newPt);
  }

  endStroke(ctx) {
    if (!this.isDrawing) return;

    // Connect final residual gap if any
    if (this.lastRenderPoint && (this.stabilizerLevel > 0)) {
      const finalPt = {
        x: this.targetPos.x,
        y: this.targetPos.y,
        w: this.calculateWidth(this.smoothedPressure * 0.8),
        p: this.smoothedPressure * 0.8
      };
      this._renderRibbonTo(ctx, finalPt);
    }

    this.isDrawing = false;
    this.points = [];
    this.lastRenderPoint = null;

    if (this.onPressureChange) this.onPressureChange(0, 0);
    if (this.onStrokeEnd) this.onStrokeEnd();
  }

  _applyComposite(ctx, pressure = 1.0) {
    if (this.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      // Subtle opacity modulation by pressure
      const dynamicAlpha = this.opacity * (0.35 + 0.65 * pressure);
      ctx.globalAlpha = Math.min(1.0, Math.max(0.1, dynamicAlpha));
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
    }
  }

  /**
   * Renders a continuous variable-width quadrilateral ribbon and circle cap
   * between the last rendered point and current point
   */
  _renderRibbonTo(ctx, curr) {
    const prev = this.lastRenderPoint;
    if (!prev) {
      this.lastRenderPoint = curr;
      return;
    }

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.2) return;

    // Normal vector perpendicular to stroke direction
    const nx = -dy / dist;
    const ny = dx / dist;

    const r0 = prev.w / 2;
    const r1 = curr.w / 2;

    // 4 Quad vertices
    const x0A = prev.x + nx * r0;
    const y0A = prev.y + ny * r0;
    const x0B = prev.x - nx * r0;
    const y0B = prev.y - ny * r0;

    const x1A = curr.x + nx * r1;
    const y1A = curr.y + ny * r1;
    const x1B = curr.x - nx * r1;
    const y1B = curr.y - ny * r1;

    ctx.save();
    this._applyComposite(ctx, (prev.p + curr.p) / 2);

    // 1. Draw connecting trapezoidal quad
    ctx.beginPath();
    ctx.moveTo(x0A, y0A);
    ctx.lineTo(x1A, y1A);
    ctx.lineTo(x1B, y1B);
    ctx.lineTo(x0B, y0B);
    ctx.closePath();
    ctx.fill();

    // 2. Draw round cap at destination point
    ctx.beginPath();
    ctx.arc(curr.x, curr.y, r1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    this.lastRenderPoint = curr;
  }
}

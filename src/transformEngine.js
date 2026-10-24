// transformEngine.js
// SketchBook Pro inspired Transform Manipulator & Gizmo Engine:
// 1. Affine Transformation Matrix (Translate, Scale, Rotate)
// 2. 8 Scale Handles + Rotation Arm Handle + Move Dragging
// 3. Inverse-Matrix Hit-Testing
// 4. Live Bilinear Render Preview & Final Layer Baking

export class TransformEngine {
  constructor() {
    this.isActive = false;
    this.buffer = null; // Canvas containing extracted selected graphics
    
    // Transform coordinates (relative to selection center)
    this.cx = 0;
    this.cy = 0;
    this.width = 0;
    this.height = 0;

    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0; // In radians

    // Drag interaction state
    this.activeHandle = null; // 'move' | 'rot' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
    this.dragStart = { x: 0, y: 0 };
    this.initialTransform = null;

    this.handleRadius = 6;
    this.rotArmLength = 28;

    this.onTransformChanged = null;
  }

  startTransform(bufferCanvas, bounds) {
    if (!bufferCanvas || !bounds) return;

    this.isActive = true;
    this.buffer = bufferCanvas;
    this.width = bounds.width;
    this.height = bounds.height;
    this.cx = bounds.cx;
    this.cy = bounds.cy;

    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0;
    this.activeHandle = null;
  }

  stopTransform() {
    this.isActive = false;
    this.buffer = null;
    this.activeHandle = null;
  }

  /**
   * Transforms a point from screen coordinates to local transformed object coordinates
   */
  toLocalSpace(px, py) {
    const centerScreenX = this.cx + this.translateX;
    const centerScreenY = this.cy + this.translateY;

    const dx = px - centerScreenX;
    const dy = py - centerScreenY;

    // Inverse rotation
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const unrotatedX = dx * cos - dy * sin;
    const unrotatedY = dx * sin + dy * cos;

    // Inverse scale
    const localX = unrotatedX / (this.scaleX || 0.0001);
    const localY = unrotatedY / (this.scaleY || 0.0001);

    return { localX, localY, unrotatedX, unrotatedY };
  }

  /**
   * Transforms local unscaled coordinates to screen coordinates
   */
  toScreenSpace(localX, localY) {
    const scaledX = localX * this.scaleX;
    const scaledY = localY * this.scaleY;

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rotX = scaledX * cos - scaledY * sin;
    const rotY = scaledX * sin + scaledY * cos;

    return {
      x: this.cx + this.translateX + rotX,
      y: this.cy + this.translateY + rotY
    };
  }

  hitTest(px, py) {
    if (!this.isActive) return null;

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    // 1. Test Rotation Handle (in screen space)
    const rotHandleScreen = this.toScreenSpace(0, -halfH - (this.rotArmLength / Math.abs(this.scaleY || 1)));
    if (Math.hypot(px - rotHandleScreen.x, py - rotHandleScreen.y) <= this.handleRadius + 4) {
      return 'rot';
    }

    // 2. Test 8 Corner & Edge Handles
    const handles = [
      { id: 'nw', lx: -halfW, ly: -halfH },
      { id: 'n',  lx: 0,     ly: -halfH },
      { id: 'ne', lx: halfW,  ly: -halfH },
      { id: 'e',  lx: halfW,  ly: 0 },
      { id: 'se', lx: halfW,  ly: halfH },
      { id: 's',  lx: 0,     ly: halfH },
      { id: 'sw', lx: -halfW, ly: halfH },
      { id: 'w',  lx: -halfW, ly: 0 },
    ];

    for (const h of handles) {
      const sp = this.toScreenSpace(h.lx, h.ly);
      if (Math.hypot(px - sp.x, py - sp.y) <= this.handleRadius + 3) {
        return h.id;
      }
    }

    // 3. Test Body for Move
    const { localX, localY } = this.toLocalSpace(px, py);
    if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
      return 'move';
    }

    return null;
  }

  handlePointerDown(px, py) {
    const handle = this.hitTest(px, py);
    if (!handle) return false;

    this.activeHandle = handle;
    this.dragStart = { x: px, y: py };
    this.initialTransform = {
      translateX: this.translateX,
      translateY: this.translateY,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      rotation: this.rotation,
      cx: this.cx,
      cy: this.cy
    };
    return true;
  }

  handlePointerMove(px, py) {
    if (!this.isActive || !this.activeHandle) return;

    const dx = px - this.dragStart.x;
    const dy = py - this.dragStart.y;
    const init = this.initialTransform;

    if (this.activeHandle === 'move') {
      this.translateX = init.translateX + dx;
      this.translateY = init.translateY + dy;
    } else if (this.activeHandle === 'rot') {
      const centerScreenX = init.cx + init.translateX;
      const centerScreenY = init.cy + init.translateY;
      const angle = Math.atan2(py - centerScreenY, px - centerScreenX);
      // Offset by -90 deg since handle is at top (0, -halfH)
      this.rotation = angle + Math.PI / 2;
    } else {
      // Scale handles
      // Project delta along object local axes
      const cos = Math.cos(-init.rotation);
      const sin = Math.sin(-init.rotation);
      const localDx = dx * cos - dy * sin;
      const localDy = dx * sin + dy * cos;

      const halfW = this.width / 2;
      const halfH = this.height / 2;

      let newScaleX = init.scaleX;
      let newScaleY = init.scaleY;

      if (this.activeHandle.includes('e')) {
        newScaleX = init.scaleX * (1 + localDx / (halfW * init.scaleX || 1));
      }
      if (this.activeHandle.includes('w')) {
        newScaleX = init.scaleX * (1 - localDx / (halfW * init.scaleX || 1));
      }
      if (this.activeHandle.includes('s')) {
        newScaleY = init.scaleY * (1 + localDy / (halfH * init.scaleY || 1));
      }
      if (this.activeHandle.includes('n')) {
        newScaleY = init.scaleY * (1 - localDy / (halfH * init.scaleY || 1));
      }

      // Avoid flipping to negative or 0
      if (Math.abs(newScaleX) > 0.05) this.scaleX = newScaleX;
      if (Math.abs(newScaleY) > 0.05) this.scaleY = newScaleY;
    }

    if (this.onTransformChanged) this.onTransformChanged();
  }

  handlePointerUp() {
    this.activeHandle = null;
    this.initialTransform = null;
  }

  /**
   * Renders the transformed graphics and interactive gizmo on the overlay canvas
   */
  render(ctx) {
    if (!this.isActive || !this.buffer) return;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const centerScreenX = this.cx + this.translateX;
    const centerScreenY = this.cy + this.translateY;

    // Apply transformation
    ctx.translate(centerScreenX, centerScreenY);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    // 1. Draw transformed content
    ctx.drawImage(this.buffer, -halfW, -halfH, this.width, this.height);

    // 2. Draw Bounding Box & Gizmo
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5 / Math.max(Math.abs(this.scaleX), Math.abs(this.scaleY));
    ctx.strokeRect(-halfW, -halfH, this.width, this.height);

    // 3. Rotation Arm & Handle
    const rotArmLocal = this.rotArmLength / Math.abs(this.scaleY || 1);
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, -halfH - rotArmLocal);
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Rotation circle
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -halfH - rotArmLocal, this.handleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4. Handles (8 resize square handles)
    const handles = [
      [-halfW, -halfH],
      [0, -halfH],
      [halfW, -halfH],
      [halfW, 0],
      [halfW, halfH],
      [0, halfH],
      [-halfW, halfH],
      [-halfW, 0]
    ];

    const hr = this.handleRadius;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;

    for (const [hx, hy] of handles) {
      ctx.fillRect(hx - hr / 2, hy - hr / 2, hr, hr);
      ctx.strokeRect(hx - hr / 2, hy - hr / 2, hr, hr);
    }

    // 5. Center Pivot indicator
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Permanently bakes the transformed image into the target canvas
   */
  commit(targetCanvas) {
    if (!this.isActive || !this.buffer) return;

    const ctx = targetCanvas.getContext('2d');
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const centerScreenX = this.cx + this.translateX;
    const centerScreenY = this.cy + this.translateY;

    ctx.translate(centerScreenX, centerScreenY);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);

    const halfW = this.width / 2;
    const halfH = this.height / 2;
    ctx.drawImage(this.buffer, -halfW, -halfH, this.width, this.height);

    ctx.restore();
    this.stopTransform();
  }

  /**
   * Cancels transform and clears state
   */
  cancel() {
    this.stopTransform();
  }
}

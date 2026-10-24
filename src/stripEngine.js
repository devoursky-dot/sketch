// stripEngine.js
// Animation Strip / Shot Range Manager for RotoSketch Studio

export class StripEngine {
  constructor() {
    // Array of Strip objects
    // Each strip: { id, name, startFrame, endFrame, frameIndices: Set<number>, color }
    this.strips = [];
    this.nextStripId = 1;
    this.activeStripId = null;

    // Harmonious distinct color palette for visual differentiation
    this.colorPalette = [
      '#38bdf8', // Sky Blue
      '#a855f7', // Purple
      '#10b981', // Emerald
      '#fbbf24', // Amber
      '#f43f5e', // Rose
      '#06b6d4', // Cyan
      '#818cf8', // Indigo
      '#34d399'  // Mint
    ];

    this.onStripsChanged = null;
    this.onActiveStripChanged = null;
  }

  /**
   * Returns a copy of all strips, sorted by startFrame ascending
   */
  getStrips() {
    return [...this.strips].sort((a, b) => {
      const sa = a.startFrame !== null ? a.startFrame : 999999;
      const sb = b.startFrame !== null ? b.startFrame : 999999;
      return sa - sb;
    });
  }

  getActiveStrip() {
    if (!this.activeStripId) {
      if (this.strips.length > 0) {
        this.activeStripId = this.strips[0].id;
      }
    }
    return this.strips.find(s => s.id === this.activeStripId) || null;
  }

  setActiveStrip(stripId) {
    if (this.activeStripId !== stripId) {
      this.activeStripId = stripId;
      if (this.onActiveStripChanged) {
        this.onActiveStripChanged(this.getActiveStrip());
      }
      if (this.onStripsChanged) {
        this.onStripsChanged(this.getStrips());
      }
    }
  }

  /**
   * Creates a new strip with the given starting frame or from existing unassigned keyframes.
   * If startFrame is null/omitted and initialFrames is empty, creates a pending empty strip.
   */
  createNewStrip(startFrame = null, initialFrames = []) {
    const id = this.nextStripId++;
    const color = this.colorPalette[(id - 1) % this.colorPalette.length];

    const framesSet = new Set(initialFrames);
    if (initialFrames.length === 0 && typeof startFrame === 'number') {
      framesSet.add(startFrame);
    }

    const sortedFrames = Array.from(framesSet).sort((a, b) => a - b);
    const resolvedStart = sortedFrames.length > 0 ? sortedFrames[0] : (typeof startFrame === 'number' ? startFrame : null);
    const resolvedEnd = sortedFrames.length > 0 ? sortedFrames[sortedFrames.length - 1] : (typeof startFrame === 'number' ? startFrame : null);

    const newStrip = {
      id,
      name: `스트립 #${id}`,
      startFrame: resolvedStart,
      endFrame: resolvedEnd,
      frameIndices: framesSet,
      color
    };

    this.strips.push(newStrip);
    this.activeStripId = id;

    if (this.onStripsChanged) this.onStripsChanged(this.getStrips());
    if (this.onActiveStripChanged) this.onActiveStripChanged(newStrip);

    return newStrip;
  }

  /**
   * Automatically resolves or assigns a frame to a strip when drawing or moving.
   * - If an empty strip was just created, initializes it with this frame.
   * - If the frame is within or immediately adjacent to an existing strip, switches active strip to it.
   * - If the frame is outside any strip, expands the active strip or creates a new strip.
   */
  registerFrame(frameIndex) {
    // 1. If we have an active empty strip (pending), initialize it with this frame
    const active = this.getActiveStrip();
    if (active && active.frameIndices.size === 0) {
      active.frameIndices.add(frameIndex);
      active.startFrame = frameIndex;
      active.endFrame = frameIndex;
      if (this.onStripsChanged) this.onStripsChanged(this.getStrips());
      return active;
    }

    // 2. First, check if frame belongs inside an existing strip
    const existingStrip = this.findStripForFrame(frameIndex);
    if (existingStrip) {
      existingStrip.frameIndices.add(frameIndex);
      this._updateStripBounds(existingStrip);
      this.setActiveStrip(existingStrip.id);
      if (this.onStripsChanged) this.onStripsChanged(this.getStrips());
      return existingStrip;
    }

    // 3. If no strips exist at all, create Strip #1
    if (this.strips.length === 0) {
      return this.createNewStrip(frameIndex, [frameIndex]);
    }

    // 4. If there is an active strip, add to it and expand bounds
    if (active) {
      active.frameIndices.add(frameIndex);
      this._updateStripBounds(active);
      if (this.onStripsChanged) this.onStripsChanged(this.getStrips());
      return active;
    }

    // Fallback: create new strip
    return this.createNewStrip(frameIndex, [frameIndex]);
  }

  /**
   * Finds which strip contains or covers the given frame.
   */
  findStripForFrame(frameIndex) {
    if (typeof frameIndex !== 'number') return null;

    // Exact match in recorded frames
    for (const strip of this.strips) {
      if (strip.frameIndices.has(frameIndex)) return strip;
    }

    // Range match: startFrame <= frameIndex <= endFrame
    for (const strip of this.strips) {
      if (strip.startFrame !== null && strip.endFrame !== null) {
        if (frameIndex >= strip.startFrame && frameIndex <= strip.endFrame) {
          return strip;
        }
      }
    }

    return null;
  }

  _updateStripBounds(strip) {
    const arr = Array.from(strip.frameIndices).sort((a, b) => a - b);
    if (arr.length > 0) {
      strip.startFrame = arr[0];
      strip.endFrame = arr[arr.length - 1];
    }
  }

  /**
   * Deletes a strip by id. Returns the list of frame indices that belonged to this strip.
   */
  deleteStrip(stripId) {
    const idx = this.strips.findIndex(s => s.id === stripId);
    if (idx === -1) return [];

    const deleted = this.strips.splice(idx, 1)[0];
    const framesToDelete = Array.from(deleted.frameIndices);

    // Select another active strip if needed
    if (this.activeStripId === stripId) {
      this.activeStripId = this.strips.length > 0 ? this.strips[0].id : null;
    }

    if (this.onStripsChanged) this.onStripsChanged(this.getStrips());
    if (this.onActiveStripChanged) this.onActiveStripChanged(this.getActiveStrip());

    return framesToDelete;
  }

  /**
   * Removes a specific single frame index from whichever strip contains it.
   */
  removeFrame(frameIndex) {
    for (const strip of this.strips) {
      if (strip.frameIndices.has(frameIndex)) {
        strip.frameIndices.delete(frameIndex);
        this._updateStripBounds(strip);
      }
    }
    // Remove any strips that have become empty
    this.strips = this.strips.filter(s => s.frameIndices.size > 0);
    if (this.strips.length > 0 && !this.strips.some(s => s.id === this.activeStripId)) {
      this.activeStripId = this.strips[0].id;
    } else if (this.strips.length === 0) {
      this.activeStripId = null;
    }
    if (this.onStripsChanged) this.onStripsChanged(this.getStrips());
  }

  /**
   * Returns sequence of frames for ONLY the active (or specified) strip playback.
   * Includes a slight hold on the last frame for natural animation pacing.
   */
  getStripPlaybackSequence(stripId = null, holdFrames = 3) {
    const targetId = stripId || this.activeStripId;
    const strip = this.strips.find(s => s.id === targetId);
    if (!strip || strip.frameIndices.size === 0) return [];

    const frames = [];
    const end = strip.endFrame + holdFrames;
    for (let f = strip.startFrame; f <= end; f++) {
      frames.push(f);
    }
    return frames;
  }

  /**
   * CORE FEATURE:
   * Returns continuous concatenated sequence of all strips,
   * SKIPPING all blank empty video gaps between strips!
   */
  getAllStripsPlaybackSequence(holdFrames = 3) {
    const sorted = this.getStrips().filter(s => s.frameIndices.size > 0);
    if (sorted.length === 0) return [];

    const sequence = [];
    for (const strip of sorted) {
      const end = strip.endFrame + holdFrames;
      for (let f = strip.startFrame; f <= end; f++) {
        sequence.push(f);
      }
    }
    return sequence;
  }
}

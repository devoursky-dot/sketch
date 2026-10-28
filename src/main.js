// main.js
// RotoSketch Studio Main Application Coordinator

import { VideoEngine } from './videoEngine.js';
import { BrushEngine } from './brushEngine.js';
import { SelectionEngine } from './selectionEngine.js';
import { TransformEngine } from './transformEngine.js';
import { KeyframeEngine } from './keyframeEngine.js';
import { ViewportEngine } from './viewportEngine.js';
import { StripEngine } from './stripEngine.js';
import { createSampleVideoBlob } from './sampleVideoGenerator.js';
import { PWAManager } from './pwaManager.js';
import { VersionManager } from './versionManager.js';
import { AppInfoModal } from './ui/appInfoModal.js';

class RotoSketchApp {
  constructor() {
    this.width = 854;
    this.height = 480;
    this.fps = 24;
    this.currentTool = 'brush'; // 'brush' | 'eraser' | 'lasso' | 'transform' | 'zoom' | 'pan'
    this.soloAnimationMode = false;
    this.videoOpacity = 0.5;
    this.showVideo = true;

    // Independent tool size storage: Pen & Eraser sizes are stored separately!
    this.penSize = 6;
    this.eraserSize = 24;

    // Strip Animation Playback States
    this.isStripPlaying = false;
    this.isAllStripsPlaying = false;
    this.stripToDeleteId = null;

    // Viewport drag tracking
    this.isZoomDragging = false;
    this.zoomStartClientY = 0;
    this.zoomStartClientX = 0;
    this.zoomInitialScale = 1.0;
    this.zoomDragMoved = false;

    this.isPanDragging = false;
    this.panStartClientX = 0;
    this.panStartClientY = 0;
    this.panInitialX = 0;
    this.panInitialY = 0;

    // Initialize Engines
    this.videoEngine = new VideoEngine({ fps: this.fps });
    this.brushEngine = new BrushEngine();
    this.brushEngine.setSize(this.penSize);
    this.selectionEngine = new SelectionEngine();
    this.transformEngine = new TransformEngine();
    this.keyframeEngine = new KeyframeEngine(this.width, this.height);
    this.stripEngine = new StripEngine();

    // PWA & Automated Version Management Setup
    this.pwaManager = new PWAManager();
    this.versionManager = new VersionManager({
      pwaManager: this.pwaManager
    });
    this.appInfoModal = new AppInfoModal({
      versionManager: this.versionManager,
      pwaManager: this.pwaManager
    });

    this._queryDOMElements();
    this.viewportEngine = new ViewportEngine(this.canvasStack, this.stageViewport);

    this._setupCanvases();
    this._fitCanvasToWindow();
    window.addEventListener('resize', () => {
      this._fitCanvasToWindow();
    });
    document.addEventListener('fullscreenchange', () => this._updateFullscreenUI());

    this._bindEngineCallbacks();
    this._bindUIEvents();
    this._bindKeyboardShortcuts();
    this._startRenderLoop();
    this._updateActiveStripBadge();

    // Auto-load high quality sample video on startup for immediate experience
    this.loadSampleVideo();
  }

  _queryDOMElements() {
    // Canvases
    this.videoCanvas = document.getElementById('videoCanvas');
    this.onionCanvas = document.getElementById('onionCanvas');
    this.drawingCanvas = document.getElementById('drawingCanvas');
    this.overlayCanvas = document.getElementById('overlayCanvas');
    this.canvasStack = document.getElementById('canvasStack');

    // Contexts
    this.vCtx = this.videoCanvas.getContext('2d');
    this.oCtx = this.onionCanvas.getContext('2d');
    this.dCtx = this.drawingCanvas.getContext('2d');
    this.ovCtx = this.overlayCanvas.getContext('2d');

    // Header buttons
    this.videoFileInput = document.getElementById('videoFileInput');
    this.btnOpenVideo = document.getElementById('btnOpenVideo');
    this.btnToggleOnionSkin = document.getElementById('btnToggleOnionSkin');
    this.fpsSelect = document.getElementById('fpsSelect');
    this.btnExportSequence = document.getElementById('btnExportSequence');

    // Studio Toolbar & Viewport Controls
    this.stageViewport = document.getElementById('stageViewport');
    this.studioToolbarContainer = document.getElementById('studioToolbarContainer');
    this.btnToggleToolbar = document.getElementById('btnToggleToolbar');
    this.btnMoreMenu = document.getElementById('btnMoreMenu');
    this.dropdownMoreMenu = document.getElementById('dropdownMoreMenu');
    this.btnToolOptions = document.getElementById('btnToolOptions');
    this.dropdownToolOptions = document.getElementById('dropdownToolOptions');
    this.toolZoom = document.getElementById('toolZoom');
    this.toolPan = document.getElementById('toolPan');
    this.btnFitScreen = document.getElementById('btnFitScreen');
    this.zoomDisplayBadge = document.getElementById('zoomDisplayBadge');

    // Menu Dropdown Items
    this.menuItemOpenVideo = document.getElementById('menuItemOpenVideo');
    this.menuItemToggleOnion = document.getElementById('menuItemToggleOnion');
    this.menuItemExportSequence = document.getElementById('menuItemExportSequence');
    this.menuItemExportVideo = document.getElementById('menuItemExportVideo');
    this.menuItemAppInfo = document.getElementById('menuItemAppInfo');

    // Tools
    this.toolBrush = document.getElementById('toolBrush');
    this.toolEraser = document.getElementById('toolEraser');
    this.toolLasso = document.getElementById('toolLasso');
    this.toolTransform = document.getElementById('toolTransform');
    this.transformActionGroup = document.getElementById('transformActionGroup');
    this.btnCommitTransform = document.getElementById('btnCommitTransform');
    this.btnCancelTransform = document.getElementById('btnCancelTransform');
    this.btnClearSelection = document.getElementById('btnClearSelection');
    this.btnUndo = document.getElementById('btnUndo');
    this.btnRedo = document.getElementById('btnRedo');
    this.btnClearCurrentFrame = document.getElementById('btnClearCurrentFrame');

    // Independent Pen & Eraser Size Elements
    this.penSizeSlider = document.getElementById('penSizeSlider');
    this.penSizeVal = document.getElementById('penSizeVal');
    this.penIndicatorSize = document.getElementById('penIndicatorSize');
    this.eraserSizeSlider = document.getElementById('eraserSizeSlider');
    this.eraserSizeVal = document.getElementById('eraserSizeVal');
    this.eraserIndicatorSize = document.getElementById('eraserIndicatorSize');

    // Properties - 3-Level Stabilizer & Wacom Pen Gauge
    this.stabilizerLevelButtons = document.getElementById('stabilizerLevelButtons');
    this.stabilizerBadge = document.getElementById('stabilizerBadge');
    this.stabilizerDesc = document.getElementById('stabilizerDesc');
    this.penDeviceType = document.getElementById('penDeviceType');
    this.gaugeBarFill = document.getElementById('gaugeBarFill');
    this.gaugePressureVal = document.getElementById('gaugePressureVal');
    this.gaugeWidthVal = document.getElementById('gaugeWidthVal');
    this.brushSizeSlider = document.getElementById('brushSizeSlider');
    this.brushSizeVal = document.getElementById('brushSizeVal');
    this.brushPreviewDot = document.getElementById('brushPreviewDot');
    this.brushOpacitySlider = document.getElementById('brushOpacitySlider');
    this.brushOpacityVal = document.getElementById('brushOpacityVal');
    this.brushColorPicker = document.getElementById('brushColorPicker');
    this.colorSwatches = document.getElementById('colorSwatches');
    this.videoOpacitySlider = document.getElementById('videoOpacitySlider');
    this.videoOpacityVal = document.getElementById('videoOpacityVal');
    this.chkShowVideo = document.getElementById('chkShowVideo');
    this.keyframeCountBadge = document.getElementById('keyframeCountBadge');
    this.keyframeChipList = document.getElementById('keyframeChipList');
    this.chkHoldDrawing = document.getElementById('chkHoldDrawing');
    this.stageModeBadge = document.getElementById('stageModeBadge');

    this.app = document.getElementById('app');

    // Tablet & Fullscreen Controls
    this.btnToggleFullscreen = document.getElementById('btnToggleFullscreen');
    this.iconFsEnter = document.getElementById('iconFsEnter');
    this.iconFsExit = document.getElementById('iconFsExit');
    this.lblFullscreen = document.getElementById('lblFullscreen');

    // Device Adaptation Mode (Auto / PC / Tablet)
    this.btnDeviceModeToggle = document.getElementById('btnDeviceModeToggle');
    this.deviceModeIcon = document.getElementById('deviceModeIcon');
    this.deviceModeLabel = document.getElementById('deviceModeLabel');
    this.selDeviceMode = document.getElementById('selDeviceMode');
    this.deviceMode = localStorage.getItem('rotosketch_device_mode') || 'auto';

    // Transport (Dropdown + Single Pair)
    this.btnPlayPause = document.getElementById('btnPlayPause');
    this.playPauseIcon = document.getElementById('playPauseIcon');
    this.playPauseText = document.getElementById('playPauseText');
    this.selStepUnit = document.getElementById('selStepUnit');
    this.btnStepBack = document.getElementById('btnStepBack');
    this.btnStepForward = document.getElementById('btnStepForward');
    this.chkLoop = document.getElementById('chkLoop');

    // Frame Browser Modal (Tablet Frame Gallery)
    this.btnOpenFrameBrowser = document.getElementById('btnOpenFrameBrowser');
    this.btnCloseFrameBrowser = document.getElementById('btnCloseFrameBrowser');
    this.frameBrowserModal = document.getElementById('frameBrowserModal');
    this.frameBrowserContent = document.getElementById('frameBrowserContent');
    this.btnModalNewStrip = document.getElementById('btnModalNewStrip');
    this.btnModalPlayAll = document.getElementById('btnModalPlayAll');

    // Menu Drawer Toggles (Tablet Mode Controls)
    this.menuChkShowVideo = document.getElementById('menuChkShowVideo');
    this.menuVideoOpacitySlider = document.getElementById('menuVideoOpacitySlider');
    this.menuVideoOpacityVal = document.getElementById('menuVideoOpacityVal');
    this.menuChkHoldDrawing = document.getElementById('menuChkHoldDrawing');
    this.menuFpsSelect = document.getElementById('menuFpsSelect');

    // Speed & Pure Animation Controls
    this.playbackSpeed = 1.0;
    this.isPureAnimPlaying = false;
    this.btnPlayPureAnim = document.getElementById('btnPlayPureAnim');
    this.selPlaybackSpeed = document.getElementById('selPlaybackSpeed');

    // Timecode
    this.displayFrameNumber = document.getElementById('displayFrameNumber');
    this.displayTotalFrames = document.getElementById('displayTotalFrames');
    this.displayCurrentTime = document.getElementById('displayCurrentTime');
    this.displayTotalDuration = document.getElementById('displayTotalDuration');

    // Timeline Scrubber & Live Hover Card
    this.timelineTrackContainer = document.getElementById('timelineTrackContainer');
    this.timelineTrack = document.getElementById('timelineTrack');
    this.timelineStripRanges = document.getElementById('timelineStripRanges');
    this.timelineRuler = document.getElementById('timelineRuler');
    this.timelinePlayhead = document.getElementById('timelinePlayhead');
    this.keyframeMarkers = document.getElementById('keyframeMarkers');
    this.filmstripScroll = document.getElementById('filmstripScroll');
    this.filmstripCountBadge = document.getElementById('filmstripCountBadge');
    this.isFilmstripDraggingMoved = false;

    this.timelineHoverCard = document.getElementById('timelineHoverCard');
    this.timelineHoverCanvas = document.getElementById('timelineHoverCanvas');
    this.hoverDrawingBadge = document.getElementById('hoverDrawingBadge');
    this.hoverFrameNum = document.getElementById('hoverFrameNum');
    this.hoverTimecode = document.getElementById('hoverTimecode');

    // Professional Animation Strip Track
    this.timelineStripLane = document.getElementById('timelineStripLane');
    this.stripCountBadge = document.getElementById('stripCountBadge');
    this.btnNewStrip = document.getElementById('btnNewStrip');
    this.btnPlayAllStrips = document.getElementById('btnPlayAllStrips');
    this.currentStripBadge = document.getElementById('currentStripBadge');
    if (this.currentStripBadge) {
      this.currentStripBadge.addEventListener('click', () => this._openFrameBrowser());
    }
    this.playingStripId = null;
    this.isStripPlaying = false;
    this.isAllStripsPlaying = false;

    // Strip Delete Confirmation Modal
    this.deleteStripModal = document.getElementById('deleteStripModal');
    this.btnCloseDeleteStripModal = document.getElementById('btnCloseDeleteStripModal');
    this.btnCancelDeleteStrip = document.getElementById('btnCancelDeleteStrip');
    this.btnConfirmDeleteStrip = document.getElementById('btnConfirmDeleteStrip');
    this.deleteStripTargetTitle = document.getElementById('deleteStripTargetTitle');

    // Video Export Modal
    this.btnExportVideo = document.getElementById('btnExportVideo');
    this.exportVideoModal = document.getElementById('exportVideoModal');
    this.btnCloseExportModal = document.getElementById('btnCloseExportModal');
    this.btnCancelExport = document.getElementById('btnCancelExport');
    this.btnStartExportVideo = document.getElementById('btnStartExportVideo');
    this.exportBgColor = document.getElementById('exportBgColor');
    this.exportProgressBar = document.getElementById('exportProgressBar');
    this.exportProgressFill = document.getElementById('exportProgressFill');
    this.exportProgressText = document.getElementById('exportProgressText');
  }

  _setupCanvases() {
    const canvases = [this.videoCanvas, this.onionCanvas, this.drawingCanvas, this.overlayCanvas];
    for (const c of canvases) {
      c.width = this.width;
      c.height = this.height;
    }
  }

  _bindEngineCallbacks() {
    this.videoEngine.onLoaded = ({ totalFrames, duration, width, height }) => {
      this.displayTotalFrames.innerText = totalFrames;
      this.displayTotalDuration.innerText = this._formatTime(duration);
      if (width && height) {
        this.width = width;
        this.height = height;
        [this.videoCanvas, this.onionCanvas, this.drawingCanvas, this.overlayCanvas].forEach(c => {
          if (c) {
            c.width = this.width;
            c.height = this.height;
          }
        });
        if (this.keyframeEngine) {
          this.keyframeEngine.width = this.width;
          this.keyframeEngine.height = this.height;
        }
      }
      this._fitCanvasToWindow();
      this._buildTimelineRuler(totalFrames);
      this._updatePlayhead(0);
      this._renderCurrentFrameToCanvas();
      this._renderKeyframeFilmstrip(this.keyframeEngine.getKeyframeIndices());
    };

    this.videoEngine.onFrameChange = (frame) => {
      // Prevent asynchronous video seek events from jittering during active animation playback
      if (this.keyframeEngine.isAnimPlaying) return;

      this._updateTimecodeDisplay(frame);
      this._updatePlayhead(frame);
      this._syncDrawingLayerForFrame(frame, this.videoEngine.isPlaying || this.isStripPlaying || this.isAllStripsPlaying);
      this._renderCurrentFrameToCanvas();
      this._renderOnionSkin(frame);
      this._highlightFilmstripThumb(frame);

      // Auto-switch active strip if current frame belongs to an existing strip
      const strip = this.stripEngine.findStripForFrame(frame);
      if (strip && strip.id !== this.stripEngine.activeStripId) {
        this.stripEngine.setActiveStrip(strip.id);
      }
    };

    this.keyframeEngine.onKeyframeListChanged = (indices) => {
      this._renderKeyframeMarkers(indices);
      this._renderKeyframeChips(indices);
      this._renderKeyframeFilmstrip(indices);
    };

    this.stripEngine.onStripsChanged = () => {
      this._renderKeyframeFilmstrip(this.keyframeEngine.getKeyframeIndices());
      this._updateActiveStripBadge();
      this._renderTimelineStripRanges();
    };

    this.stripEngine.onActiveStripChanged = () => {
      this._renderKeyframeFilmstrip(this.keyframeEngine.getKeyframeIndices());
      this._updateActiveStripBadge();
      this._renderTimelineStripRanges();
    };

    this.brushEngine.onPressureChange = (p, width) => {
      const pct = Math.round(p * 100);
      if (this.gaugeBarFill) this.gaugeBarFill.style.width = `${pct}%`;
      if (this.gaugePressureVal) this.gaugePressureVal.innerText = `${pct}%`;
      if (this.gaugeWidthVal) this.gaugeWidthVal.innerText = `${width.toFixed(1)} px`;
    };

    this.brushEngine.onStrokeStart = () => {
      // Save state before stroke for Undo
      this.keyframeEngine.saveSnapshotForUndo(this.videoEngine.currentFrame, this.drawingCanvas);
    };

    this.brushEngine.onStrokeEnd = () => {
      // Sync stroke to stored keyframe canvas
      const currentFrame = this.videoEngine.currentFrame;
      const kfCanvas = this.keyframeEngine.getKeyframe(currentFrame, true);
      const kCtx = kfCanvas.getContext('2d');
      kCtx.clearRect(0, 0, this.width, this.height);
      kCtx.drawImage(this.drawingCanvas, 0, 0);

      // Register or update strip membership for this frame
      this.stripEngine.registerFrame(currentFrame);

      // Trigger onion skin refresh and marker update
      this._renderOnionSkin(currentFrame);
      const indices = this.keyframeEngine.getKeyframeIndices();
      this._renderKeyframeMarkers(indices);
      this._renderKeyframeChips(indices);
      this._renderKeyframeFilmstrip(indices);
    };
  }

  _bindUIEvents() {
    // 1. File Loading
    if (this.btnOpenVideo) {
      this.btnOpenVideo.addEventListener('click', () => this.videoFileInput.click());
    }
    if (this.videoFileInput) {
      this.videoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          this.videoEngine.loadVideo(url);
        }
      });
    }

    // Keyframe Drawing Filmstrip: Drag-to-Scroll & Wheel Pan
    this._bindFilmstripDragScroll();

    // Animation Strip Header Actions (Bottom Dock)
    if (this.btnNewStrip) {
      this.btnNewStrip.addEventListener('click', () => {
        this._stopStripPlaybacks();
        this.stripEngine.createNewStrip();
        this._renderTimelineStripRanges();
      });
    }

    if (this.btnPlayAllStrips) {
      this.btnPlayAllStrips.addEventListener('click', () => {
        this._toggleAllStripsPlayback();
      });
    }

    // Strip Delete Confirmation Modal
    if (this.btnCloseDeleteStripModal) {
      this.btnCloseDeleteStripModal.addEventListener('click', () => this._closeDeleteStripModal());
    }
    if (this.btnCancelDeleteStrip) {
      this.btnCancelDeleteStrip.addEventListener('click', () => this._closeDeleteStripModal());
    }
    if (this.btnConfirmDeleteStrip) {
      this.btnConfirmDeleteStrip.addEventListener('click', () => this._confirmDeleteStrip());
    }

    // 2. Pure Animation Playback (Solo Sketch on Canvas)
    if (this.btnPlayPureAnim) {
      this.btnPlayPureAnim.addEventListener('click', () => this._togglePureAnimationPlayback());
    }

    // Playback Speed Selector (0.25x ~ 2.0x)
    if (this.selPlaybackSpeed) {
      this.selPlaybackSpeed.addEventListener('change', (e) => {
        this._setPlaybackSpeed(parseFloat(e.target.value));
      });
    }

    // Keyframe Hold Toggle
    if (this.chkHoldDrawing) {
      this.chkHoldDrawing.addEventListener('change', (e) => {
        this.keyframeEngine.setHoldDrawing(e.target.checked);
        this._syncDrawingLayerForFrame(this.videoEngine.currentFrame, this.videoEngine.isPlaying || this.isPureAnimPlaying || this.isStripPlaying || this.isAllStripsPlaying);
      });
    }

    // Video Export Modal Events
    if (this.btnExportVideo) {
      this.btnExportVideo.addEventListener('click', () => this._openExportVideoModal());
    }
    if (this.btnCloseExportModal) {
      this.btnCloseExportModal.addEventListener('click', () => this._closeExportVideoModal());
    }
    if (this.btnCancelExport) {
      this.btnCancelExport.addEventListener('click', () => this._closeExportVideoModal());
    }
    if (this.btnStartExportVideo) {
      this.btnStartExportVideo.addEventListener('click', () => this._startVideoExport());
    }

    // 3. Onion Skin Toggle
    if (this.btnToggleOnionSkin) {
      this.btnToggleOnionSkin.addEventListener('click', () => {
        this.keyframeEngine.onionSkinEnabled = !this.keyframeEngine.onionSkinEnabled;
        this.btnToggleOnionSkin.classList.toggle('active', this.keyframeEngine.onionSkinEnabled);
        this._renderOnionSkin(this.videoEngine.currentFrame);
      });
    }

    // 4. FPS Selector
    if (this.fpsSelect) {
      this.fpsSelect.addEventListener('change', (e) => {
        this.fps = parseInt(e.target.value, 10);
        this.videoEngine.setFPS(this.fps);
        this._buildTimelineRuler(this.videoEngine.totalFrames);
      });
    }

    // 5. Studio Toolbar & Tools Switching
    if (this.btnToggleToolbar && this.studioToolbarContainer) {
      this.btnToggleToolbar.addEventListener('click', () => {
        this.studioToolbarContainer.classList.toggle('collapsed');
      });
    }

    // Dropdown toggles
    if (this.btnMoreMenu && this.dropdownMoreMenu) {
      this.btnMoreMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = this.dropdownMoreMenu.style.display === 'flex';
        if (isShown) {
          this.dropdownMoreMenu.style.display = 'none';
        } else {
          const rect = this.btnMoreMenu.getBoundingClientRect();
          this.dropdownMoreMenu.style.position = 'fixed';
          this.dropdownMoreMenu.style.top = `${rect.bottom + 8}px`;
          this.dropdownMoreMenu.style.left = `${Math.min(window.innerWidth - 330, Math.max(10, rect.left))}px`;
          this.dropdownMoreMenu.style.display = 'flex';
        }
        if (this.dropdownToolOptions) this.dropdownToolOptions.style.display = 'none';
      });
    }

    if (this.btnToolOptions && this.dropdownToolOptions) {
      this.btnToolOptions.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = this.dropdownToolOptions.style.display === 'flex';
        if (isShown) {
          this.dropdownToolOptions.style.display = 'none';
        } else {
          const rect = this.btnToolOptions.getBoundingClientRect();
          this.dropdownToolOptions.style.position = 'fixed';
          this.dropdownToolOptions.style.top = `${rect.bottom + 8}px`;
          this.dropdownToolOptions.style.left = `${Math.min(window.innerWidth - 330, Math.max(10, rect.right - 320))}px`;
          this.dropdownToolOptions.style.display = 'flex';
        }
        if (this.dropdownMoreMenu) this.dropdownMoreMenu.style.display = 'none';
      });
    }

    // Close dropdowns on outside pointer down
    document.addEventListener('pointerdown', (e) => {
      if (this.dropdownMoreMenu && this.dropdownMoreMenu.style.display !== 'none') {
        if (!e.target.closest('#btnMoreMenu, #dropdownMoreMenu')) {
          this.dropdownMoreMenu.style.display = 'none';
        }
      }
      if (this.dropdownToolOptions && this.dropdownToolOptions.style.display !== 'none') {
        if (!e.target.closest('#btnToolOptions, #dropdownToolOptions')) {
          this.dropdownToolOptions.style.display = 'none';
        }
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.dropdownMoreMenu) this.dropdownMoreMenu.style.display = 'none';
        if (this.dropdownToolOptions) this.dropdownToolOptions.style.display = 'none';
      }
    });

    // Hidden Menu items
    if (this.menuItemOpenVideo) {
      this.menuItemOpenVideo.addEventListener('click', () => {
        this.dropdownMoreMenu.style.display = 'none';
        if (this.videoFileInput) this.videoFileInput.click();
      });
    }
    if (this.menuItemToggleOnion) {
      this.menuItemToggleOnion.addEventListener('click', () => {
        this.dropdownMoreMenu.style.display = 'none';
        this.keyframeEngine.onionSkinEnabled = !this.keyframeEngine.onionSkinEnabled;
        this._renderOnionSkin(this.videoEngine.currentFrame);
      });
    }
    if (this.menuItemExportSequence) {
      this.menuItemExportSequence.addEventListener('click', () => {
        this.dropdownMoreMenu.style.display = 'none';
        this._exportKeyframeSequence();
      });
    }
    if (this.menuItemExportVideo) {
      this.menuItemExportVideo.addEventListener('click', () => {
        this.dropdownMoreMenu.style.display = 'none';
        this._openExportVideoModal();
      });
    }
    if (this.menuItemAppInfo) {
      this.menuItemAppInfo.addEventListener('click', () => {
        if (this.dropdownMoreMenu) this.dropdownMoreMenu.style.display = 'none';
        this.appInfoModal.show();
      });
    }

    // Tools Switching
    if (this.toolBrush) this.toolBrush.addEventListener('click', () => this._setTool('brush'));
    if (this.toolEraser) this.toolEraser.addEventListener('click', () => this._setTool('eraser'));
    if (this.toolLasso) this.toolLasso.addEventListener('click', () => this._setTool('lasso'));
    if (this.toolTransform) this.toolTransform.addEventListener('click', () => this._triggerTransform());
    if (this.toolZoom) this.toolZoom.addEventListener('click', () => this._setTool('zoom'));
    if (this.toolPan) this.toolPan.addEventListener('click', () => this._setTool('pan'));
    if (this.btnFitScreen) {
      this.btnFitScreen.addEventListener('click', () => {
        this.viewportEngine.resetView(true);
      });
    }

    // Viewport transform feedback
    this.viewportEngine.onTransformChange = ({ zoom }) => {
      if (this.zoomDisplayBadge) {
        this.zoomDisplayBadge.innerText = this.viewportEngine.getZoomPercent();
      }
    };

    // Stage viewport mouse wheel zoom centered at cursor position
    if (this.stageViewport) {
      this.stageViewport.addEventListener('wheel', (e) => {
        const isOverUI = e.target.closest('.studio-toolbar-container, .tb-dropdown-panel, .timeline-dock, .modal-backdrop');
        if (!isOverUI || e.ctrlKey || this.currentTool === 'zoom') {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.15 : -0.15;
          this.viewportEngine.zoomByAt(e.clientX, e.clientY, delta, false);
        }
      }, { passive: false });
    }

    // Independent Pen & Eraser Size Sliders
    if (this.penSizeSlider) {
      this.penSizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.penSize = val;
        if (this.penSizeVal) this.penSizeVal.innerText = `${val} px`;
        if (this.penIndicatorSize) this.penIndicatorSize.innerText = `${val}px`;
        if (this.currentTool === 'brush') {
          this.brushEngine.setSize(val);
        }
      });
    }

    if (this.eraserSizeSlider) {
      this.eraserSizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.eraserSize = val;
        if (this.eraserSizeVal) this.eraserSizeVal.innerText = `${val} px`;
        if (this.eraserIndicatorSize) this.eraserIndicatorSize.innerText = `${val}px`;
        if (this.currentTool === 'eraser') {
          this.brushEngine.setSize(val);
        }
      });
    }

    // Transform Actions
    if (this.btnCommitTransform) this.btnCommitTransform.addEventListener('click', () => this._commitTransform());
    if (this.btnCancelTransform) this.btnCancelTransform.addEventListener('click', () => this._cancelTransform());
    if (this.btnClearSelection) {
      this.btnClearSelection.addEventListener('click', () => {
        this.selectionEngine.clear();
        this._setTool('brush');
      });
    }

    // History and Clear
    if (this.btnUndo) {
      this.btnUndo.addEventListener('click', () => {
        this.keyframeEngine.undo(this.videoEngine.currentFrame, this.drawingCanvas);
        this._renderOnionSkin(this.videoEngine.currentFrame);
        this._renderKeyframeFilmstrip(this.keyframeEngine.getKeyframeIndices());
      });
    }
    if (this.btnRedo) {
      this.btnRedo.addEventListener('click', () => {
        this.keyframeEngine.redo(this.videoEngine.currentFrame, this.drawingCanvas);
        this._renderOnionSkin(this.videoEngine.currentFrame);
        this._renderKeyframeFilmstrip(this.keyframeEngine.getKeyframeIndices());
      });
    }
    if (this.btnClearCurrentFrame) {
      this.btnClearCurrentFrame.addEventListener('click', () => {
        this.keyframeEngine.clearKeyframe(this.videoEngine.currentFrame, this.drawingCanvas);
        this._renderOnionSkin(this.videoEngine.currentFrame);
        const indices = this.keyframeEngine.getKeyframeIndices();
        this._renderKeyframeMarkers(indices);
        this._renderKeyframeChips(indices);
        this._renderKeyframeFilmstrip(indices);
      });
    }

    // 6. 3-Level Stabilizer Controls
    const stabDescs = {
      0: '0단계: 보정 없이 즉각적으로 반응하여 빠른 스케치에 적합합니다.',
      1: '1단계: 가벼운 손떨림을 완화하여 자연스러운 펜 터치를 지원합니다.',
      2: '2단계: 손떨림을 효과적으로 흡수하여 깔끔한 만화/애니메이션 인킹을 제공합니다. (권장)',
      3: '3단계: 가상 로프를 당기는 방식으로 미세 떨림을 완벽 제거하여 정밀 곡선을 그립니다.'
    };
    const stabBadges = {
      0: '0단계 (끔)',
      1: '1단계 (자연)',
      2: '2단계 (안정)',
      3: '3단계 (로프)'
    };

    if (this.stabilizerLevelButtons) {
      this.stabilizerLevelButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.stab-btn');
        if (!btn) return;
        const lvl = parseInt(btn.getAttribute('data-level'), 10);
        this.brushEngine.setStabilizerLevel(lvl);
        this.stabilizerLevelButtons.querySelectorAll('.stab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.stabilizerBadge) this.stabilizerBadge.innerText = stabBadges[lvl];
        if (this.stabilizerDesc) this.stabilizerDesc.innerText = stabDescs[lvl];
      });
    }

    if (this.brushSizeSlider) {
      this.brushSizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.brushSizeVal) this.brushSizeVal.innerText = `${val} px`;
        this.brushEngine.setSize(val);
        if (this.brushPreviewDot) {
          this.brushPreviewDot.style.width = `${Math.min(40, val)}px`;
          this.brushPreviewDot.style.height = `${Math.min(40, val)}px`;
        }
      });
    }

    if (this.brushOpacitySlider) {
      this.brushOpacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.brushOpacityVal) this.brushOpacityVal.innerText = `${val}%`;
        this.brushEngine.setOpacity(val / 100);
      });
    }

    if (this.brushColorPicker) {
      this.brushColorPicker.addEventListener('input', (e) => {
        this._setColor(e.target.value);
      });
    }

    if (this.colorSwatches) {
      this.colorSwatches.addEventListener('click', (e) => {
        const chip = e.target.closest('.color-chip');
        if (chip) {
          document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const color = chip.getAttribute('data-color');
          if (this.brushColorPicker) this.brushColorPicker.value = color;
          this._setColor(color);
        }
      });
    }

    if (this.videoOpacitySlider) {
      this.videoOpacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.videoOpacityVal) this.videoOpacityVal.innerText = `${val}%`;
        this.videoOpacity = val / 100;
        if (!this.soloAnimationMode && this.showVideo) {
          this.videoCanvas.style.opacity = this.videoOpacity;
        }
      });
    }

    if (this.chkShowVideo) {
      this.chkShowVideo.addEventListener('change', (e) => {
        this.showVideo = e.target.checked;
        if (!this.soloAnimationMode) {
          this.videoCanvas.style.opacity = this.showVideo ? this.videoOpacity : '0';
        }
      });
    }

    // 7. Transport Controls (Play Toggle & Step Unit Navigation)
    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', () => this._togglePlay());
    }
    if (this.btnStepBack) {
      this.btnStepBack.addEventListener('click', () => this._stepBySelectedUnit(-1));
    }
    if (this.btnStepForward) {
      this.btnStepForward.addEventListener('click', () => this._stepBySelectedUnit(1));
    }

    // Tablet Fullscreen Toggle
    if (this.btnToggleFullscreen) {
      this.btnToggleFullscreen.addEventListener('click', () => this._toggleFullscreen());
    }

    // Device Mode Switching (PC ↔ Tablet)
    if (this.btnDeviceModeToggle) {
      this.btnDeviceModeToggle.addEventListener('click', () => this._cycleDeviceMode());
    }
    if (this.selDeviceMode) {
      this.selDeviceMode.addEventListener('change', (e) => this._setDeviceMode(e.target.value));
    }

    // Frame Browser Modal (Popup Gallery)
    if (this.btnOpenFrameBrowser) {
      this.btnOpenFrameBrowser.addEventListener('click', () => this._openFrameBrowser());
    }
    if (this.btnCloseFrameBrowser) {
      this.btnCloseFrameBrowser.addEventListener('click', () => this._closeFrameBrowser());
    }
    if (this.frameBrowserModal) {
      this.frameBrowserModal.addEventListener('click', (e) => {
        if (e.target === this.frameBrowserModal) this._closeFrameBrowser();
      });
    }
    if (this.btnModalNewStrip) {
      this.btnModalNewStrip.addEventListener('click', () => {
        this._createNewStrip();
        this._renderFrameBrowserModal();
      });
    }
    if (this.btnModalPlayAll) {
      this.btnModalPlayAll.addEventListener('click', () => {
        this._closeFrameBrowser();
        this._toggleAllStripsPlayback();
      });
    }

    // Menu Drawer Settings Synchronization
    if (this.menuChkShowVideo) {
      this.menuChkShowVideo.addEventListener('change', (e) => {
        this.showVideo = e.target.checked;
        if (this.chkShowVideo) this.chkShowVideo.checked = this.showVideo;
        if (!this.soloAnimationMode) {
          this.videoCanvas.style.opacity = this.showVideo ? this.videoOpacity : '0';
        }
      });
    }

    if (this.menuVideoOpacitySlider) {
      this.menuVideoOpacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.videoOpacity = val / 100;
        if (this.videoOpacitySlider) this.videoOpacitySlider.value = val;
        if (this.videoOpacityVal) this.videoOpacityVal.innerText = `${val}%`;
        if (this.menuVideoOpacityVal) this.menuVideoOpacityVal.innerText = `${val}%`;
        if (!this.soloAnimationMode && this.showVideo) {
          this.videoCanvas.style.opacity = this.videoOpacity;
        }
      });
    }

    if (this.menuChkHoldDrawing) {
      this.menuChkHoldDrawing.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (this.chkHoldDrawing) this.chkHoldDrawing.checked = checked;
        this.keyframeEngine.setHoldDrawing(checked);
        this._syncDrawingLayerForFrame(this.videoEngine.currentFrame, false);
      });
    }

    if (this.menuFpsSelect) {
      this.menuFpsSelect.addEventListener('change', (e) => {
        const fps = parseInt(e.target.value, 10);
        if (this.fpsSelect) this.fpsSelect.value = fps;
        this.fps = fps;
        this.videoEngine.setFPS(fps);
        this._buildTimelineRuler(this.videoEngine.totalFrames);
      });
    }

    // 8. Timeline Track Scrubbing & Live Thumbnail Hover Card
    let isScrubbing = false;

    const updateHoverCard = async (clientX) => {
      if (!this.timelineHoverCard || !this.videoEngine.isLoaded) return;
      const rect = this.timelineTrack.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = x / rect.width;
      const targetFrame = Math.round(ratio * (this.videoEngine.totalFrames - 1));

      // Position hover card horizontally centered on cursor, clamped within container
      const containerRect = this.timelineTrackContainer.getBoundingClientRect();
      const cardX = Math.max(88, Math.min(containerRect.width - 88, clientX - containerRect.left));
      this.timelineHoverCard.style.left = `${cardX}px`;
      this.timelineHoverCard.style.display = 'flex';

      // Update text
      if (this.hoverFrameNum) this.hoverFrameNum.innerText = `프레임 #${targetFrame}`;
      if (this.hoverTimecode) this.hoverTimecode.innerText = this._formatTime(targetFrame / this.videoEngine.fps);

      // Render thumbnail synchronously with ZERO flicker
      if (this.timelineHoverCanvas) {
        const hCtx = this.timelineHoverCanvas.getContext('2d');
        this._currentHoverTargetFrame = targetFrame;

        const thumb = this.videoEngine.getNearestCachedThumbnail(targetFrame, 160, 90);
        if (thumb) {
          hCtx.drawImage(thumb, 0, 0, 160, 90);
        }

        // Overlay drawing thumbnail if keyframe exists
        const hasKf = this.keyframeEngine.hasKeyframe(targetFrame);
        if (this.hoverDrawingBadge) {
          this.hoverDrawingBadge.style.display = hasKf ? 'block' : 'none';
        }
        if (hasKf) {
          const kf = this.keyframeEngine.getKeyframe(targetFrame);
          if (kf) {
            hCtx.drawImage(kf, 0, 0, 160, 90);
          }
        }

        // On-demand async exact thumbnail request
        if (!this.videoEngine.thumbnailCache.has(targetFrame)) {
          this.videoEngine.requestExactThumbnail(targetFrame, 160, 90).then((exactThumb) => {
            if (exactThumb && this._currentHoverTargetFrame === targetFrame) {
              hCtx.drawImage(exactThumb, 0, 0, 160, 90);
              if (this.keyframeEngine.hasKeyframe(targetFrame)) {
                const kf = this.keyframeEngine.getKeyframe(targetFrame);
                if (kf) hCtx.drawImage(kf, 0, 0, 160, 90);
              }
            }
          });
        }
      }
    };

    const handleScrub = (e) => {
      const rect = this.timelineTrack.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const ratio = x / rect.width;
      const targetFrame = Math.round(ratio * (this.videoEngine.totalFrames - 1));
      this.videoEngine.seekFrame(targetFrame);
      updateHoverCard(e.clientX);
    };

    ['pointerenter', 'mouseenter'].forEach(evt => {
      this.timelineTrackContainer.addEventListener(evt, (e) => {
        if (this.videoEngine.isLoaded) updateHoverCard(e.clientX);
      });
      this.timelineTrack.addEventListener(evt, (e) => {
        if (this.videoEngine.isLoaded) updateHoverCard(e.clientX);
      });
    });

    ['pointermove', 'mousemove'].forEach(evt => {
      this.timelineTrackContainer.addEventListener(evt, (e) => {
        if (this.videoEngine.isLoaded) {
          if (isScrubbing) handleScrub(e);
          else updateHoverCard(e.clientX);
        }
      });
      this.timelineTrack.addEventListener(evt, (e) => {
        if (this.videoEngine.isLoaded) {
          if (isScrubbing) handleScrub(e);
          else updateHoverCard(e.clientX);
        }
      });
    });

    const startScrub = (e) => {
      isScrubbing = true;
      try {
        this.timelineTrackContainer.setPointerCapture(e.pointerId);
      } catch (err) {}

      // Stop any active playback
      if (this.videoEngine.isPlaying) this.videoEngine.pause();
      if (this.isPureAnimPlaying) this._stopPureAnimationPlayback();
      if (this.isStripPlaying || this.isAllStripsPlaying) this._stopStripPlaybacks();
      if (this.keyframeEngine.isAnimPlaying) {
        this.keyframeEngine.stopAnimation();
        this._updateFlipbookButtonState(false);
      }
      this._updatePlayButtonState(false);

      handleScrub(e);
    };

    this.timelineTrackContainer.addEventListener('pointerdown', startScrub);
    this.timelineTrack.addEventListener('pointerdown', startScrub);

    this.timelineTrackContainer.addEventListener('pointerup', (e) => {
      if (isScrubbing) {
        isScrubbing = false;
        try {
          this.timelineTrackContainer.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    });

    ['pointerleave', 'mouseleave'].forEach(evt => {
      this.timelineTrackContainer.addEventListener(evt, () => {
        if (!isScrubbing && this.timelineHoverCard) {
          this.timelineHoverCard.style.display = 'none';
        }
      });
    });

    // 9. Overlay Canvas Pointer Events (Drawing, Selection, Transform)
    this.overlayCanvas.addEventListener('pointerdown', (e) => this._onCanvasPointerDown(e));
    this.overlayCanvas.addEventListener('pointermove', (e) => this._onCanvasPointerMove(e));
    this.overlayCanvas.addEventListener('pointerup', (e) => this._onCanvasPointerUp(e));
    this.overlayCanvas.addEventListener('pointerleave', (e) => this._onCanvasPointerUp(e));

    // 10. Export Actions
    this.btnExportFrame.addEventListener('click', () => this._exportCurrentFrame());
    this.btnExportSequence.addEventListener('click', () => this._exportKeyframeSequence());

    // Modal backdrop click to close
    if (this.deleteStripModal) {
      this.deleteStripModal.addEventListener('click', (e) => {
        if (e.target === this.deleteStripModal) {
          this._closeDeleteStripModal();
        }
      });
    }

    // 12. Video Export Modal
    if (this.btnExportVideo) {
      this.btnExportVideo.addEventListener('click', () => {
        this._openExportVideoModal();
      });
    }

    if (this.btnCloseExportModal) {
      this.btnCloseExportModal.addEventListener('click', () => {
        this._closeExportVideoModal();
      });
    }

    if (this.btnCancelExport) {
      this.btnCancelExport.addEventListener('click', () => {
        this._closeExportVideoModal();
      });
    }

    if (this.btnStartExportVideo) {
      this.btnStartExportVideo.addEventListener('click', () => {
        this._startVideoExport();
      });
    }

    if (this.exportVideoModal) {
      this.exportVideoModal.addEventListener('click', (e) => {
        if (e.target === this.exportVideoModal) {
          this._closeExportVideoModal();
        }
      });
    }
  }

  _bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this._togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.ctrlKey) this.videoEngine.jumpSeconds(-1.0);
        else if (e.shiftKey) this.videoEngine.stepFrame(-5);
        else this._stepBySelectedUnit(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.ctrlKey) this.videoEngine.jumpSeconds(1.0);
        else if (e.shiftKey) this.videoEngine.stepFrame(5);
        else this._stepBySelectedUnit(1);
      } else if (e.code === 'BracketLeft') {
        if (e.shiftKey) this.videoEngine.stepFrame(-5);
        else this._stepBySelectedUnit(-1);
      } else if (e.code === 'BracketRight') {
        if (e.shiftKey) this.videoEngine.stepFrame(5);
        else this._stepBySelectedUnit(1);
      } else if (e.key === 'F11') {
        e.preventDefault();
        this._toggleFullscreen();
      } else if (e.key === 'b' || e.key === 'B') {
        this._setTool('brush');
      } else if (e.key === 'e' || e.key === 'E') {
        this._setTool('eraser');
      } else if (e.key === 'l' || e.key === 'L') {
        this._setTool('lasso');
      } else if (e.key === 't' || e.key === 'T') {
        this._triggerTransform();
      } else if (!e.ctrlKey && !e.metaKey && (e.key === 'z' || e.key === 'Z')) {
        this._setTool('zoom');
      } else if (e.key === 'h' || e.key === 'H') {
        this._setTool('pan');
      } else if (e.key === '0') {
        this.viewportEngine.resetView(true);
      } else if (e.key === 'Enter') {
        if (this.transformEngine.isActive) this._commitTransform();
      } else if (e.key === 'Escape') {
        if (this.transformEngine.isActive) this._cancelTransform();
        else this.selectionEngine.clear();
      } else if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        this.keyframeEngine.undo(this.videoEngine.currentFrame, this.drawingCanvas);
        this._renderOnionSkin(this.videoEngine.currentFrame);
      } else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        this.keyframeEngine.redo(this.videoEngine.currentFrame, this.drawingCanvas);
        this._renderOnionSkin(this.videoEngine.currentFrame);
      } else if (e.key === 'o' || e.key === 'O') {
        this.btnToggleOnionSkin.click();
      }
    });
  }

  async loadSampleVideo() {
    this.btnLoadSample.disabled = true;
    this.btnLoadSample.innerHTML = '<span class="icon">⏳</span> 샘플 로드 중...';
    try {
      await this.videoEngine.loadVideo('./sample.mp4');
    } catch (err) {
      console.warn('Direct ./sample.mp4 load failed, falling back:', err);
      try {
        const sampleBlobUrl = await createSampleVideoBlob(this.fps, 5);
        await this.videoEngine.loadVideo(sampleBlobUrl);
      } catch (e2) {
        console.error('Failed to generate sample video:', e2);
      }
    } finally {
      this.btnLoadSample.disabled = false;
      this.btnLoadSample.innerHTML = '<span class="icon">✨</span> 샘플 액션 영상 로드';
    }
  }

  _setColor(color) {
    this.brushEngine.setColor(color);
    this.brushPreviewDot.style.backgroundColor = color;
    this.brushPreviewDot.style.boxShadow = `0 0 10px ${color}`;
  }

  _setTool(tool) {
    this.currentTool = tool;

    // Independent tool size applied to brushEngine
    if (tool === 'brush') {
      this.brushEngine.setTool('brush');
      this.brushEngine.setSize(this.penSize);
    } else if (tool === 'eraser') {
      this.brushEngine.setTool('eraser');
      this.brushEngine.setSize(this.eraserSize);
    }

    // UI Buttons active states
    if (this.toolBrush) this.toolBrush.classList.toggle('active', tool === 'brush');
    if (this.toolEraser) this.toolEraser.classList.toggle('active', tool === 'eraser');
    if (this.toolLasso) this.toolLasso.classList.toggle('active', tool === 'lasso');
    if (this.toolTransform) this.toolTransform.classList.toggle('active', tool === 'transform');
    if (this.toolZoom) this.toolZoom.classList.toggle('active', tool === 'zoom');
    if (this.toolPan) this.toolPan.classList.toggle('active', tool === 'pan');

    // Canvas cursor styling
    if (this.overlayCanvas) {
      if (tool === 'zoom') {
        this.overlayCanvas.style.cursor = 'zoom-in';
      } else if (tool === 'pan') {
        this.overlayCanvas.style.cursor = 'grab';
      } else if (tool === 'brush' || tool === 'eraser' || tool === 'lasso') {
        this.overlayCanvas.style.cursor = 'crosshair';
      } else {
        this.overlayCanvas.style.cursor = 'default';
      }
    }

    if (tool !== 'transform' && this.transformEngine.isActive) {
      this._commitTransform();
    }

    if (this.transformActionGroup) {
      this.transformActionGroup.style.display = (tool === 'transform' || this.transformEngine.isActive) ? 'flex' : 'none';
    }
  }

  _triggerTransform() {
    if (!this.selectionEngine.isActive) {
      alert('변형할 영역이 선택되지 않았습니다. 먼저 [올가미 선택(L)] 툴로 변형할 드로잉 영역을 둘러싸주세요!');
      this._setTool('lasso');
      return;
    }

    this._setTool('transform');
    // Extract selected graphics into floating buffer and clear original from drawing canvas
    const buffer = this.selectionEngine.extractFromCanvas(this.drawingCanvas, true);
    if (buffer) {
      this.transformEngine.startTransform(buffer, this.selectionEngine.bounds);
      this.transformActionGroup.style.display = 'flex';
    }
  }

  _commitTransform() {
    if (this.transformEngine.isActive) {
      this.transformEngine.commit(this.drawingCanvas);
      this.selectionEngine.clear();
      this.transformActionGroup.style.display = 'none';

      // Sync to keyframe storage
      const currentFrame = this.videoEngine.currentFrame;
      const kf = this.keyframeEngine.getKeyframe(currentFrame, true);
      kf.getContext('2d').clearRect(0, 0, this.width, this.height);
      kf.getContext('2d').drawImage(this.drawingCanvas, 0, 0);

      this.keyframeEngine.saveSnapshotForUndo(currentFrame, this.drawingCanvas);
      this._renderOnionSkin(currentFrame);
      this._renderKeyframeFilmstrip(this.keyframeEngine.getKeyframeIndices());
      this._setTool('brush');
    }
  }

  _cancelTransform() {
    if (this.transformEngine.isActive) {
      this.selectionEngine.restoreSource(this.drawingCanvas);
      this.transformEngine.cancel();
      this.transformActionGroup.style.display = 'none';
      this._setTool('brush');
    }
  }

  _getCanvasCoordinates(e) {
    const rect = this.overlayCanvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;

    // Accurate stylus hardware pressure extraction
    let pressure = 0.5;
    if (typeof e.pressure === 'number') {
      pressure = e.pressure;
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure,
      pointerType: e.pointerType || 'mouse'
    };
  }

  _onCanvasPointerDown(e) {
    e.preventDefault();

    // Capture pointer so strokes continue smoothly even if moving quickly
    try {
      this.overlayCanvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    // Viewport Zoom tool drag interaction
    if (this.currentTool === 'zoom') {
      this.isZoomDragging = true;
      this.zoomStartClientY = e.clientY;
      this.zoomStartClientX = e.clientX;
      this.zoomInitialScale = this.viewportEngine.zoom;
      this.zoomDragMoved = false;
      return;
    }

    // Viewport Pan tool drag interaction
    if (this.currentTool === 'pan') {
      this.isPanDragging = true;
      this.panStartClientX = e.clientX;
      this.panStartClientY = e.clientY;
      this.panInitialX = this.viewportEngine.panX;
      this.panInitialY = this.viewportEngine.panY;
      this.overlayCanvas.style.cursor = 'grabbing';
      return;
    }

    const coords = this._getCanvasCoordinates(e);

    // Update detected hardware indicator
    if (this.penDeviceType) {
      if (coords.pointerType === 'pen') {
        this.penDeviceType.innerText = '와콤 펜 감지됨';
        this.penDeviceType.classList.add('pen-active');
      } else {
        this.penDeviceType.innerText = '마우스 입력';
        this.penDeviceType.classList.remove('pen-active');
      }
    }

    if (this.currentTool === 'transform' || this.transformEngine.isActive) {
      this.transformEngine.handlePointerDown(coords.x, coords.y);
    } else if (this.currentTool === 'lasso') {
      this.selectionEngine.startSelection(coords.x, coords.y);
    } else {
      // Wacom Brush or Eraser
      this.brushEngine.startStroke(this.dCtx, coords.x, coords.y, coords.pressure, coords.pointerType);
    }
  }

  _onCanvasPointerMove(e) {
    e.preventDefault();

    if (this.currentTool === 'zoom' && this.isZoomDragging) {
      const dy = this.zoomStartClientY - e.clientY;
      if (Math.abs(dy) > 3) this.zoomDragMoved = true;
      const delta = (dy / 150) * 1.5;
      this.viewportEngine.zoomAt(this.zoomStartClientX, this.zoomStartClientY, this.zoomInitialScale + delta, false);
      return;
    }

    if (this.currentTool === 'pan' && this.isPanDragging) {
      const dx = e.clientX - this.panStartClientX;
      const dy = e.clientY - this.panStartClientY;
      this.viewportEngine.setPan(this.panInitialX + dx, this.panInitialY + dy, false);
      return;
    }

    if (this.currentTool === 'transform' || this.transformEngine.isActive) {
      const coords = this._getCanvasCoordinates(e);
      this.transformEngine.handlePointerMove(coords.x, coords.y);
      return;
    }

    if (this.currentTool === 'lasso') {
      const coords = this._getCanvasCoordinates(e);
      this.selectionEngine.continueSelection(coords.x, coords.y);
      return;
    }

    // High-frequency Wacom Coalesced Events loop
    // Wacom tablets fire at 133Hz~200Hz+. getCoalescedEvents() captures all sub-frame points!
    const events = (typeof e.getCoalescedEvents === 'function')
      ? e.getCoalescedEvents()
      : [e];

    for (let i = 0; i < events.length; i++) {
      const subCoords = this._getCanvasCoordinates(events[i]);
      this.brushEngine.continueStroke(this.dCtx, subCoords.x, subCoords.y, subCoords.pressure, subCoords.pointerType);
    }
  }

  _onCanvasPointerUp(e) {
    e.preventDefault();

    try {
      this.overlayCanvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (this.currentTool === 'zoom' && this.isZoomDragging) {
      this.isZoomDragging = false;
      if (!this.zoomDragMoved) {
        // Simple click without dragging: Zoom In by +0.25x (or Zoom Out on Alt-click)
        const delta = e.altKey ? -0.25 : 0.25;
        this.viewportEngine.zoomByAt(e.clientX, e.clientY, delta, true);
      }
      return;
    }

    if (this.currentTool === 'pan') {
      this.isPanDragging = false;
      this.overlayCanvas.style.cursor = 'grab';
      return;
    }

    if (this.currentTool === 'transform' || this.transformEngine.isActive) {
      this.transformEngine.handlePointerUp();
    } else if (this.currentTool === 'lasso') {
      this.selectionEngine.endSelection();
    } else {
      this.brushEngine.endStroke(this.dCtx);
    }
  }

  _syncDrawingLayerForFrame(frameIndex, isPlaying = false) {
    this.dCtx.clearRect(0, 0, this.width, this.height);

    if (isPlaying) {
      // In PLAYBACK mode: always hold drawings until next keyframe during pure animation or when holdDrawing is checked
      const hold = this.isPureAnimPlaying ? true : (this.chkHoldDrawing ? this.chkHoldDrawing.checked : true);
      const drawing = this.keyframeEngine.getDrawingForPlayback(frameIndex, hold);
      if (drawing) {
        this.dCtx.drawImage(drawing, 0, 0);
      }
    } else {
      // In EDIT / SCRUB / PAUSED mode:
      // STRICT FRAME ISOLATION:
      // Only show drawing if this EXACT frame has a keyframe.
      // If it doesn't, leave canvas completely BLANK so the artist can draw fresh!
      const drawing = this.keyframeEngine.getDrawingForEdit(frameIndex);
      if (drawing) {
        this.dCtx.drawImage(drawing, 0, 0);
      }
    }
  }

  _renderCurrentFrameToCanvas() {
    this.vCtx.clearRect(0, 0, this.width, this.height);
    if (!this.soloAnimationMode && this.showVideo) {
      this.videoEngine.drawFrame(this.vCtx, this.width, this.height);
    }
  }

  _renderOnionSkin(frameIndex) {
    // Hide onion skin during active playback for clean visual review
    if (this.videoEngine.isPlaying || this.isPureAnimPlaying || this.keyframeEngine.isAnimPlaying) {
      this.oCtx.clearRect(0, 0, this.width, this.height);
      return;
    }
    this.keyframeEngine.renderOnionSkin(this.oCtx, frameIndex);
  }

  _togglePlay() {
    // If in solo animation mode, Space bar toggles pure animation loop!
    if (this.soloAnimationMode) {
      this._togglePureAnimationPlayback();
      return;
    }

    // If pure animation was running, stop it
    if (this.isPureAnimPlaying) {
      this._stopPureAnimationPlayback();
      return;
    }

    if (this.keyframeEngine.isAnimPlaying) {
      this.keyframeEngine.stopAnimation();
      this._updateFlipbookButtonState(false);
    }

    const isPlaying = this.videoEngine.togglePlay();
    this._updatePlayButtonState(isPlaying);
  }

  _togglePureAnimationPlayback() {
    if (this.isPureAnimPlaying) {
      this._stopPureAnimationPlayback();
      return;
    }

    const indices = this.keyframeEngine.getKeyframeIndices();
    if (indices.length === 0) {
      alert('아직 그려진 키프레임이 없습니다!\n\n비디오 위의 원하는 프레임에서 그림을 그린 후 [🎨 순수 애니메이션]을 눌러보세요.');
      return;
    }

    // Stop native video playback if active
    this.videoEngine.pause();
    this._updatePlayButtonState(false);
    if (this.keyframeEngine.isAnimPlaying) {
      this.keyframeEngine.stopAnimation();
    }

    this.isPureAnimPlaying = true;
    if (this.btnPlayPureAnim) {
      this.btnPlayPureAnim.classList.add('active');
      this.btnPlayPureAnim.innerHTML = '<span class="t-icon">⏸</span> 애니메이션 정지';
    }
    this._updateFlipbookButtonState(true);

    // Determine the animation loop range:
    // Loops strictly across the drawn section [minKeyframe, maxKeyframe + holdFrames]
    const minKeyframe = Math.min(...indices);
    const maxKeyframe = Math.max(...indices);
    // Natural hold duration for the final drawing (e.g. 6 frames at 24fps = 0.25s)
    const holdFrames = Math.max(3, Math.round(this.fps / 4));
    const startFrame = minKeyframe;
    const endFrame = maxKeyframe + holdFrames;

    // Show crisp white paper background so drawings NEVER appear over pitch-black background!
    this.videoCanvas.style.opacity = '1';
    this.vCtx.clearRect(0, 0, this.width, this.height);
    this.vCtx.fillStyle = '#ffffff'; // White Sketchbook Paper
    this.vCtx.fillRect(0, 0, this.width, this.height);

    this.stageModeBadge.style.display = 'block';
    this.stageModeBadge.innerText = `🎨 순수 애니메이션 (${startFrame}f ~ ${endFrame}f 구간 반복)`;

    this.keyframeEngine.startAnimation(
      startFrame,
      endFrame,
      (frame) => {
        this.videoEngine.currentFrame = frame;
        this._updateTimecodeDisplay(frame);
        this._updatePlayhead(frame);

        // Always render clean white paper background behind drawings
        this.vCtx.fillStyle = '#ffffff';
        this.vCtx.fillRect(0, 0, this.width, this.height);

        // Render drawings with hold for intermediate frames
        this._syncDrawingLayerForFrame(frame, true);
        this._renderOnionSkin(frame);
        this._highlightFilmstripThumb(frame);
      },
      this.fps,
      this.playbackSpeed
    );
  }

  _stopPureAnimationPlayback() {
    this.isPureAnimPlaying = false;
    this.keyframeEngine.stopAnimation();

    if (this.btnPlayPureAnim) {
      this.btnPlayPureAnim.classList.remove('active');
      this.btnPlayPureAnim.innerHTML = '<span class="t-icon">🎨</span> 순수 애니메이션';
    }
    this._updateFlipbookButtonState(false);

    this.stageModeBadge.style.display = this.soloAnimationMode ? 'block' : 'none';
    this.stageModeBadge.innerText = '🎨 단독 애니메이션 감상 모드';
    this.videoCanvas.style.opacity = (!this.soloAnimationMode && this.showVideo) ? this.videoOpacity : '0';
    this._renderCurrentFrameToCanvas();

    this._syncDrawingLayerForFrame(this.videoEngine.currentFrame, false);
    this._renderOnionSkin(this.videoEngine.currentFrame);
  }

  _setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    this.videoEngine.setPlaybackRate(speed);

    // If pure animation is playing, restart with new speed
    if (this.isPureAnimPlaying) {
      this._stopPureAnimationPlayback();
      this._togglePureAnimationPlayback();
    }
  }

  _toggleKeyframesOnlyPlayback() {
    // Synchronize flipbook buttons directly with pure animation playback!
    // This ensures that when the user clicks '그린 키프레임만 모아보기' or '플립북 모아보기',
    // it loops across the drawn range holding intermediate frames rather than skipping them!
    this._togglePureAnimationPlayback();
  }

  _updateFlipbookButtonState(isPlaying) {
    if (this.btnPlayKeyframesOnly) {
      this.btnPlayKeyframesOnly.classList.toggle('active-playing', isPlaying);
      if (this.flipbookBtnText) {
        this.flipbookBtnText.innerText = isPlaying ? '플립북 정지' : '그린 키프레임만 모아보기';
      }
    }
    if (this.btnPlayKeyframesTransport) {
      this.btnPlayKeyframesTransport.classList.toggle('active-playing', isPlaying);
      this.btnPlayKeyframesTransport.innerHTML = isPlaying
        ? '<span class="t-icon">⏸</span> 플립북 정지'
        : '<span class="t-icon">⚡</span> 플립북 모아보기';
    }
  }

  _updatePlayButtonState(isPlaying) {
    if (this.btnPlayPause) {
      if (this.playPauseIcon) {
        this.playPauseIcon.innerText = isPlaying ? '⏸' : '▶';
      }
      if (this.playPauseText) {
        this.playPauseText.innerText = isPlaying ? '정지' : '재생';
      }
      if (isPlaying) {
        this.btnPlayPause.classList.add('playing');
        this.btnPlayPause.title = '동영상 일시정지 (Space)';
      } else {
        this.btnPlayPause.classList.remove('playing');
        this.btnPlayPause.title = '동영상 재생 (Space)';
      }
    }

    if (!isPlaying) {
      // In edit/paused mode, revert to strict frame isolation!
      this._syncDrawingLayerForFrame(this.videoEngine.currentFrame, false);
      this._renderOnionSkin(this.videoEngine.currentFrame);
    }
  }

  _updateTimecodeDisplay(frame) {
    this.displayFrameNumber.innerText = frame;
    const time = frame / this.fps;
    this.displayCurrentTime.innerText = this._formatTime(time);
  }

  _updatePlayhead(frame) {
    if (this.videoEngine.totalFrames <= 0) return;
    const pct = (frame / (this.videoEngine.totalFrames - 1)) * 100;
    this.timelinePlayhead.style.left = `${Math.min(100, Math.max(0, pct))}%`;
  }

  _formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  _buildTimelineRuler(totalFrames) {
    this.timelineRuler.innerHTML = '';
    const step = totalFrames > 150 ? 24 : (totalFrames > 60 ? 12 : 6);

    for (let f = 0; f < totalFrames; f += step) {
      const pct = (f / (totalFrames - 1)) * 100;
      const tick = document.createElement('div');
      tick.className = 'ruler-tick' + (f % (this.fps) === 0 ? ' major' : '');
      tick.style.left = `${pct}%`;

      if (f % (this.fps) === 0) {
        const label = document.createElement('span');
        label.className = 'ruler-label';
        label.innerText = `${f}f`;
        tick.appendChild(label);
      }

      this.timelineRuler.appendChild(tick);
    }
  }

  _renderKeyframeMarkers(indices) {
    this.keyframeMarkers.innerHTML = '';
    const total = this.videoEngine.totalFrames || 1;

    for (const f of indices) {
      const pct = (f / (total - 1)) * 100;
      const pin = document.createElement('div');
      pin.className = 'kf-pin';
      pin.style.left = `${pct}%`;
      pin.title = `키프레임: 프레임 ${f} (클릭하여 이동)`;
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.videoEngine.seekFrame(f);
      });
      this.keyframeMarkers.appendChild(pin);
    }
  }

  _renderKeyframeChips(indices) {
    if (this.keyframeCountBadge) {
      this.keyframeCountBadge.innerText = `${indices.length} 프레임`;
    }
    if (!this.keyframeChipList) return;
    if (indices.length === 0) {
      this.keyframeChipList.innerHTML = '<span class="empty-hint">등록된 키프레임이 없습니다. 비디오 위에 그림을 그려보세요!</span>';
      return;
    }

    this.keyframeChipList.innerHTML = '';
    for (const f of indices) {
      const chip = document.createElement('button');
      chip.className = 'keyframe-chip' + (f === this.videoEngine.currentFrame ? ' active' : '');
      chip.innerText = `#${f}`;
      chip.title = `프레임 ${f}로 이동`;
      chip.addEventListener('click', () => this.videoEngine.seekFrame(f));
      this.keyframeChipList.appendChild(chip);
    }
  }

  _renderKeyframeFilmstrip(indices = null) {
    if (!this.filmstripScroll) return;
    if (!indices) {
      indices = this.keyframeEngine.getKeyframeIndices();
    }

    this._renderTimelineStripRanges();
    if (this.frameBrowserModal && this.frameBrowserModal.style.display !== 'none') {
      this._renderFrameBrowserModal();
    }

    const strips = this.stripEngine.getStrips();

    if (this.stripCountBadge) {
      this.stripCountBadge.innerText = `${strips.length}개 스트립`;
    }
    if (this.filmstripCountBadge) {
      this.filmstripCountBadge.innerText = `${indices.length}개 프레임`;
    }

    // If completely empty (no strips and no frames)
    if (strips.length === 0 && indices.length === 0) {
      this.filmstripScroll.innerHTML = '<div class="filmstrip-placeholder">✏️ 비디오 위에 그림을 그리면 스트립 구간과 내가 그린 순수 그림 썸네일들이 정렬되어 표시됩니다.</div>';
      return;
    }

    this.filmstripScroll.innerHTML = '';
    const currentFrame = this.videoEngine.currentFrame;

    // Render each strip as its own card with its thumbnails inside!
    for (const strip of strips) {
      const isActive = (strip.id === this.stripEngine.activeStripId);
      const isPlayingThis = (this.isStripPlaying && this.playingStripId === strip.id);
      const count = strip.frameIndices ? strip.frameIndices.size : 0;
      const rangeText = (strip.startFrame !== null && strip.endFrame !== null)
        ? `${strip.startFrame}f ~ ${strip.endFrame}f · 총 ${count}장`
        : '대기 중 (그림 그리면 시작)';

      const card = document.createElement('div');
      card.className = `strip-group-card ${isActive ? 'active' : ''} ${isPlayingThis ? 'playing' : ''}`;
      card.style.setProperty('--strip-color', strip.color);

      // 1. Strip Header: Title, range, mini play/pause, mini delete
      const header = document.createElement('div');
      header.className = 'strip-group-header';
      header.innerHTML = `
        <div class="strip-group-info">
          <span class="strip-color-dot" style="background: ${strip.color};"></span>
          <strong class="strip-group-title">${strip.name}</strong>
          <span class="strip-group-range">(${rangeText})</span>
        </div>
        <div class="strip-group-tools">
          <button class="btn-strip-card-play ${isPlayingThis ? 'playing' : ''}" title="${isPlayingThis ? '정지' : '이 스트립 구간만 손그림 반복 재생'}">
            ${isPlayingThis ? '⏸ 정지' : '▶ 재생'}
          </button>
          <button class="btn-strip-card-delete" title="${strip.name} 및 포함된 프레임 삭제">✕</button>
        </div>
      `;

      const btnPlay = header.querySelector('.btn-strip-card-play');
      if (btnPlay) {
        btnPlay.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleStripPlayback(strip.id);
        });
      }

      const btnDelete = header.querySelector('.btn-strip-card-delete');
      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openDeleteStripModalFor(strip.id);
        });
      }

      card.appendChild(header);

      // 2. Thumbnails Row: Pure drawings (NO VIDEO!)
      const thumbsRow = document.createElement('div');
      thumbsRow.className = 'strip-thumbs-row';

      if (count === 0) {
        const hint = document.createElement('span');
        hint.className = 'strip-empty-hint';
        hint.innerText = '✨ 대기 중: 원하는 프레임으로 이동하여 그림을 그리면 이 스트립에 등록됩니다.';
        thumbsRow.appendChild(hint);
      } else {
        const stripFrames = Array.from(strip.frameIndices).sort((a, b) => a - b);
        for (const f of stripFrames) {
          const thumbItem = document.createElement('div');
          thumbItem.className = 'filmstrip-thumb' + (f === currentFrame ? ' active' : '');
          thumbItem.setAttribute('data-frame', f);
          thumbItem.title = `${strip.name}: 프레임 #${f} 이동 (클릭)`;

          // Canvas 88x50
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.className = 'filmstrip-canvas';
          thumbCanvas.width = 88;
          thumbCanvas.height = 50;
          const tCtx = thumbCanvas.getContext('2d');

          // PURE DRAWING ONLY: Crisp white sketchbook paper background, NO VIDEO!
          tCtx.fillStyle = '#ffffff';
          tCtx.fillRect(0, 0, 88, 50);

          const kfCanvas = this.keyframeEngine.getKeyframe(f);
          if (kfCanvas) {
            tCtx.drawImage(kfCanvas, 0, 0, 88, 50);
          }

          thumbItem.appendChild(thumbCanvas);

          // Tag badge
          const tag = document.createElement('span');
          tag.className = 'filmstrip-tag';
          tag.innerText = `#${f}f`;
          thumbItem.appendChild(tag);

          // Click handler to seek to frame & activate strip
          thumbItem.addEventListener('click', () => {
            if (this.isFilmstripDraggingMoved) return;
            this.stripEngine.setActiveStrip(strip.id);
            this.videoEngine.seekFrame(f);
          });

          thumbsRow.appendChild(thumbItem);
        }
      }

      card.appendChild(thumbsRow);
      this.filmstripScroll.appendChild(card);
    }
  }

  // ==========================================================================
  // Strip Playback & Deletion Methods
  // ==========================================================================

  _renderFrameForPlayback(frame) {
    this.videoEngine.currentFrame = frame;
    this._updateTimecodeDisplay(frame);
    this._updatePlayhead(frame);

    // PURE HAND-DRAWN ANIMATION PLAYBACK:
    // Video is COMPLETELY HIDDEN so artist can cleanly evaluate their drawn motion!
    this.videoCanvas.style.opacity = '0';
    this.vCtx.fillStyle = '#ffffff'; // White sketchbook paper
    this.vCtx.fillRect(0, 0, this.width, this.height);

    // Sync drawing layer with hold exposure
    this._syncDrawingLayerForFrame(frame, true);
    this._renderOnionSkin(frame);
    this._highlightFilmstripThumb(frame);
  }

  _toggleStripPlayback(stripId) {
    if (this.isStripPlaying && this.playingStripId === stripId) {
      this._stopStripPlaybacks();
      return;
    }

    const strip = this.stripEngine.getStrips().find(s => s.id === stripId);
    if (!strip || strip.frameIndices.size === 0 || strip.startFrame === null) {
      alert('선택한 스트립에 아직 그려진 그림이 없습니다!\n\n해당 스트립 구간에서 먼저 그림을 그려주세요.');
      return;
    }

    // Stop all other playbacks
    this.videoEngine.pause();
    this._updatePlayButtonState(false);
    if (this.isPureAnimPlaying) this._stopPureAnimationPlayback();
    if (this.isAllStripsPlaying) this._stopStripPlaybacks();
    if (this.isStripPlaying) this._stopStripPlaybacks();

    this.isStripPlaying = true;
    this.playingStripId = strip.id;
    this.stripEngine.setActiveStrip(strip.id);

    const holdFrames = Math.max(2, Math.round(this.fps / 6));
    const sequence = this.stripEngine.getStripPlaybackSequence(strip.id, holdFrames);
    if (sequence.length === 0) {
      this.isStripPlaying = false;
      this.playingStripId = null;
      return;
    }

    this.stageModeBadge.style.display = 'block';
    this.stageModeBadge.innerText = `🎬 ${strip.name} 손그림 반복 재생 (${strip.startFrame}f ~ ${strip.endFrame}f)`;

    this._renderKeyframeFilmstrip();

    this.keyframeEngine.startSequenceAnimation(
      sequence,
      (frame) => {
        this._renderFrameForPlayback(frame);
      },
      this.fps,
      this.playbackSpeed
    );
  }

  _toggleAllStripsPlayback() {
    if (this.isAllStripsPlaying) {
      this._stopStripPlaybacks();
      return;
    }

    const holdFrames = Math.max(2, Math.round(this.fps / 6));
    const sequence = this.stripEngine.getAllStripsPlaybackSequence(holdFrames);
    if (sequence.length === 0) {
      alert('재생할 애니메이션 스트립이 없습니다!\n\n스트립을 생성하고 그림을 그린 후 [⏩ 전체 스트립 재생]을 눌러보세요.');
      return;
    }

    // Stop all other playbacks
    this.videoEngine.pause();
    this._updatePlayButtonState(false);
    if (this.isPureAnimPlaying) this._stopPureAnimationPlayback();
    if (this.isStripPlaying) this._stopStripPlaybacks();

    this.isAllStripsPlaying = true;
    this.playingStripId = null;

    if (this.btnPlayAllStrips) {
      this.btnPlayAllStrips.classList.add('active-playing');
      this.btnPlayAllStrips.innerHTML = '<span class="tb-icon-text">⏸</span>';
      this.btnPlayAllStrips.title = '전체 스트립 연속 재생 정지';
    }

    const strips = this.stripEngine.getStrips().filter(s => s.frameIndices.size > 0);
    this.stageModeBadge.style.display = 'block';
    this.stageModeBadge.innerText = `🎬 전 스트립(${strips.length}개 구간) 손그림 연속 재생 (빈 구간 건너뛰기)`;

    this._renderKeyframeFilmstrip();

    this.keyframeEngine.startSequenceAnimation(
      sequence,
      (frame) => {
        this._renderFrameForPlayback(frame);

        const curStrip = this.stripEngine.findStripForFrame(frame);
        if (curStrip && curStrip.id !== this.stripEngine.activeStripId) {
          this.stripEngine.setActiveStrip(curStrip.id);
        }
      },
      this.fps,
      this.playbackSpeed
    );
  }

  _stopStripPlaybacks() {
    this.isStripPlaying = false;
    this.isAllStripsPlaying = false;
    this.playingStripId = null;
    this.keyframeEngine.stopAnimation();

    if (this.btnPlayAllStrips) {
      this.btnPlayAllStrips.classList.remove('active-playing');
      this.btnPlayAllStrips.innerHTML = '<span class="tb-icon-text">⏩</span>';
      this.btnPlayAllStrips.title = '비디오는 끄고 오직 내가 그린 손그림들만 빈 구간을 건너뛰고 연속 재생합니다.';
    }

    if (!this.soloAnimationMode && !this.isPureAnimPlaying) {
      this.stageModeBadge.style.display = 'none';
      this.videoCanvas.style.opacity = this.showVideo ? this.videoOpacity : '0';
      this._renderCurrentFrameToCanvas();
    }

    this._syncDrawingLayerForFrame(this.videoEngine.currentFrame, false);
    this._renderOnionSkin(this.videoEngine.currentFrame);
    this._renderKeyframeFilmstrip();
  }

  _openDeleteStripModalFor(stripId) {
    const strips = this.stripEngine.getStrips();
    const strip = strips.find(s => s.id === stripId);
    if (!strip) return;

    this.stripToDeleteId = stripId;
    if (this.deleteStripTargetTitle) {
      const count = strip.frameIndices ? strip.frameIndices.size : 0;
      const rangeText = (strip.startFrame !== null && strip.endFrame !== null)
        ? `${strip.startFrame}f ~ ${strip.endFrame}f, 총 ${count}개 키프레임`
        : '대기 중 (그려진 그림 없음)';
      this.deleteStripTargetTitle.innerText = `${strip.name} (${rangeText})`;
    }
    if (this.deleteStripModal) {
      this.deleteStripModal.style.display = 'flex';
    }
  }

  _closeDeleteStripModal() {
    this.stripToDeleteId = null;
    if (this.deleteStripModal) {
      this.deleteStripModal.style.display = 'none';
    }
  }

  _confirmDeleteStrip() {
    if (!this.stripToDeleteId) return;

    this._stopStripPlaybacks();

    const deletedFrames = this.stripEngine.deleteStrip(this.stripToDeleteId);
    this.keyframeEngine.deleteFrames(deletedFrames);

    if (deletedFrames.includes(this.videoEngine.currentFrame)) {
      this.dCtx.clearRect(0, 0, this.width, this.height);
    }

    this._renderOnionSkin(this.videoEngine.currentFrame);
    const indices = this.keyframeEngine.getKeyframeIndices();
    this._renderKeyframeMarkers(indices);
    this._renderKeyframeChips(indices);
    this._renderKeyframeFilmstrip(indices);

    this._closeDeleteStripModal();
  }

  _highlightFilmstripThumb(frame) {
    const thumbs = this.filmstripScroll.querySelectorAll('.filmstrip-thumb');
    thumbs.forEach(t => {
      const f = parseInt(t.getAttribute('data-frame'), 10);
      const isMatch = (f === frame);
      t.classList.toggle('active', isMatch);
      if (isMatch && !this.isFilmstripDraggingMoved) {
        t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    });
  }

  _bindFilmstripDragScroll() {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    this.filmstripScroll.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left mouse button drag
      isDown = true;
      this.isFilmstripDraggingMoved = false;
      startX = e.pageX - this.filmstripScroll.offsetLeft;
      scrollLeft = this.filmstripScroll.scrollLeft;
      this.filmstripScroll.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const x = e.pageX - this.filmstripScroll.offsetLeft;
      const walk = (x - startX) * 1.3;
      if (Math.abs(walk) > 4) {
        this.isFilmstripDraggingMoved = true;
      }
      this.filmstripScroll.scrollLeft = scrollLeft - walk;
    });

    window.addEventListener('mouseup', () => {
      if (isDown) {
        isDown = false;
        this.filmstripScroll.classList.remove('dragging');
        setTimeout(() => {
          this.isFilmstripDraggingMoved = false;
        }, 60);
      }
    });

    // Support horizontal wheel scrolling
    this.filmstripScroll.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        this.filmstripScroll.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  _startRenderLoop() {
    this.lastSyncedFrame = -1;

    const render = () => {
      // 1. Continuous smooth video + drawing synchronization during playback
      if (this.videoEngine.isPlaying && this.videoEngine.isLoaded) {
        // Render video frame onto video canvas
        if (!this.soloAnimationMode && this.showVideo) {
          this.vCtx.clearRect(0, 0, this.width, this.height);
          this.videoEngine.drawFrame(this.vCtx, this.width, this.height);
        }

        // Loop handling when approaching video end
        if (this.chkLoop && this.chkLoop.checked && this.videoEngine.video.currentTime >= this.videoEngine.duration - 0.05) {
          this.videoEngine.video.currentTime = 0;
        }

        const currentFrame = Math.min(
          this.videoEngine.totalFrames - 1,
          Math.max(0, Math.round(this.videoEngine.video.currentTime * this.videoEngine.fps))
        );

        if (currentFrame !== this.lastSyncedFrame) {
          this.videoEngine.currentFrame = currentFrame;
          this._updateTimecodeDisplay(currentFrame);
          this._updatePlayhead(currentFrame);
          this._syncDrawingLayerForFrame(currentFrame, true);
          this._renderOnionSkin(currentFrame);
          this._highlightFilmstripThumb(currentFrame);
          this.lastSyncedFrame = currentFrame;
        }
      }

      this.ovCtx.clearRect(0, 0, this.width, this.height);

      // 2. Render Marching Ants if Lasso selection active
      if (this.selectionEngine.isSelecting || (this.selectionEngine.isActive && !this.transformEngine.isActive)) {
        this.selectionEngine.renderMarchingAnts(this.ovCtx);
      }

      // 3. Render Transform Gizmo & Preview if Transform active
      if (this.transformEngine.isActive) {
        this.transformEngine.render(this.ovCtx);
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  _openExportVideoModal() {
    const indices = this.keyframeEngine.getKeyframeIndices();
    if (indices.length === 0) {
      alert('내보낼 키프레임이 없습니다. 먼저 프레임 위에 그림을 그려주세요!');
      return;
    }
    if (this.exportVideoModal) {
      this.exportVideoModal.style.display = 'flex';
      if (this.exportProgressBar) this.exportProgressBar.style.display = 'none';
      if (this.btnStartExportVideo) this.btnStartExportVideo.disabled = false;
    }
  }

  _closeExportVideoModal() {
    if (this.exportVideoModal) {
      this.exportVideoModal.style.display = 'none';
    }
  }

  async _startVideoExport() {
    const modeInput = document.querySelector('input[name="exportMode"]:checked');
    const mode = modeInput ? modeInput.value : 'pure'; // 'pure' | 'composite'
    const bgColor = this.exportBgColor ? this.exportBgColor.value : '#0f172a';

    if (this.btnStartExportVideo) this.btnStartExportVideo.disabled = true;
    if (this.exportProgressBar) this.exportProgressBar.style.display = 'block';
    if (this.exportProgressFill) this.exportProgressFill.style.width = '0%';
    if (this.exportProgressText) this.exportProgressText.innerText = '인코딩 준비 중...';

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.width;
    exportCanvas.height = this.height;
    const eCtx = exportCanvas.getContext('2d');

    const fps = this.fps || 24;
    const totalFrames = this.videoEngine.totalFrames || 120;

    let mimeType = 'video/webm; codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm; codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    const stream = exportCanvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 3500000
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordPromise = new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob);
      };
    });

    recorder.start();

    // Render frame-by-frame
    const frameDelay = 1000 / fps;
    for (let f = 0; f < totalFrames; f++) {
      eCtx.clearRect(0, 0, this.width, this.height);

      if (mode === 'composite' && this.videoEngine.isLoaded) {
        // Draw video background
        this.videoEngine.seekFrame(f);
        await new Promise(r => setTimeout(r, 20));
        this.videoEngine.drawFrame(eCtx, this.width, this.height);
      } else if (mode === 'pure' && bgColor !== 'transparent') {
        // Draw solid canvas background
        eCtx.fillStyle = bgColor;
        eCtx.fillRect(0, 0, this.width, this.height);
      }

      // Draw keyframe artwork (with hold exposure)
      const drawing = this.keyframeEngine.getDrawingForPlayback(f, true);
      if (drawing) {
        eCtx.drawImage(drawing, 0, 0);
      }

      // Update progress
      const pct = Math.round(((f + 1) / totalFrames) * 100);
      if (this.exportProgressFill) this.exportProgressFill.style.width = `${pct}%`;
      if (this.exportProgressText) this.exportProgressText.innerText = `렌더링 중: ${f + 1} / ${totalFrames} 프레임 (${pct}%)`;

      await new Promise(r => setTimeout(r, frameDelay));
    }

    if (this.exportProgressText) this.exportProgressText.innerText = '비디오 파일 생성 중...';
    recorder.stop();
    const finalBlob = await recordPromise;

    // Trigger download
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.download = `RotoSketch_Animation_${Date.now()}.webm`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);

    if (this.exportProgressText) this.exportProgressText.innerText = '저장 완료!';
    setTimeout(() => {
      this._closeExportVideoModal();
    }, 1200);
  }

  _exportCurrentFrame() {
    // Merge video (if visible) + drawing layer into download canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.width;
    exportCanvas.height = this.height;
    const ctx = exportCanvas.getContext('2d');

    if (!this.soloAnimationMode && this.showVideo) {
      ctx.drawImage(this.videoCanvas, 0, 0);
    }
    ctx.drawImage(this.drawingCanvas, 0, 0);

    const a = document.createElement('a');
    a.download = `rotosketch_frame_${this.videoEngine.currentFrame}.png`;
    a.href = exportCanvas.toDataURL('image/png');
    a.click();
  }

  _exportKeyframeSequence() {
    const indices = this.keyframeEngine.getKeyframeIndices();
    if (indices.length === 0) {
      alert('내보낼 키프레임이 없습니다. 먼저 프레임 위에 그림을 그려주세요!');
      return;
    }

    for (const f of indices) {
      const kf = this.keyframeEngine.getKeyframe(f);
      const a = document.createElement('a');
      a.download = `rotosketch_seq_${String(f).padStart(4, '0')}.png`;
      a.href = kf.toDataURL('image/png');
      a.click();
    }
  }

  // ==========================================================================
  // Device Adaptation, Zero Distortion Fit, Fullscreen, and Tablet Gallery
  // ==========================================================================

  _initDeviceMode() {
    this._applyDeviceMode(this.deviceMode || 'auto');
  }

  _cycleDeviceMode() {
    const modes = ['auto', 'tablet', 'pc'];
    const current = this.deviceMode || 'auto';
    const nextIdx = (modes.indexOf(current) + 1) % modes.length;
    this._setDeviceMode(modes[nextIdx]);
  }

  _setDeviceMode(mode) {
    this.deviceMode = mode;
    localStorage.setItem('rotosketch_device_mode', mode);
    this._applyDeviceMode(mode);
  }

  _applyDeviceMode(mode) {
    let isTablet = false;
    let label = '자동 모드';
    let icon = '🔄';

    if (mode === 'tablet') {
      isTablet = true;
      label = '태블릿 모드';
      icon = '📱';
    } else if (mode === 'pc') {
      isTablet = false;
      label = 'PC 모드';
      icon = '💻';
    } else {
      // Auto mode based on window width and coarse pointer
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
      const isSmall = window.innerWidth <= 1024;
      isTablet = isSmall || (isTouch && window.innerWidth <= 1366);
      label = isTablet ? '태블릿 (자동)' : 'PC (자동)';
      icon = isTablet ? '📱' : '💻';
    }

    if (this.app) {
      this.app.classList.toggle('device-tablet', isTablet);
      this.app.classList.toggle('device-pc', !isTablet);
    }

    if (this.deviceModeIcon) {
      this.deviceModeIcon.innerText = icon;
    }
    if (this.deviceModeLabel) {
      this.deviceModeLabel.innerText = label;
    }
    if (this.selDeviceMode && this.selDeviceMode.value !== mode) {
      this.selDeviceMode.value = mode;
    }

    setTimeout(() => this._fitCanvasToWindow(), 50);
  }

  _fitCanvasToWindow() {
    if (!this.stageViewport || !this.canvasStack) return;
    const padding = 12;
    const availW = Math.max(200, this.stageViewport.clientWidth - padding * 2);
    const availH = Math.max(140, this.stageViewport.clientHeight - padding * 2);
    const aspect = (this.width && this.height) ? (this.width / this.height) : (16 / 9);

    let displayW = availW;
    let displayH = displayW / aspect;

    if (displayH > availH) {
      displayH = availH;
      displayW = displayH * aspect;
    }

    this.canvasStack.style.width = `${Math.round(displayW)}px`;
    this.canvasStack.style.height = `${Math.round(displayH)}px`;
    this.canvasStack.style.aspectRatio = `${aspect}`;
  }

  _toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  _updateFullscreenUI() {
    const isFs = !!document.fullscreenElement;
    if (this.app) {
      this.app.classList.toggle('is-fullscreen', isFs);
    }
    if (this.iconFsEnter && this.iconFsExit) {
      this.iconFsEnter.style.display = isFs ? 'none' : 'block';
      this.iconFsExit.style.display = isFs ? 'block' : 'none';
    }
    if (this.lblFullscreen) {
      this.lblFullscreen.innerText = isFs ? '창모드' : '전체화면';
    }
    setTimeout(() => this._fitCanvasToWindow(), 120);
  }

  _stepBySelectedUnit(direction) {
    const unit = this.selStepUnit ? this.selStepUnit.value : '1';
    if (unit === '1s') {
      this.videoEngine.jumpSeconds(direction * 1.0);
    } else if (unit === '5') {
      this.videoEngine.stepFrame(direction * 5);
    } else {
      this.videoEngine.stepFrame(direction * 1);
    }
  }

  _renderTimelineStripRanges() {
    if (!this.timelineStripRanges) return;
    this.timelineStripRanges.innerHTML = '';
    const totalFrames = this.videoEngine.totalFrames || 1;
    if (totalFrames <= 1) return;

    const strips = this.stripEngine.getStrips();
    for (const strip of strips) {
      if (strip.startFrame === null || strip.endFrame === null) continue;
      const count = strip.frameIndices ? strip.frameIndices.size : 0;
      if (count === 0) continue;

      const leftPct = (strip.startFrame / (totalFrames - 1)) * 100;
      const rightPct = (strip.endFrame / (totalFrames - 1)) * 100;
      const widthPct = Math.max(0.8, rightPct - leftPct);

      const seg = document.createElement('div');
      seg.className = 'timeline-strip-segment' + (strip.id === this.stripEngine.activeStripId ? ' active' : '');
      seg.style.left = `${leftPct}%`;
      seg.style.width = `${widthPct}%`;
      seg.style.setProperty('--strip-color', strip.color);
      seg.title = `${strip.name} (${strip.startFrame}f ~ ${strip.endFrame}f · 총 ${count}장) - 클릭하여 이동`;

      seg.addEventListener('click', (e) => {
        e.stopPropagation();
        this.stripEngine.setActiveStrip(strip.id);
        this.videoEngine.seekFrame(strip.startFrame);
      });

      this.timelineStripRanges.appendChild(seg);
    }
  }

  _openFrameBrowser() {
    if (!this.frameBrowserModal) return;
    this._renderFrameBrowserModal();
    this.frameBrowserModal.style.display = 'flex';
  }

  _closeFrameBrowser() {
    if (!this.frameBrowserModal) return;
    this.frameBrowserModal.style.display = 'none';
  }

  _renderFrameBrowserModal() {
    if (!this.frameBrowserContent) return;
    const strips = this.stripEngine.getStrips();
    const indices = this.keyframeEngine.getKeyframeIndices();

    if (strips.length === 0 && indices.length === 0) {
      this.frameBrowserContent.innerHTML = '<div class="empty-gallery-hint">✏️ 아직 그려진 키프레임이 없습니다. 비디오 위에 그림을 그려보세요!</div>';
      return;
    }

    this.frameBrowserContent.innerHTML = '';
    const currentFrame = this.videoEngine.currentFrame;

    for (const strip of strips) {
      const isPlayingThis = (this.isStripPlaying && this.playingStripId === strip.id);
      const stripFrames = strip.getSortedFrames ? strip.getSortedFrames() : Array.from(strip.frameIndices || []).sort((a, b) => a - b);

      const groupDiv = document.createElement('div');
      groupDiv.className = 'fb-strip-group';
      groupDiv.style.borderLeft = `4px solid ${strip.color || '#38bdf8'}`;

      const headerDiv = document.createElement('div');
      headerDiv.className = 'fb-strip-header';
      headerDiv.innerHTML = `
        <div class="fb-strip-info">
          <span class="fb-strip-badge" style="background: ${strip.color}22; color: ${strip.color}; border-color: ${strip.color}55;">#${strip.id}</span>
          <span style="font-size: 12px; font-weight: 600; color: #f8fafc;">${strip.startFrame !== null ? `${strip.startFrame}f ~ ${strip.endFrame}f` : '대기'}</span>
          <span style="font-size: 11px; color: #94a3b8;">(${stripFrames.length}장)</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-modal-action icon-only btn-play-strip" title="${isPlayingThis ? '일시정지' : '이 스트립 루프 재생'}">
            ${isPlayingThis ? '⏸' : '▶'}
          </button>
          <button class="btn-modal-action icon-only btn-del-strip" title="스트립 및 드로잉 삭제" style="color: #f43f5e;">
            🗑️
          </button>
        </div>
      `;

      const playBtn = headerDiv.querySelector('.btn-play-strip');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleStripPlayback(strip.id);
          this._renderFrameBrowserModal();
        });
      }

      const delBtn = headerDiv.querySelector('.btn-del-strip');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openDeleteStripModal(strip.id);
        });
      }

      groupDiv.appendChild(headerDiv);

      const gridDiv = document.createElement('div');
      gridDiv.className = 'fb-strip-frames-grid';

      // Mouse wheel horizontal scrolling support
      gridDiv.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          gridDiv.scrollLeft += e.deltaY;
        }
      }, { passive: false });

      if (stripFrames.length === 0) {
        gridDiv.innerHTML = '<span style="font-size: 11px; color: #64748b; padding: 10px;">그려진 키프레임 없음</span>';
      } else {
        for (const frame of stripFrames) {
          const card = document.createElement('div');
          card.className = `fb-frame-card ${frame === currentFrame ? 'active' : ''}`;
          card.title = `프레임 #${frame} 선택`;

          const thumbBox = document.createElement('div');
          thumbBox.className = 'fb-frame-thumb-box';

          const tCanvas = document.createElement('canvas');
          tCanvas.width = 120;
          tCanvas.height = 68;
          const tCtx = tCanvas.getContext('2d');
          tCtx.fillStyle = '#ffffff';
          tCtx.fillRect(0, 0, 120, 68);

          const kf = this.keyframeEngine.getKeyframe(frame);
          if (kf) {
            tCtx.drawImage(kf, 0, 0, 120, 68);
          }
          thumbBox.appendChild(tCanvas);

          // Individual Frame Delete Button
          const delFrameBtn = document.createElement('button');
          delFrameBtn.className = 'fb-frame-del-btn';
          delFrameBtn.title = `프레임 #${frame} 드로잉 삭제`;
          delFrameBtn.innerHTML = '🗑️';
          delFrameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`프레임 #${frame}의 그림을 삭제하시겠습니까?`)) {
              this._deleteSingleKeyframe(frame);
            }
          });
          thumbBox.appendChild(delFrameBtn);

          card.appendChild(thumbBox);

          const meta = document.createElement('div');
          meta.className = 'fb-frame-meta';
          meta.innerHTML = `
            <span class="fb-frame-num">#${frame}</span>
            <span class="fb-frame-time">${this._formatTime(frame / this.fps)}</span>
          `;
          card.appendChild(meta);

          card.addEventListener('click', () => {
            this.videoEngine.seekFrame(frame);
            this._closeFrameBrowser();
          });

          gridDiv.appendChild(card);
        }
      }

      groupDiv.appendChild(gridDiv);
      this.frameBrowserContent.appendChild(groupDiv);
    }
  }

  _deleteSingleKeyframe(frameIndex) {
    this._stopStripPlaybacks();
    this.keyframeEngine.deleteKeyframe(frameIndex);
    this.stripEngine.removeFrame(frameIndex);

    if (frameIndex === this.videoEngine.currentFrame) {
      this.dCtx.clearRect(0, 0, this.canvasWidth || this.width || 854, this.canvasHeight || this.height || 480);
    }

    this._renderOnionSkin(this.videoEngine.currentFrame);
    const indices = this.keyframeEngine.getKeyframeIndices();
    this._renderKeyframeMarkers(indices);
    this._renderKeyframeChips(indices);
    this._renderKeyframeFilmstrip(indices);
    this._renderTimelineStripRanges();
    this._updateActiveStripBadge();
    this._renderFrameBrowserModal();
  }

  _updateActiveStripBadge() {
    if (!this.currentStripBadge) return;
    const active = this.stripEngine.getActiveStrip();
    if (active) {
      this.currentStripBadge.innerText = `#${active.id}`;
      this.currentStripBadge.style.color = active.color;
      this.currentStripBadge.style.borderColor = `${active.color}88`;
      this.currentStripBadge.style.backgroundColor = `${active.color}22`;
      this.currentStripBadge.title = `현재 활성 스트립 #${active.id} (${active.startFrame !== null ? `${active.startFrame}f ~ ${active.endFrame}f` : '대기'}) - 클릭하여 갤러리 열기`;
    } else {
      this.currentStripBadge.innerText = '#1';
      this.currentStripBadge.style.color = '#38bdf8';
      this.currentStripBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      this.currentStripBadge.style.backgroundColor = 'rgba(56, 189, 248, 0.18)';
      this.currentStripBadge.title = '현재 활성 스트립 번호 - 클릭하여 갤러리 열기';
    }
  }
}

// Instantiate app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.rotoApp = new RotoSketchApp();
});

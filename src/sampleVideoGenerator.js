// sampleVideoGenerator.js
// Procedurally generates a smooth 24fps 5-second animated action video (a ninja running and doing an acrobatic flip)
// so the user can immediately test rotoscoping and tracing without downloading an external file.

export function createSampleVideoBlob(fps = 24, durationSeconds = 5) {
  return new Promise((resolve) => {
    const width = 854;
    const height = 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const totalFrames = fps * durationSeconds;
    const stream = canvas.captureStream(fps);
    
    let mimeType = 'video/webm; codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2500000
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(URL.createObjectURL(blob));
    };

    recorder.start();

    let frame = 0;
    const renderInterval = setInterval(() => {
      if (frame >= totalFrames) {
        clearInterval(renderInterval);
        recorder.stop();
        return;
      }

      // Draw background
      const t = frame / totalFrames; // 0 to 1
      const progress = (frame % (fps * 2.5)) / (fps * 2.5); // 2.5s cycle

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(0.7, '#1e293b');
      skyGrad.addColorStop(1, '#334155');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant mountains / city silhouette
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(0, height - 80);
      for (let x = 0; x <= width; x += 50) {
        const y = height - 120 + Math.sin(x * 0.015 + frame * 0.02) * 20;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Ground plane
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, height - 90, width, 90);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height - 90);
      ctx.lineTo(width, height - 90);
      ctx.stroke();

      // Grid lines moving backwards to show speed
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1;
      const gridOffset = (frame * 8) % 40;
      for (let x = -gridOffset; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, height - 90);
        ctx.lineTo(x - 50, height);
        ctx.stroke();
      }

      // Draw character: Acrobat / Ninja doing running + leap + backflip
      const cycle = frame % (fps * 2.5); // 0 to 60 frames
      const charX = width * 0.5;
      let charY = height - 140;
      let angle = 0;

      // Phase 1: Running (frames 0 to 30)
      // Phase 2: High Jump & Flip (frames 30 to 50)
      // Phase 3: Landing (frames 50 to 60)
      if (cycle >= 25 && cycle <= 50) {
        const flipT = (cycle - 25) / 25; // 0 to 1
        // Parabolic jump
        charY -= Math.sin(flipT * Math.PI) * 110;
        // 360 degree rotation
        angle = flipT * Math.PI * 2;
      }

      ctx.save();
      ctx.translate(charX, charY);
      ctx.rotate(angle);

      // Character styling: Glowing cyber athlete / silhouette
      ctx.strokeStyle = '#f43f5e';
      ctx.fillStyle = '#f43f5e';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Head
      ctx.beginPath();
      ctx.arc(0, -40, 14, 0, Math.PI * 2);
      ctx.fill();

      // Headband / scarf trail
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, -40);
      ctx.quadraticCurveTo(-35, -45 + Math.sin(frame * 0.5) * 8, -60, -38 + Math.cos(frame * 0.5) * 10);
      ctx.stroke();

      // Torso
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, 15);
      ctx.stroke();

      // Running limb cycle calculations
      const legRunPhase = (frame * 0.6);
      const leg1Angle = Math.sin(legRunPhase) * 0.8;
      const leg2Angle = -leg1Angle;
      const arm1Angle = -leg1Angle * 0.9;
      const arm2Angle = leg1Angle * 0.9;

      if (cycle >= 25 && cycle <= 50) {
        // Tucked flip limbs
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        // Legs tucked
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(15, 25);
        ctx.lineTo(0, 35);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(-15, 25);
        ctx.lineTo(0, 35);
        ctx.stroke();

        // Arms tucked
        ctx.strokeStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(18, -5);
        ctx.lineTo(10, 10);
        ctx.stroke();
      } else {
        // Running limbs
        // Back arm
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        const a2x = Math.sin(arm2Angle) * 22;
        const a2y = Math.cos(arm2Angle) * 22;
        ctx.lineTo(a2x, -15 + a2y);
        ctx.lineTo(a2x + 10, -15 + a2y + 12);
        ctx.stroke();

        // Back leg
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        const l2x = Math.sin(leg2Angle) * 26;
        const l2y = Math.cos(leg2Angle) * 26;
        ctx.lineTo(l2x, 15 + l2y);
        ctx.lineTo(l2x + (leg2Angle > 0 ? 15 : -10), 15 + l2y + 24);
        ctx.stroke();

        // Front leg
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        const l1x = Math.sin(leg1Angle) * 26;
        const l1y = Math.cos(leg1Angle) * 26;
        ctx.lineTo(l1x, 15 + l1y);
        ctx.lineTo(l1x + (leg1Angle > 0 ? 15 : -10), 15 + l1y + 24);
        ctx.stroke();

        // Front arm
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        const a1x = Math.sin(arm1Angle) * 22;
        const a1y = Math.cos(arm1Angle) * 22;
        ctx.lineTo(a1x, -15 + a1y);
        ctx.lineTo(a1x + 10, -15 + a1y + 12);
        ctx.stroke();
      }

      ctx.restore();

      // Motion lines & HUD Frame Counter
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`SAMPLE ROTOPLAY | FRAME ${frame + 1}/${totalFrames} | ${(frame / fps).toFixed(2)}s`, 24, 36);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '12px sans-serif';
      ctx.fillText(`▲ Rotoscoping Tracing Video Source (24 FPS)`, 24, 56);

      frame++;
    }, 1000 / fps);
  });
}

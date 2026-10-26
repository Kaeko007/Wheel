// wheel.js - High-DPI Canvas Wheel Renderer with Synchronized Physics
class WheelRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.items = [];
    this.currentAngle = 0; // Current rendered angle
    this.lastTickSlice = -1;
    this.isSpinning = false;
    this.spinData = null;
    this.needleDeflection = 0; // needle jiggle when hitting a peg

    this.setupDPI();
    window.addEventListener('resize', () => {
      this.setupDPI();
      this.draw();
    });
  }

  setupDPI() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(rect.width || 580, 580);

    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.displaySize = size;
  }

  setItems(items) {
    this.items = items || [];
    this.draw();
  }

  // Calculate angle at any point in server time
  computeAngle(serverTime) {
    if (!this.spinData || !this.isSpinning) {
      return this.currentAngle;
    }

    const { startTime, duration, startAngle, targetAngle } = this.spinData;
    const elapsed = serverTime - startTime;

    if (elapsed <= 0) {
      return startAngle;
    }

    if (elapsed >= duration) {
      return targetAngle;
    }

    // Smooth quartic ease-out for realistic deceleration
    const t = elapsed / duration;
    const progress = 1 - Math.pow(1 - t, 4);
    return startAngle + (targetAngle - startAngle) * progress;
  }

  // Needle at top (12 o'clock, 3*PI/2)
  getSliceAtTop(angle) {
    if (this.items.length === 0) return 0;
    const count = this.items.length;
    const sliceAngle = (2 * Math.PI) / count;
    const topAngle = (3 * Math.PI) / 2;
    // Angle relative to wheel origin
    const rel = (topAngle - angle) % (2 * Math.PI);
    const positiveRel = (rel + 2 * Math.PI) % (2 * Math.PI);
    return Math.floor(positiveRel / sliceAngle) % count;
  }

  update(serverTime) {
    if (this.isSpinning && this.spinData) {
      const prevAngle = this.currentAngle;
      this.currentAngle = this.computeAngle(serverTime);

      const elapsed = serverTime - this.spinData.startTime;
      const currentSlice = this.getSliceAtTop(this.currentAngle);

      // Trigger tick sound & needle jiggle when slice boundary passes needle
      if (currentSlice !== this.lastTickSlice) {
        this.lastTickSlice = currentSlice;
        if (window.soundManager) {
          window.soundManager.playTick();
        }
        // Needle deflects slightly to the left then springs back
        this.needleDeflection = -12;
      }

      // Spring needle back to 0
      this.needleDeflection *= 0.82;
      this.updateNeedleVisual();

      // Check if spin finished
      if (elapsed >= this.spinData.duration) {
        this.isSpinning = false;
        this.currentAngle = this.spinData.targetAngle;
        this.needleDeflection = 0;
        this.updateNeedleVisual();
        if (typeof this.onSpinFinish === 'function') {
          this.onSpinFinish(this.spinData.winnerIndex, this.spinData.winnerItem);
        }
      }
    } else {
      this.needleDeflection *= 0.8;
      this.updateNeedleVisual();
    }

    this.draw();
  }

  updateNeedleVisual() {
    const needle = document.querySelector('.pointer-needle');
    if (needle) {
      needle.style.transform = `rotate(${this.needleDeflection}deg)`;
    }
  }

  draw() {
    const ctx = this.ctx;
    const size = this.displaySize;
    const center = size / 2;
    const radius = center - 16;

    ctx.clearRect(0, 0, size, size);

    if (this.items.length === 0) {
      ctx.save();
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 16px Kanit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ไม่มีรายการในวงล้อ', center, center);
      ctx.restore();
      return;
    }

    const count = this.items.length;
    const sliceAngle = (2 * Math.PI) / count;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.currentAngle);

    // 1. Draw Pie Slices
    for (let i = 0; i < count; i++) {
      const item = this.items[i];
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = item.color;
      ctx.fill();

      // Subtle slice separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Draw Text
      ctx.save();
      const midAngle = startAngle + sliceAngle / 2;
      ctx.rotate(midAngle);

      // Text position: 60-70% towards rim
      const textDist = radius * 0.65;
      ctx.translate(textDist, 0);

      // Keep text horizontal outward or radially readable
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      // Drop shadow for crisp readability over any slice color
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Dynamic font size depending on slice count & string length
      let fontSize = 16;
      if (count > 16) fontSize = 12;
      else if (count > 10) fontSize = 14;

      ctx.font = `600 ${fontSize}px 'Kanit', sans-serif`;

      let label = item.label;
      if (label.length > 20) {
        label = label.slice(0, 19) + '…';
      }

      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // 3. Draw Outer Rim & Glowing Studs/Pegs
    ctx.restore(); // Return to non-rotated canvas context

    ctx.save();
    ctx.translate(center, center);

    // Rim Outer Ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1e1b4b'; // dark metallic indigo
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius + 7, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4338ca'; // neon outer border
    ctx.stroke();

    // Metallic Studs around the rim
    const pegCount = Math.max(12, count * 2);
    for (let p = 0; p < pegCount; p++) {
      const pegAngle = (p * 2 * Math.PI) / pegCount + this.currentAngle;
      const pegX = Math.cos(pegAngle) * radius;
      const pegY = Math.sin(pegAngle) * radius;

      ctx.beginPath();
      ctx.arc(pegX, pegY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    // Inner Hub Bevel Ring
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.shadowBlur = 0;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#818cf8';
    ctx.stroke();

    ctx.restore();
  }
}

window.WheelRenderer = WheelRenderer;

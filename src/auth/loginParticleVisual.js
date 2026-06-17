const POINT_COUNT = 1700;
const DPR_LIMIT = 1.65;
const SUCCESS_MORPH_MS = 1080;

export function initLoginParticleVisual(root) {
  const canvas = root?.querySelector('[data-login-particle-canvas]');
  const fallback = root?.querySelector('[data-login-particle-fallback]');
  if (!canvas) return createNoopVisual();

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    if (fallback) fallback.hidden = false;
    return createNoopVisual();
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const points = createPoints(POINT_COUNT);
  const state = {
    mode: 'idle',
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    rotationX: -0.18,
    rotationY: 0,
    tiltX: 0,
    tiltY: 0,
    tiltTargetX: 0,
    tiltTargetY: 0,
    dragX: 0,
    dragY: 0,
    mouseX: 2,
    mouseY: 2,
    pointerX: 0,
    pointerY: 0,
    dragging: false,
    hover: 0,
    hoverTarget: 0,
    press: 0,
    pressTarget: 0,
    pulse: 0,
    morph: 0,
    morphTarget: 0,
    errorShake: 0,
    successTimer: 0,
    successPromise: null,
    successResolve: null,
    raf: 0,
    destroyed: false,
  };

  const resize = () => resizeCanvas(canvas, context, state);
  const updatePointer = event => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
    state.mouseX = x * 2 - 1;
    state.mouseY = y * 2 - 1;
    state.tiltTargetX = state.mouseX;
    state.tiltTargetY = state.mouseY;
  };
  const onPointerEnter = event => {
    state.hoverTarget = 1;
    updatePointer(event);
  };
  const onPointerMove = event => {
    updatePointer(event);

    if (state.dragging) {
      const dx = event.clientX - state.pointerX;
      const dy = event.clientY - state.pointerY;
      state.dragX += dx * 0.0055;
      state.dragY = Math.max(-1.15, Math.min(1.15, state.dragY + dy * 0.0055));
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
    }
  };
  const onPointerLeave = () => {
    if (state.dragging) return;
    state.hoverTarget = 0;
    state.pressTarget = 0;
    state.mouseX = 2;
    state.mouseY = 2;
    state.tiltTargetX = 0;
    state.tiltTargetY = 0;
  };
  const onPointerDown = event => {
    state.dragging = true;
    state.pressTarget = 1;
    state.pulse = 0;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    root.classList.add('is-dragging');
    canvas.setPointerCapture?.(event.pointerId);
    updatePointer(event);
  };
  const onPointerUp = event => {
    state.dragging = false;
    state.pressTarget = 0;
    root.classList.remove('is-dragging');
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };
  const onPointerCancel = event => {
    onPointerUp(event);
    onPointerLeave();
  };
  const onKeyDown = event => {
    const step = event.shiftKey ? 0.22 : 0.14;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Enter', ' '].includes(event.key)) return;

    if (event.key === 'ArrowLeft') state.dragX -= step;
    if (event.key === 'ArrowRight') state.dragX += step;
    if (event.key === 'ArrowUp') state.dragY = Math.max(-1.15, state.dragY - step);
    if (event.key === 'ArrowDown') state.dragY = Math.min(1.15, state.dragY + step);
    if (event.key === 'Home') {
      state.dragX = 0;
      state.dragY = 0;
      state.tiltTargetX = 0;
      state.tiltTargetY = 0;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      state.pressTarget = 1;
      state.pulse = 0;
      window.setTimeout(() => {
        state.pressTarget = 0;
      }, 280);
    }

    event.preventDefault();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  canvas.addEventListener('pointerenter', onPointerEnter);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('keydown', onKeyDown);

  const beginSuccessText = label => {
    const safeLabel = String(label || getFallbackLabel()).trim() || getFallbackLabel();
    const textTargets = buildTextTargets(safeLabel, points.length);
    points.forEach((point, index) => {
      point.text = textTargets[index];
    });

    window.clearTimeout(state.successTimer);
    state.mode = 'successText';
    state.morphTarget = 1;
    state.errorShake = 0;

    if (!state.successPromise) {
      state.successPromise = new Promise(resolve => {
        state.successResolve = resolve;
      });
    }

    state.successTimer = window.setTimeout(
      () => {
        const resolve = state.successResolve;
        state.successPromise = null;
        state.successResolve = null;
        resolve?.();
      },
      prefersReducedMotion ? 140 : SUCCESS_MORPH_MS
    );

    return state.successPromise;
  };

  const visual = {
    setState(mode = 'idle', options = {}) {
      if (state.mode === 'successText' && mode !== 'success') return Promise.resolve();
      if (mode === 'success') return beginSuccessText(options.label);

      window.clearTimeout(state.successTimer);
      state.successPromise = null;
      state.successResolve = null;
      state.mode = mode;
      state.morphTarget = mode === 'error' ? 1 : 0;
      if (mode === 'checking') state.morphTarget = 0.22;
      if (mode === 'error') state.errorShake = 1;
      return Promise.resolve();
    },
    showSuccessText(label = getFallbackLabel()) {
      return beginSuccessText(label);
    },
    destroy() {
      state.destroyed = true;
      window.clearTimeout(state.successTimer);
      cancelAnimationFrame(state.raf);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerenter', onPointerEnter);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('keydown', onKeyDown);
      root.classList.remove('is-dragging');
    },
  };

  resize();
  const render = now => {
    if (state.destroyed) return;
    drawFrame(context, points, state, now, prefersReducedMotion);
    state.raf = requestAnimationFrame(render);
  };
  state.raf = requestAnimationFrame(render);

  return visual;
}

function createNoopVisual() {
  return {
    setState() {
      return Promise.resolve();
    },
    showSuccessText() {
      return Promise.resolve();
    },
    destroy() {},
  };
}

function resizeCanvas(canvas, context, state) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  state.width = width;
  state.height = height;
  state.dpr = dpr;
  context.setTransform(1, 0, 0, 1, 0, 0);
}

function createPoints(count) {
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * index;
    const sphere = {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    };

    points.push({
      sphere,
      lock: buildLockTarget(index, count),
      text: sphere,
      seed: Math.random(),
    });
  }

  return points;
}

function buildLockTarget(index, count) {
  return adaptReferencePoint(buildReferenceLockPoint(index, count));
}

function buildReferenceLockPoint(index, count) {
  const bodyCount = Math.floor(count * 0.61);
  const angle = Math.PI * 2 * fract(index * 0.61803398875 + saltedHash(index, 52) * 0.055);

  if (index < bodyCount) {
    const t = (index + 0.5) / Math.max(1, bodyCount);
    const radius = 0.03 * (0.96 + saltedHash(index, 53) * 0.08);
    return pointOnTube(sampleRoundedRectPath(t, 0.76, 0.44, 0.108, -0.15), angle, radius);
  }

  const localIndex = index - bodyCount;
  const localCount = count - bodyCount;
  const capCount = Math.max(18, Math.floor(localCount * 0.075));
  const tubeCount = localCount - capCount * 2;
  const radius = 0.031 * (0.96 + saltedHash(index, 54) * 0.08);

  if (localIndex < capCount) {
    const sample = sampleShacklePath(0);
    return pointOnHemisphereCap(
      sample.point,
      sample.tangent,
      -1,
      (localIndex + 0.5) / capCount,
      angle,
      radius
    );
  }

  if (localIndex >= localCount - capCount) {
    const sample = sampleShacklePath(1);
    const capIndex = localIndex - (localCount - capCount);
    return pointOnHemisphereCap(
      sample.point,
      sample.tangent,
      1,
      (capIndex + 0.5) / capCount,
      angle,
      radius
    );
  }

  const tubeIndex = localIndex - capCount;
  const t = (tubeIndex + 0.5) / Math.max(1, tubeCount);
  return pointOnTube(sampleShacklePath(t), angle, radius);
}

function adaptReferencePoint(point) {
  return { x: point.x, y: -point.y, z: point.z };
}

function pointOnRoundedRect(t, width, height, radius, centerY) {
  const straightX = width - radius * 2;
  const straightY = height - radius * 2;
  const arcLength = Math.PI * radius * 0.5;
  const lengths = [straightX, arcLength, straightY, arcLength, straightX, arcLength, straightY, arcLength];
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let cursor = fract(t) * total;
  let segment = 0;

  while (segment < lengths.length - 1 && cursor > lengths[segment]) {
    cursor -= lengths[segment];
    segment += 1;
  }

  const local = lengths[segment] > 0 ? cursor / lengths[segment] : 0;
  const left = -width * 0.5;
  const right = width * 0.5;
  const bottom = centerY - height * 0.5;
  const top = centerY + height * 0.5;

  if (segment === 0) return { x: left + radius + straightX * local, y: top };
  if (segment === 1) {
    const angle = Math.PI * 0.5 - local * Math.PI * 0.5;
    return { x: right - radius + Math.cos(angle) * radius, y: top - radius + Math.sin(angle) * radius };
  }
  if (segment === 2) return { x: right, y: top - radius - straightY * local };
  if (segment === 3) {
    const angle = -local * Math.PI * 0.5;
    return { x: right - radius + Math.cos(angle) * radius, y: bottom + radius + Math.sin(angle) * radius };
  }
  if (segment === 4) return { x: right - radius - straightX * local, y: bottom };
  if (segment === 5) {
    const angle = -Math.PI * 0.5 - local * Math.PI * 0.5;
    return { x: left + radius + Math.cos(angle) * radius, y: bottom + radius + Math.sin(angle) * radius };
  }
  if (segment === 6) return { x: left, y: bottom + radius + straightY * local };

  const angle = Math.PI - local * Math.PI * 0.5;
  return { x: left + radius + Math.cos(angle) * radius, y: top - radius + Math.sin(angle) * radius };
}

function sampleRoundedRectPath(t, width, height, radius, centerY) {
  const epsilon = 0.0007;
  const point = pointOnRoundedRect(t, width, height, radius, centerY);
  const next = pointOnRoundedRect(t + epsilon, width, height, radius, centerY);
  return {
    point,
    tangent: normalize2(next.x - point.x, next.y - point.y),
  };
}

function pointOnLockShackle(t) {
  const verticalLength = 0.145;
  const arcRadius = 0.245;
  const baseY = 0.07;
  const arcCenterY = baseY + verticalLength;
  const arcLength = Math.PI * arcRadius;
  const total = verticalLength * 2 + arcLength;
  let cursor = clamp01(t) * total;

  if (cursor <= verticalLength) {
    return { x: -arcRadius, y: baseY + cursor };
  }

  cursor -= verticalLength;
  if (cursor <= arcLength) {
    const angle = Math.PI - (cursor / arcLength) * Math.PI;
    return { x: Math.cos(angle) * arcRadius, y: arcCenterY + Math.sin(angle) * arcRadius };
  }

  cursor -= arcLength;
  return { x: arcRadius, y: arcCenterY - Math.min(cursor, verticalLength) };
}

function sampleShacklePath(t) {
  const epsilon = 0.0007;
  const point = pointOnLockShackle(t);
  const next = pointOnLockShackle(Math.min(1, t + epsilon));
  return {
    point,
    tangent: normalize2(next.x - point.x, next.y - point.y),
  };
}

function pointOnTube(sample, angle, radius) {
  const tangent = normalize2(sample.tangent.x, sample.tangent.y);
  const normalX = -tangent.y;
  const normalY = tangent.x;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: sample.point.x + normalX * cosine * radius,
    y: sample.point.y + normalY * cosine * radius,
    z: sine * radius,
  };
}

function pointOnHemisphereCap(center, tangent, direction, surfaceU, angle, radius) {
  const axis = normalize2(tangent.x * direction, tangent.y * direction);
  const normalX = -axis.y;
  const normalY = axis.x;
  const axial = clamp01(surfaceU);
  const radial = Math.sqrt(Math.max(0, 1 - axial * axial));
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: center.x + axis.x * radius * axial + normalX * radius * radial * cosine,
    y: center.y + axis.y * radius * axial + normalY * radius * radial * cosine,
    z: radius * radial * sine,
  };
}

function buildTextTargets(label, count) {
  const pixels = sampleTextPixels(label);
  if (!pixels.length) return buildFallbackTextTargets(count);

  const targets = [];
  const textWidth = Math.max(1, pixels.bounds.maxX - pixels.bounds.minX);
  const textHeight = Math.max(1, pixels.bounds.maxY - pixels.bounds.minY);
  const scale = Math.max(textWidth / 2.35, textHeight / 0.42, 1);
  const centerX = (pixels.bounds.minX + pixels.bounds.maxX) * 0.5;
  const centerY = (pixels.bounds.minY + pixels.bounds.maxY) * 0.5;

  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.floor(((index + 0.5) / count) * pixels.length) % pixels.length;
    const pixel = pixels[(sourceIndex + Math.floor(saltedHash(index, 71) * pixels.length)) % pixels.length];
    const halo = index >= pixels.length ? (saltedHash(index, 72) - 0.5) * 0.018 : 0;

    targets.push({
      x: (pixel.x - centerX) / scale + (saltedHash(index, 73) - 0.5) * 0.006,
      y: (pixel.y - centerY) / scale + (saltedHash(index, 74) - 0.5) * 0.006,
      z: (saltedHash(index, 75) - 0.5) * 0.035 + halo,
    });
  }

  return targets;
}

function sampleTextPixels(label) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];

  const safeLabel = String(label || getFallbackLabel()).trim() || getFallbackLabel();
  const maxWidth = 980;
  const maxHeight = 260;
  canvas.width = maxWidth;
  canvas.height = maxHeight;

  let fontSize = 104;
  const fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  while (fontSize > 34) {
    context.font = `800 ${fontSize}px ${fontFamily}`;
    const metrics = context.measureText(safeLabel);
    if (metrics.width <= maxWidth * 0.88) break;
    fontSize -= 4;
  }

  context.clearRect(0, 0, maxWidth, maxHeight);
  context.font = `800 ${fontSize}px ${fontFamily}`;
  context.fillStyle = '#ffffff';
  context.fillText(safeLabel, maxWidth * 0.5, maxHeight * 0.51);

  const image = context.getImageData(0, 0, maxWidth, maxHeight);
  const pixels = [];
  const step = fontSize > 58 ? 3 : 2;
  const bounds = { minX: maxWidth, minY: maxHeight, maxX: 0, maxY: 0 };

  for (let y = 0; y < maxHeight; y += step) {
    for (let x = 0; x < maxWidth; x += step) {
      const alpha = image.data[(y * maxWidth + x) * 4 + 3];
      if (alpha < 92) continue;
      pixels.push({ x, y });
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  }

  pixels.bounds = bounds;
  return pixels;
}

function buildFallbackTextTargets(count) {
  const targets = [];
  const columns = Math.ceil(Math.sqrt(count * 5.5));
  const rows = Math.ceil(count / columns);

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    targets.push({
      x: (column / Math.max(1, columns - 1) - 0.5) * 1.85,
      y: (row / Math.max(1, rows - 1) - 0.5) * 0.36,
      z: (saltedHash(index, 81) - 0.5) * 0.025,
    });
  }

  return targets;
}

function getFallbackLabel() {
  if (typeof document !== 'undefined') {
    const title = String(document.title || '').trim();
    if (title) return title;
  }
  return 'System';
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function fract(value) {
  return value - Math.floor(value);
}

function normalize2(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function saltedHash(index, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function drawFrame(context, points, state, now, reducedMotion) {
  const width = state.width;
  const height = state.height;
  if (!width || !height) return;

  const delta = Math.min((now - state.time) / 1000 || 0, 0.05);
  state.time = now;

  const speed = reducedMotion ? 0 : 0.18;
  state.tiltX += (state.tiltTargetX - state.tiltX) * 0.055;
  state.tiltY += (state.tiltTargetY - state.tiltY) * 0.055;
  state.rotationY = state.dragX + state.tiltX * 0.17;
  state.rotationX = -0.12 + state.dragY + state.tiltY * 0.13;
  state.hover += (state.hoverTarget - state.hover) * 0.08;
  state.press += (state.pressTarget - state.press) * 0.14;
  if (state.press > 0.01 || state.pulse < 3.5 || state.hover > 0.01) {
    state.pulse += delta * 4.2;
  }
  state.morph += (state.morphTarget - state.morph) * (reducedMotion ? 0.35 : 0.08);
  state.errorShake *= 0.9;

  const t = now / 1000;
  const size = Math.min(width, height) * 0.34;
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const modeColor = getModeColor(state.mode);
  const isSuccessText = state.mode === 'successText';
  const targetType = isSuccessText ? 'text' : 'lock';

  context.clearRect(0, 0, width, height);
  drawGlow(context, centerX, centerY, size, modeColor);

  const rendered = [];
  const autoRotation = reducedMotion ? 0 : t * speed;
  const morph = easeInOut(state.morph);

  for (const point of points) {
    const wave = reducedMotion ? 0 : Math.sin(t * 1.1 + point.seed * 12) * 0.035;
    const source = {
      x: point.sphere.x * (1 + wave),
      y: point.sphere.y * (1 + wave * 0.5),
      z: point.sphere.z * (1 + wave),
    };
    const target = point[targetType];
    const rotatedSource = rotatePoint(source, state.rotationX, state.rotationY + autoRotation);
    let facedTarget;

    if (isSuccessText) {
      facedTarget = {
        x: target.x,
        y: target.y + (reducedMotion ? 0 : Math.sin(t * 1.8 + point.seed * 9) * 0.0018),
        z: target.z,
      };
    } else {
      const symbolYaw = 0.22 + state.tiltX * 0.075 + state.dragX * 0.024;
      const symbolPitch = -0.08 + state.tiltY * 0.06 + state.dragY * 0.024;
      facedTarget = rotatePoint(
        {
          x: target.x,
          y: target.y + (reducedMotion ? 0 : Math.sin(t * 1.05 + point.seed * 0.18) * 0.0024),
          z: target.z,
        },
        symbolPitch,
        symbolYaw
      );
    }
    let position = mix3(rotatedSource, facedTarget, morph);

    const previewPerspective = 1.85 / (1.85 - position.z * 0.48);
    const projectedX = position.x * previewPerspective;
    const projectedY = position.y * previewPerspective;
    const cursorDistance = Math.hypot(projectedX - state.mouseX, projectedY - state.mouseY);
    const cursorInfluence = smoothstep(0.34, 0, cursorDistance) * state.hover * (1 - morph * 0.74);
    const ripple =
      reducedMotion
        ? 0
        : Math.sin(cursorDistance * 21 - state.pulse * 8.5 + point.seed) *
          Math.exp(-cursorDistance * 5) *
          state.press;

    if (cursorInfluence || ripple) {
      const force = cursorInfluence * 0.047 + ripple * 0.052;
      const normal = normalize3(position.x + 0.0001, position.y + 0.0001, position.z + 0.0001);
      position = {
        x: position.x + normal.x * force,
        y: position.y + normal.y * force,
        z: position.z + normal.z * force,
      };
    }

    const perspective = 1.85 / (1.85 - position.z * 0.48);
    const shake = state.errorShake * Math.sin(t * 40 + point.seed * 8) * width * 0.002;
    const x = centerX + position.x * size * perspective + shake;
    const y = centerY + position.y * size * perspective;
    const alpha = 0.23 + Math.max(position.z, -0.75) * 0.38 + morph * 0.2;
    rendered.push({ x, y, z: position.z, alpha, seed: point.seed, cursorInfluence });
  }

  rendered.sort((a, b) => a.z - b.z);

  for (const dot of rendered) {
    const radius = (1.05 + dot.z * 0.65 + morph * 0.28 + dot.cursorInfluence * 0.55) * state.dpr;
    context.beginPath();
    context.fillStyle = `rgba(${modeColor}, ${Math.max(0.1, Math.min(0.92, dot.alpha))})`;
    context.arc(dot.x, dot.y, Math.max(0.65, radius), 0, Math.PI * 2);
    context.fill();
  }

  if (state.mode === 'checking' && !reducedMotion) {
    context.beginPath();
    context.strokeStyle = 'rgba(67, 136, 255, .22)';
    context.lineWidth = 2 * state.dpr;
    context.arc(centerX, centerY, size * (0.92 + Math.sin(t * 4) * 0.035), 0, Math.PI * 2);
    context.stroke();
  }
}

function drawGlow(context, x, y, size, color) {
  const gradient = context.createRadialGradient(x, y, size * 0.12, x, y, size * 1.28);
  gradient.addColorStop(0, `rgba(${color}, .16)`);
  gradient.addColorStop(0.42, `rgba(${color}, .065)`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, size * 1.35, 0, Math.PI * 2);
  context.fill();
}

function getModeColor(mode) {
  if (mode === 'success') return '35, 199, 167';
  if (mode === 'error') return '255, 113, 130';
  if (mode === 'checking') return '67, 136, 255';
  return '142, 198, 230';
}

function rotatePoint(point, ax, ay) {
  const cosX = Math.cos(ax);
  const sinX = Math.sin(ax);
  const cosY = Math.cos(ay);
  const sinY = Math.sin(ay);
  const y = point.y * cosX - point.z * sinX;
  const z1 = point.y * sinX + point.z * cosX;
  const x = point.x * cosY + z1 * sinY;
  const z = -point.x * sinY + z1 * cosY;
  return { x, y, z };
}

function mix3(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function easeInOut(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

function normalize3(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

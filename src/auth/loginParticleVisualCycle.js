import { initLoginParticleVisual as initBaseLoginParticleVisual } from './loginParticleVisual.js';

const SPHERE_HOLD_MS = 3000;
const TITLE_HOLD_MS = 3000;
const TITLE_TRANSITION_MS = 1350;
const RETURN_TRANSITION_MS = 1350;
const AMBIENT_MODES = new Set(['idle', 'typing']);

export function initLoginParticleVisual(root) {
  const canvas = root?.querySelector('[data-login-particle-canvas]');
  if (!canvas) return createNoopVisual();

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let visual = initBaseLoginParticleVisual(root);
  let destroyed = false;
  let ambientActive = false;
  let showingTitle = false;
  let needsAmbientReset = false;
  let cycleVersion = 0;
  let pendingTimer = 0;

  const clearPendingTimer = () => {
    window.clearTimeout(pendingTimer);
    pendingTimer = 0;
  };

  const restoreCanvas = () => {
    canvas.style.transition = '';
    canvas.style.opacity = '';
    canvas.style.transform = '';
    canvas.style.filter = '';
  };

  const recreateVisual = () => {
    visual.destroy();
    restoreCanvas();
    visual = initBaseLoginParticleVisual(root);
    showingTitle = false;
    needsAmbientReset = false;
  };

  const wait = (duration, version) =>
    new Promise(resolve => {
      clearPendingTimer();
      pendingTimer = window.setTimeout(() => {
        pendingTimer = 0;
        resolve(!destroyed && ambientActive && version === cycleVersion);
      }, duration);
    });

  const isCurrentCycle = version => !destroyed && ambientActive && version === cycleVersion;

  const runAmbientCycle = async version => {
    while (isCurrentCycle(version)) {
      // Sphere stays fully formed for three seconds.
      if (!(await wait(SPHERE_HOLD_MS, version))) return;

      showingTitle = true;
      canvas.style.transition = [
        `opacity ${TITLE_TRANSITION_MS}ms cubic-bezier(.4, 0, .2, 1)`,
        `transform ${TITLE_TRANSITION_MS}ms cubic-bezier(.4, 0, .2, 1)`,
        `filter ${TITLE_TRANSITION_MS}ms cubic-bezier(.4, 0, .2, 1)`,
      ].join(', ');
      canvas.style.opacity = '0.94';
      canvas.style.transform = 'scale(0.985)';
      canvas.style.filter = 'blur(0.2px)';
      const titleMorph = visual.showSuccessText(getDisplayName());

      // The particle morph itself finishes slightly earlier; the subtle canvas
      // transition extends the perceived sphere-to-title animation to 1.35 s.
      if (!(await wait(TITLE_TRANSITION_MS, version))) return;
      await titleMorph;
      if (!isCurrentCycle(version)) return;

      canvas.style.opacity = '1';
      canvas.style.transform = 'scale(1)';
      canvas.style.filter = 'blur(0)';

      // Project name stays fully readable for three seconds.
      if (!(await wait(TITLE_HOLD_MS, version))) return;

      const halfReturn = RETURN_TRANSITION_MS / 2;
      canvas.style.transition = [
        `opacity ${halfReturn}ms cubic-bezier(.4, 0, .2, 1)`,
        `transform ${halfReturn}ms cubic-bezier(.4, 0, .2, 1)`,
      ].join(', ');
      canvas.style.opacity = '0';
      canvas.style.transform = 'scale(0.985)';

      if (!(await wait(halfReturn, version))) return;

      visual.destroy();
      visual = initBaseLoginParticleVisual(root);
      showingTitle = false;
      canvas.style.transition = 'none';
      canvas.style.opacity = '0';
      canvas.style.transform = 'scale(0.985)';
      canvas.style.filter = '';

      await nextPaint();
      if (!isCurrentCycle(version)) return;

      canvas.style.transition = [
        `opacity ${halfReturn}ms cubic-bezier(.4, 0, .2, 1)`,
        `transform ${halfReturn}ms cubic-bezier(.4, 0, .2, 1)`,
      ].join(', ');
      canvas.style.opacity = '1';
      canvas.style.transform = 'scale(1)';

      if (!(await wait(halfReturn, version))) return;
      restoreCanvas();
    }
  };

  const startAmbientCycle = () => {
    if (destroyed || reducedMotion || ambientActive) return;
    ambientActive = true;
    cycleVersion += 1;
    restoreCanvas();
    void runAmbientCycle(cycleVersion);
  };

  const stopAmbientCycle = ({ resetVisual = false } = {}) => {
    ambientActive = false;
    cycleVersion += 1;
    clearPendingTimer();

    if (resetVisual && showingTitle) {
      recreateVisual();
    } else {
      restoreCanvas();
    }
  };

  startAmbientCycle();

  return {
    setState(mode = 'idle', options = {}) {
      if (AMBIENT_MODES.has(mode)) {
        if (needsAmbientReset) recreateVisual();
        startAmbientCycle();
        return Promise.resolve();
      }

      stopAmbientCycle({ resetVisual: true });
      needsAmbientReset = true;
      return visual.setState(mode, options);
    },
    showSuccessText(label = getDisplayName()) {
      stopAmbientCycle({ resetVisual: true });
      return visual.showSuccessText(label);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopAmbientCycle();
      visual.destroy();
      restoreCanvas();
    },
  };
}

function getDisplayName() {
  const title = String(document.title || '').trim();
  return title || 'Legal Dashboard';
}

function nextPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
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

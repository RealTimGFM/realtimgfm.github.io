// Keep the runtime and GLBs off the initial page load, including a collapsed lab.
export function initHomelabViewers(loadRuntime = () => import(
    '../../assets/homelab/model-viewer/model-viewer.min.js'
)) {
    const details = document.getElementById('homelabDetails');
    if (!details || details.dataset.viewersInitialized) return;

    const hardware = [...details.querySelectorAll('.homelab-hardware')];
    if (!hardware.length) return;
    details.dataset.viewersInitialized = 'true';
    const startModels = new Map();
    const rotationStates = new Map();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncRotations = () => {
        for (const sync of rotationStates.values()) sync();
    };
    let runtimePromise;
    let observer;

    const ensureRuntime = () => {
        if (!runtimePromise) {
            runtimePromise = Promise.resolve().then(() => {
                // Detect unavailable WebGL before downloading the large runtime.
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (!context) throw new Error('WebGL is unavailable');
                context.getExtension('WEBGL_lose_context')?.loseContext();
                return loadRuntime();
            }).then(() => {
                if (!window.customElements?.get('model-viewer')) {
                    throw new Error('The local 3D viewer could not initialize');
                }
            });
        }
        return runtimePromise;
    };

    for (const card of hardware) {
        const viewer = card.querySelector('model-viewer[data-model-src]');
        const fallback = card.querySelector('.homelab-model-fallback');
        const status = card.querySelector('.homelab-model-status');
        const tools = card.querySelector('.homelab-model-tools');
        if (!viewer || !fallback || !status || !tools) continue;

        card.dataset.modelState = 'idle';
        viewer.inert = true;
        viewer.setAttribute('aria-hidden', 'true');
        viewer.setAttribute('tabindex', '-1');
        viewer.removeAttribute('auto-rotate');
        viewer.setAttribute('rotation-per-second', '12deg');
        // A single timer below owns the complete interaction resume delay.
        viewer.setAttribute('auto-rotate-delay', '0');
        const buttons = [...tools.querySelectorAll('[data-model-action]')];
        const rotationButton = buttons.find(button => button.dataset.modelAction === 'rotate');
        let rotationEnabled = !motion.matches;
        let pausedByVisitor = false;
        let nearViewport = typeof IntersectionObserver === 'undefined';
        const activePointers = new Set();
        const activeKeys = new Set();
        let rotationTimer;
        const scheduleResume = () => {
            clearTimeout(rotationTimer);
            rotationTimer = setTimeout(() => {
                rotationTimer = undefined;
                syncRotation();
            }, 3000);
        };
        const syncRotation = () => {
            const available = nearViewport && !details.hidden && !details.inert &&
                !document.hidden && card.dataset.modelState === 'ready';
            // A hidden/collapsed viewer cannot retain a held gesture indefinitely.
            if (!available && (activePointers.size || activeKeys.size)) {
                activePointers.clear();
                activeKeys.clear();
                scheduleResume();
            }
            const rotating = rotationEnabled && available && !activePointers.size &&
                !activeKeys.size && rotationTimer === undefined;
            if (rotating) viewer.setAttribute('auto-rotate', '');
            else viewer.removeAttribute('auto-rotate');
            if (rotationButton) {
                rotationButton.textContent = rotationEnabled ? 'Pause rotation' : 'Start rotation';
            }
        };
        rotationStates.set(card, syncRotation);
        card.addEventListener('homelab:visibility', event => {
            nearViewport = event.detail;
            syncRotation();
        });
        motion.addEventListener('change', () => {
            rotationEnabled = !motion.matches && !pausedByVisitor;
            syncRotation();
        });
        const pauseRotation = () => {
            scheduleResume();
            syncRotation();
        };
        viewer.addEventListener('pointerdown', event => {
            activePointers.add(event.pointerId);
            pauseRotation();
        }, { passive: true });
        const endPointer = event => {
            if (activePointers.delete(event.pointerId)) pauseRotation();
        };
        window.addEventListener('pointerup', endPointer, { passive: true });
        window.addEventListener('pointercancel', endPointer, { passive: true });
        viewer.addEventListener('lostpointercapture', endPointer);
        window.addEventListener('blur', () => {
            if (!activePointers.size && !activeKeys.size) return;
            activePointers.clear();
            activeKeys.clear();
            pauseRotation();
        });
        viewer.addEventListener('wheel', pauseRotation, { passive: true });
        viewer.addEventListener('keydown', event => {
            activeKeys.add(event.key);
            pauseRotation();
        });
        window.addEventListener('keyup', event => {
            if (activeKeys.delete(event.key)) pauseRotation();
        });
        viewer.addEventListener('camera-change', event => {
            if (event.detail?.source === 'user-interaction') pauseRotation();
        });

        const unavailable = () => {
            card.dataset.modelState = 'unavailable';
            syncRotation();
            viewer.inert = true;
            viewer.hidden = true;
            viewer.setAttribute('aria-hidden', 'true');
            fallback.hidden = false;
            tools.hidden = true;
            status.textContent = 'Interactive 3D unavailable. Hardware preview shown.';
        };

        viewer.addEventListener('error', unavailable);
        viewer.addEventListener('load', () => {
            card.dataset.modelState = 'ready';
            viewer.hidden = false;
            viewer.inert = false;
            viewer.removeAttribute('aria-hidden');
            viewer.removeAttribute('tabindex');
            fallback.hidden = true;
            tools.hidden = false;
            syncRotation();
            status.textContent = 'Interactive 3D ready. Drag to rotate; scroll or pinch to zoom.';
        });

        for (const button of buttons) {
            button.addEventListener('click', () => {
                if (card.dataset.modelState !== 'ready') return;
                const action = button.dataset.modelAction;
                if (action === 'rotate') {
                    rotationEnabled = !rotationEnabled;
                    pausedByVisitor = !rotationEnabled;
                    clearTimeout(rotationTimer);
                    rotationTimer = undefined;
                    syncRotation();
                    return;
                }
                pauseRotation();
                if (action === 'reset') {
                    viewer.resetTurntableRotation();
                    viewer.cameraOrbit = viewer.dataset.initialOrbit;
                    viewer.jumpCameraToGoal();
                    return;
                }
                const orbit = viewer.getCameraOrbit();
                const radius = orbit.radius * (action === 'zoom-in' ? 0.8 : 1.25);
                viewer.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${radius}m`;
                if (motion.matches) {
                    viewer.jumpCameraToGoal();
                }
            });
        }

        startModels.set(card, async () => {
            if (details.hidden || details.inert || card.dataset.modelState !== 'idle') return;
            card.dataset.modelState = 'loading';
            status.textContent = 'Loading interactive 3D. Hardware preview shown.';
            try {
                await ensureRuntime();
                // The visitor may collapse the case study while the runtime loads.
                if (details.hidden || details.inert) {
                    card.dataset.modelState = 'idle';
                    status.textContent = 'Hardware preview. Expand the lab to explore in 3D.';
                    return;
                }
                viewer.setAttribute('src', viewer.dataset.modelSrc);
            } catch {
                unavailable();
            }
        });
    }

    const observeHardware = () => {
        if (details.hidden || details.inert) return;
        if (typeof IntersectionObserver === 'undefined') {
            for (const start of startModels.values()) start();
            return;
        }
        observer ??= new IntersectionObserver(entries => {
            for (const entry of entries) {
                entry.target.dispatchEvent(new CustomEvent('homelab:visibility', {
                    detail: entry.isIntersecting
                }));
                if (entry.isIntersecting) startModels.get(entry.target)?.();
            }
        }, { rootMargin: '240px 0px' });
        for (const card of hardware) {
            // Re-observe even after an interrupted collapse: a still-intersecting
            // card needs a fresh activation callback when its runtime was deferred.
            observer.unobserve(card);
            observer.observe(card);
        }
    };

    details.addEventListener('homelab:expanded', () => {
        observeHardware();
        syncRotations();
    });
    details.addEventListener('homelab:collapsed', syncRotations);
    document.addEventListener('visibilitychange', syncRotations);
    observeHardware();
}

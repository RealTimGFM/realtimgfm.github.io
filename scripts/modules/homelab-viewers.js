// Keep the runtime and GLBs off the initial page load, including a collapsed lab.
export function initHomelabViewers(loadRuntime = () => import(
    '../../assets/homelab/model-viewer/model-viewer.min.js'
)) {
    const details = document.getElementById('homelabDetails');
    if (!details) return;

    const hardware = [...details.querySelectorAll('.homelab-hardware')];
    if (!hardware.length) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const startModels = new Map();
    const visibility = new Map();
    const rotations = new Map();
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
        visibility.set(card, typeof IntersectionObserver === 'undefined');
        viewer.inert = true;
        viewer.setAttribute('aria-hidden', 'true');
        viewer.setAttribute('tabindex', '-1');

        const activePointers = new Set();
        const activeKeys = new Set();
        let rotationTimer;
        const updateRotation = () => {
            if (details.hidden || document.hidden || !visibility.get(card)
                || card.dataset.modelState !== 'ready' || reducedMotion.matches
                || activePointers.size || activeKeys.size || rotationTimer) {
                viewer.removeAttribute('auto-rotate');
            } else {
                viewer.setAttribute('auto-rotate', '');
            }
        };
        // Own the resume delay so held gestures and toolbar controls also pause rotation.
        const pauseRotation = () => {
            clearTimeout(rotationTimer);
            rotationTimer = setTimeout(() => {
                rotationTimer = undefined;
                updateRotation();
            }, 3000);
            updateRotation();
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
            if (event.detail.source === 'user-interaction') pauseRotation();
        });
        reducedMotion.addEventListener('change', updateRotation);
        rotations.set(card, updateRotation);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                activePointers.clear();
                activeKeys.clear();
            }
            updateRotation();
        });
        updateRotation();

        const unavailable = () => {
            card.dataset.modelState = 'unavailable';
            viewer.inert = true;
            viewer.hidden = true;
            viewer.setAttribute('aria-hidden', 'true');
            fallback.hidden = false;
            tools.hidden = true;
            status.textContent = 'Interactive 3D unavailable. Hardware preview shown.';
            updateRotation();
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
            status.textContent = 'Interactive 3D ready. Drag to rotate; scroll or pinch to zoom.';
            updateRotation();
        });

        for (const button of tools.querySelectorAll('[data-model-action]')) {
            button.addEventListener('click', () => {
                if (card.dataset.modelState !== 'ready') return;
                pauseRotation();
                const action = button.dataset.modelAction;
                if (action === 'reset') {
                    viewer.resetTurntableRotation();
                    viewer.cameraOrbit = viewer.dataset.initialOrbit;
                    viewer.jumpCameraToGoal();
                    return;
                }
                const orbit = viewer.getCameraOrbit();
                const radius = orbit.radius * (action === 'zoom-in' ? 0.8 : 1.25);
                viewer.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${radius}m`;
                if (reducedMotion.matches) {
                    viewer.jumpCameraToGoal();
                }
            });
        }

        startModels.set(card, async () => {
            if (details.hidden || card.dataset.modelState !== 'idle') return;
            card.dataset.modelState = 'loading';
            status.textContent = 'Loading interactive 3D. Hardware preview shown.';
            try {
                await ensureRuntime();
                // The visitor may collapse the case study while the runtime loads.
                if (details.hidden || !visibility.get(card)) {
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
        if (details.hidden) return;
        if (typeof IntersectionObserver === 'undefined') {
            for (const update of rotations.values()) update();
            for (const start of startModels.values()) start();
            return;
        }
        observer ??= new IntersectionObserver(entries => {
            for (const entry of entries) {
                visibility.set(entry.target, entry.isIntersecting);
                rotations.get(entry.target)?.();
                if (entry.isIntersecting) startModels.get(entry.target)?.();
            }
        }, { rootMargin: '240px 0px' });
        for (const card of hardware) {
            observer.observe(card);
        }
    };

    details.addEventListener('homelab:expanded', observeHardware);
    details.addEventListener('homelab:collapsed', () => {
        for (const card of hardware) {
            observer?.unobserve(card);
            visibility.set(card, typeof IntersectionObserver === 'undefined');
            rotations.get(card)?.();
        }
    });
    observeHardware();
}

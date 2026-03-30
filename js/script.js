document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('play-btn');
    const centerUI = document.getElementById('center-ui');
    const kingLeft = document.querySelector('.king-container.left');
    const kingRight = document.querySelector('.king-container.right');
    const flashScreen = document.getElementById('flash-screen');
    const launchStatus = document.getElementById('launch-status');
    const fallbackLink = document.getElementById('fallback-link');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let isAnimating = false;

    // Add some dynamic particle elements to background
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.setProperty('--size', `${Math.random() * 4 + 1}px`);
        p.style.setProperty('--x', `${Math.random() * 100}%`);
        p.style.setProperty('--y', `${Math.random() * 100}%`);
        p.style.setProperty('--duration', `${Math.random() * 10 + 5}s`);
        p.style.setProperty('--opacity', `${Math.random() * 0.5 + 0.1}`);
        particlesContainer.appendChild(p);
    }

    // Create the sword sound effect pointing to the local downloaded file
    const swordSound = new Audio('assets/audio/sword.mp3'); 
    swordSound.preload = 'auto'; // Preload for instant playback
    
    // Helper function for async waiting
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Fix for bfcache (Browser Back Button)
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            isAnimating = false;
            playBtn.disabled = false;
            playBtn.removeAttribute('aria-busy');
            centerUI.classList.remove('hidden');
            kingLeft.classList.remove('clash-left');
            kingRight.classList.remove('clash-right');
            if (launchStatus) launchStatus.textContent = '';
            if (fallbackLink) fallbackLink.classList.add('hidden');
        }
    });

    if (playBtn) {
        playBtn.addEventListener('click', async () => {
            if (isAnimating) return;
            isAnimating = true;
            playBtn.disabled = true;
            playBtn.setAttribute('aria-busy', 'true');
            if (launchStatus) launchStatus.textContent = 'Launching game...';

            const fallbackTimer = setTimeout(() => {
                if (launchStatus) launchStatus.textContent = 'If game does not open, use direct link below.';
                if (fallbackLink) fallbackLink.classList.remove('hidden');
            }, 4000);

            try {
                // Play sound
                swordSound.currentTime = 0;
                swordSound.play().catch(() => {});

                // Hide the center UI elements
                centerUI.classList.add('hidden');

                // After small delay, move kings towards each other
                await sleep(300);
                kingLeft.classList.add('clash-left');
                kingRight.classList.add('clash-right');

                if (!prefersReducedMotion) {
                    // Trigger flash just before they fully stop (1.5s css transition)
                    await sleep(1200);
                    flashScreen.classList.add('flash-active');

                    // Keep the flash for a bit then fade out
                    await sleep(300);
                    flashScreen.classList.remove('flash-active');

                    // Wait for fade out
                    await sleep(400);
                } else {
                    // If reduced motion, just wait out the full 1.5s transition
                    await sleep(1500);
                }

                // Restore state before navigating so UI remains coherent on browser back.
                kingLeft.classList.remove('clash-left');
                kingRight.classList.remove('clash-right');
                centerUI.classList.remove('hidden');
                playBtn.disabled = false;
                playBtn.removeAttribute('aria-busy');
                isAnimating = false;

                // Navigate directly to board play.
                window.location.assign('game.html');
            } catch (error) {
                if (launchStatus) launchStatus.textContent = 'Animation interrupted. Opening game directly...';
                window.location.assign('game.html');
            } finally {
                clearTimeout(fallbackTimer);
            }
        });
    }
});

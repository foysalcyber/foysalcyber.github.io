(() => {
  'use strict';

  const DISMISS_KEY = 'meal-ledger:pwa-dismissed-at';
  const INSTALLED_KEY = 'meal-ledger:pwa-installed';
  const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;
  let deferredInstallPrompt = null;
  let bannerTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(navigator.userAgent);

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || navigator.standalone === true;
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Storage can be blocked. */ }
  }

  function recentlyDismissed() {
    const value = Number(safeStorageGet(DISMISS_KEY));
    return Number.isFinite(value) && Date.now() - value < DISMISS_FOR_MS;
  }

  function installElements() {
    return {
      banner: $('#pwaInstallBanner'),
      bannerButton: $('#pwaInstallBannerButton'),
      dismissButton: $('#pwaInstallDismissButton'),
      settingsButton: $('#pwaInstallSettingsButton'),
      settingsTitle: $('#pwaInstallSettingsTitle'),
      settingsStatus: $('#pwaInstallSettingsStatus'),
      modal: $('#pwaInstallHelpModal'),
      modalTitle: $('#pwaInstallHelpTitle'),
      modalText: $('#pwaInstallHelpText'),
      steps: $('#pwaInstallSteps'),
      modalAction: $('#pwaInstallHelpAction'),
    };
  }

  function updateInstallUI() {
    const elements = installElements();
    const installed = isStandalone() || safeStorageGet(INSTALLED_KEY) === 'yes';

    if (installed) {
      elements.banner?.classList.add('is-hidden');
      if (elements.settingsButton) elements.settingsButton.disabled = true;
      if (elements.settingsTitle) elements.settingsTitle.textContent = 'App installed';
      if (elements.settingsStatus) elements.settingsStatus.textContent = 'Meal Ledger is available from your home screen or app launcher.';
      return;
    }

    if (elements.settingsButton) elements.settingsButton.disabled = false;
    if (elements.settingsTitle) elements.settingsTitle.textContent = deferredInstallPrompt ? 'Install Meal Ledger' : 'Add to your device';
    if (elements.settingsStatus) {
      elements.settingsStatus.textContent = deferredInstallPrompt
        ? 'Ready to install directly from this page.'
        : isIOS
          ? 'Add it to your iPhone or iPad Home Screen.'
          : 'Open a short device-specific installation guide.';
    }
  }

  function showBanner(force = false) {
    const { banner } = installElements();
    if (!banner || isStandalone()) return;
    if (!force && recentlyDismissed()) return;
    banner.classList.remove('is-hidden');
    requestAnimationFrame(() => banner.classList.add('is-visible'));
  }

  function hideBanner(remember = false) {
    const { banner } = installElements();
    if (!banner) return;
    banner.classList.remove('is-visible');
    window.setTimeout(() => banner.classList.add('is-hidden'), 220);
    if (remember) safeStorageSet(DISMISS_KEY, String(Date.now()));
  }

  function guideForDevice() {
    if (isIOS) {
      return {
        title: 'Add Meal Ledger to Home Screen',
        text: 'Apple requires this quick installation through Safari. It takes only a few seconds.',
        steps: [
          ['1', 'Open this page in Safari', 'If you are using another iOS browser, first open the page in Safari.'],
          ['2', 'Tap the Share button', 'Use the square icon with an upward arrow in Safari’s toolbar.'],
          ['3', 'Choose “Add to Home Screen”', 'Scroll the share sheet if the option is not immediately visible.'],
          ['4', 'Tap “Add”', 'Meal Ledger will appear on your Home Screen like a regular app.'],
        ],
      };
    }
    if (isAndroid) {
      return {
        title: 'Install Meal Ledger on Android',
        text: 'Your browser can add Meal Ledger as a standalone app.',
        steps: [
          ['1', 'Open the browser menu', 'Tap the three-dot menu in the top-right corner.'],
          ['2', 'Choose “Install app”', 'Some browsers call this “Add to Home screen”.'],
          ['3', 'Confirm Install', 'The app will appear on your Home Screen and in the app launcher.'],
        ],
      };
    }
    return {
      title: 'Install Meal Ledger',
      text: 'Use your browser’s built-in app installation option for a standalone window and quick access.',
      steps: [
        ['1', 'Look for the install icon', 'In Chrome or Edge it appears at the right side of the address bar.'],
        ['2', 'Or open the browser menu', 'Choose “Install Meal Ledger” or “Apps → Install this site as an app”.'],
        ['3', 'Confirm Install', 'Meal Ledger will be added to your desktop app launcher.'],
      ],
    };
  }

  function openInstallGuide() {
    const elements = installElements();
    if (!elements.modal) return;
    const guide = guideForDevice();
    elements.modalTitle.textContent = guide.title;
    elements.modalText.textContent = guide.text;
    elements.steps.innerHTML = guide.steps.map(([number, title, text]) => `
      <li><b>${number}</b><span><strong>${title}</strong><small>${text}</small></span></li>
    `).join('');
    elements.modal.classList.remove('is-hidden');
    document.body.classList.add('modal-open');
    window.setTimeout(() => elements.modalAction?.focus(), 50);
  }

  function closeInstallGuide() {
    const { modal } = installElements();
    modal?.classList.add('is-hidden');
    if (!document.querySelector('.modal-layer:not(.is-hidden)')) document.body.classList.remove('modal-open');
  }

  async function requestInstall() {
    if (isStandalone()) {
      updateInstallUI();
      return;
    }
    if (!deferredInstallPrompt) {
      hideBanner(false);
      openInstallGuide();
      return;
    }

    hideBanner(false);
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        safeStorageSet(INSTALLED_KEY, 'yes');
      }
    } catch (error) {
      console.warn('The browser could not show the install prompt.', error);
      openInstallGuide();
    }
    updateInstallUI();
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    try {
      await navigator.serviceWorker.register('./service-worker.js?v=1.3.0', {
        scope: './',
        updateViaCache: 'none',
      });
    } catch (error) {
      console.warn('Meal Ledger offline shell could not be registered.', error);
    }
  }

  function initialize() {
    const elements = installElements();
    elements.bannerButton?.addEventListener('click', requestInstall);
    elements.settingsButton?.addEventListener('click', requestInstall);
    elements.dismissButton?.addEventListener('click', () => hideBanner(true));
    elements.modalAction?.addEventListener('click', closeInstallGuide);
    elements.modal?.querySelectorAll('[data-pwa-close]').forEach((button) => {
      button.addEventListener('click', closeInstallGuide);
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      updateInstallUI();
      window.clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => showBanner(false), 2_000);
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      safeStorageSet(INSTALLED_KEY, 'yes');
      hideBanner(false);
      updateInstallUI();
    });

    window.matchMedia('(display-mode: standalone)').addEventListener?.('change', updateInstallUI);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.modal?.classList.contains('is-hidden')) closeInstallGuide();
    });

    updateInstallUI();
    if (!isStandalone() && !recentlyDismissed()) {
      // iOS has no beforeinstallprompt event. Other browsers still receive a
      // discoverable guide if their native event is delayed or unsupported.
      bannerTimer = window.setTimeout(() => showBanner(false), isIOS ? 3_500 : 6_500);
    }
    registerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();

import * as React from "react";

const STANDALONE_QUERY = "(display-mode: standalone)";

function isIOS() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isStandalone() {
  // `navigator.standalone` is Safari-only (iOS home-screen apps).
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia(STANDALONE_QUERY).matches;
}

function subscribeStandalone(onChange: () => void) {
  const mql = window.matchMedia(STANDALONE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function subscribeNever() {
  return () => {};
}

/** True on an iPhone or iPad, in Safari or as an installed PWA. */
export function useIsIOS() {
  return React.useSyncExternalStore(subscribeNever, isIOS, () => false);
}

/** True when the panel runs as an installed PWA (home-screen app) on iPhone or iPad. */
export function useIsIOSPWA() {
  return React.useSyncExternalStore(
    subscribeStandalone,
    () => isIOS() && isStandalone(),
    () => false,
  );
}

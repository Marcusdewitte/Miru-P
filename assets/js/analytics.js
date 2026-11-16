import { getConsent, onConsent } from './cookies.js';

const GA_ID = 'G-DYPJ0YXCZZ';
let loaded = false;

// GA only loads after "Accept"
function loadGtag() {
  if (loaded) return;
  loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments); // gtag expects the arguments object
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.append(s);
}

export default function initAnalytics() {
  if (getConsent() === 'accepted') loadGtag();
  onConsent((choice) => choice === 'accepted' && loadGtag());
}

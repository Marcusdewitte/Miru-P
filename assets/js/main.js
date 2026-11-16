import startAtTop from './scroll.js';
import initHero from './hero.js';
import initNav from './nav.js';
import initStories from './stories.js';
import initReveal from './reveal.js';
import initServices from './services.js';
import initCookies from './cookies.js';
import initAnalytics from './analytics.js';
import initContactForm from './contact-form.js';
import initFooterMark from './footer-mark.js';
import initLogoMark from './gl/logo-mark.js';
import initHeroField from './gl/hero-field.js';
import initScenes from './gl/scenes.js';

startAtTop();
document.documentElement.classList.add('js');

initHero();
initNav();
initStories();
initReveal();
initServices();

initCookies();
initAnalytics();
initContactForm();
initFooterMark();

// WebGL bits — three.js is loaded as a deferred classic script before this module
if (window.THREE) {
  initLogoMark();
  initHeroField();
  initScenes();
}

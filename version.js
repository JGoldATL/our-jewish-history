/* The one place the site version lives. Every merge to main bumps it. Shown bottom right on every page. */
window.SITE_VERSION='3.2.0';
/* The one place the data version lives (the Master Sheet version Dataset confirms). Every footer reads it: "v<site>; data <data>". Dataset tells Build when it changes; tests/footer_version.js checks every data file still says this version. */
window.SITE_DATA_VERSION='v4.1.0';

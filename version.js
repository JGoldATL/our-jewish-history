/* The one place the site version lives. Every merge to main bumps it. Shown bottom right on every page. */
window.SITE_VERSION='3.5.0';
/* The one place the data version lives (the Master Sheet version Dataset confirms). Every footer reads window.SITE_FOOTER, built below: "v<site>, d<data>", for example "v3.3.1, dv5.0.0" (Jeffrey, 2026-11-02). Dataset tells Build when it changes; tests/footer_version.js checks every data file still says this version. */
window.SITE_DATA_VERSION='v5.0.0';
/* The footer text on every page: site version, then the data version with a d in front. One place, so every page agrees. */
window.SITE_FOOTER='v'+window.SITE_VERSION+', d'+window.SITE_DATA_VERSION;

COMPUTER U-TEACH — WEBSITE

Includes the latest website with the interactive 3D hero, articulated Byte robot, platform running and jumping, navigation chat, and motion controls.

RUN LOCALLY
1. Extract this ZIP.
2. Open a terminal in the computer-uteach folder (the folder containing index.html).
3. If Python is installed, run: python -m http.server 8000
4. Open http://localhost:8000 in your browser.

Use a local web server rather than double-clicking index.html: the robot uses JavaScript modules that browsers restrict on file:// URLs.

HOSTING
Upload the contents of this folder to any static website host, including GitHub Pages. No build step is required. Keep the assets folder beside index.html.

NOTES
- Byte's chat uses predefined site-navigation guidance; it does not require an AI API key.
- Booking uses the existing external scheduling service. The contact form opens an email draft.
- Web fonts and the booking calendar require internet access. Three.js and the website images are included locally.
- Desktop visitors see Byte run and jump; mobile visitors get a stationary, accessible chat launcher.
- Pause motion and system reduced-motion preferences are supported.
- Three.js license: assets/vendor/THREE-LICENSE.txt

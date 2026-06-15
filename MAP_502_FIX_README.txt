MAP 502 FIX

Problem you saw:
  http://127.0.0.1:5495/osm-b/... -> 502 Bad Gateway

Fix in this version:
  OSM base-map tiles no longer go through the local Node proxy.
  OSM is loaded directly by Chromium/browser.
  NSPD/API/WMS still uses the corporate proxy:
  http://192.168.227.254:3128

Test:
  run-work-map-fixed.cmd

Build EXE:
  build-work-exe-map-fixed.cmd

If npm install is blocked at work, install dependencies once at home, then copy the full folder with node_modules to work.

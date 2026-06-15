BUILD LEGAL DASHBOARD TO WINDOWS EXE

1. Install Node.js LTS: https://nodejs.org/
2. Extract the archive.
3. Open the legal-dashboard folder.
4. Run build-exe.cmd.
5. Output files will be in release/.

This version includes app.db, SQLite API, general cases, map and Electron build.

AUDIT FIX

This package uses sqlite3 ^6.0.1.
If npm still reports old vulnerabilities, run:

  fix-npm-audit.cmd

Then run:

  build-exe.cmd

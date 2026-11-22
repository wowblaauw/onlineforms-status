# Who checks what

Set up 22 November 2026 at Craig's request.

| Who | Where | How often | Does |
|---|---|---|---|
| Abel | iMac Pro (HailBot), `~/onlineforms-watch/` | every 5 minutes (launchd `app.onlineforms.abel-check`) | Runs `check.mjs` with `CHECKER=abel`; pushes `status.json` on a change and `abel.json` (heartbeat) at least every 15 minutes. Skips when the workshop connection is down. |
| Cain | MacBook Pro (Cain), `~/onlineforms-watch/` | every 5 minutes (launchd `app.onlineforms.cain-watch`) | Runs `cain/cain-watch.mjs`; Telegrams Craig when OnlineForms fails or recovers, when Abel is quiet for 25 minutes, and once the connection is back after 15+ minutes offline. |
| GitHub | this repository's Actions | every 30 minutes, often later | Backstop off the workshop broadband: checks the site, opens an issue (GitHub emails Craig) on a problem, and when `abel.json` is older than 60 minutes. |

Stop Abel: `launchctl bootout gui/$(id -u)/app.onlineforms.abel-check` on the iMac.
Stop Cain's watch: `launchctl bootout gui/$(id -u)/app.onlineforms.cain-watch` on Cain's Mac.
Logs: `~/onlineforms-watch/*.log` on each machine.

Planned: a mobile router at the workshop so a broadband cut does not stop Abel and Cain.

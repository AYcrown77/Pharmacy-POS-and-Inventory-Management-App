# Running the platform in the pharmacy

One PC is the server: it holds the database and runs both apps. Every other
machine is just a browser pointed at it. Nobody ever opens a terminal.

This folder sets that up on Windows.

---

## 1. Give the server a permanent address

The address changed because the router hands out addresses on a lease
(DHCP), and a lease can come back different after a reboot. Two fixes, and you
want both.

**a. Pin the address at the router (preferred).**
Open the router's admin page → DHCP settings → *Address Reservation* (some
call it *Static Lease* or *Bind IP to MAC*). Find the server PC and reserve
its current address. Get the PC's address and network card ID with:

```powershell
ipconfig /all
```

The reservation ties the address to that network card for good, and nothing on
the PC needs changing. If the shop's router is replaced, redo this step.

**If the router cannot do reservations**, set the address on the PC itself.
As Administrator, in the `mustaan-frontend` folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\set-static-ip.ps1 -IPAddress 192.168.1.10
```

It keeps the current gateway, subnet and DNS servers, refuses an address that
something already answers on, and checks the connection still works before it
finishes. Pick an address *outside* the range the router hands out
automatically, and low numbers are usually safest.

If the laptop is ever taken to another network, put it back on automatic first:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\set-static-ip.ps1 -Revert
```


**b. Use the PC's name instead of its address.**
Windows machines find each other by name on the same network, whatever the
address is. Give the server a short name once:

```powershell
Rename-Computer -NewName "mustan" -Restart
```

Then every till opens **`http://mustan/`** and keeps working even if the
address does change. Type it with the `http://` in front, or the browser will
treat it as a search.

> Use a network cable for the server if you can. Wi-Fi drops; the counter
> should not depend on it.

---

## 2. Install (once, on the server PC)

Install Node.js and PostgreSQL first, and make sure `mutaan-backend\.env` has
the database password filled in.

Open PowerShell **as Administrator** in the `mustaan-frontend` folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build.ps1
powershell -ExecutionPolicy Bypass -File .\deploy\install.ps1
```

`build.ps1` compiles both apps for production, runs any database migrations,
and checks the two `.env` files agree on the API's port.

`install.ps1` then:

- registers both apps to start **at boot, before anyone logs in**, and to
  restart themselves a minute later if they ever stop;
- opens the firewall for the platform's port only — the API's own port stays
  closed, since the tills reach it through the platform;
- stops the PC sleeping while it is plugged in;
- schedules a nightly database backup at 10pm;
- prints the address the tills should use.

Port 80 is the default, so the staff type no port number at all. If something
else on that PC already uses port 80, install with `-Port 3000` instead.

---

## 3. Set up each till (once per machine)

Make a desktop shortcut that opens the platform full screen:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=http://mustan/pos
```

Use `/pos` for the counter machines and `/dashboard` for the back office. Set
the same address as the browser's home page, so it comes back after a restart.
Press `Alt+F4` to leave kiosk mode.

---

## 4. Day to day

Nothing. Switch the PC on and the platform is up within a few seconds.

| I want to… | Command (PowerShell, in `mustaan-frontend`) |
|---|---|
| check it is running | `powershell -ExecutionPolicy Bypass -File .\deploy\status.ps1` |
| apply an update after `git pull` | `powershell -ExecutionPolicy Bypass -File .\deploy\update.ps1` *(as Administrator)* |
| back up right now | `powershell -ExecutionPolicy Bypass -File .\deploy\backup-db.ps1` |
| stop it running automatically | `powershell -ExecutionPolicy Bypass -File .\deploy\uninstall.ps1` *(as Administrator)* |

Backups land in `deploy\backups` and are kept for 30 days. **Copy them off the
PC** — a flash drive or an external disk, weekly. A backup on the same machine
does not survive that machine dying.

Restoring one:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -d mustan_pharmacy --clean deploy\backups\<file>.dump
```

Logs are in `deploy\logs`, one file per start, kept for 14 days.

---

## 5. Things worth knowing

- **Do not open the API's port in the firewall.** The tills only need the
  platform's port; the API answers it locally.
- **Keep `COOKIE_SECURE` off** in `mutaan-backend\.env` while the shop runs on
  plain `http://`. A "secure" cookie is only ever sent over HTTPS, so turning
  it on would sign everyone out at the login screen with no error to explain
  it. Turn it on only if the platform is ever put behind HTTPS.
- **Change the admin password** and give every member of staff their own
  account. The audit trail is only worth having if accounts are not shared.
- **Windows updates** reboot the PC. That is fine — both apps come back on
  their own. Schedule the restart outside opening hours.

# Gerald Wants Up — roadmap / notes for later

## Mobile app store version (iOS / Android) — TODO, don't forget
- **Watch an ad → get 1 Golden Sock, at most once per day.** (Golden Socks normally fall VERY rarely; one
  activates a Super Frenzy.) The game already has the hook for this: call `GAME.giveGoldenSock("ad")`
  after the ad finishes. The once-per-day limit must use server time (`GUARD.CLOCK.now()`, not the
  phone's clock) and be stored in the save, e.g. `S.adSockDay` = the server day number of the last ad.
- Use the app stores' own ad/reward SDK (AdMob rewarded ads etc.) through the native wrapper.

## Ideas parked for later
- Steam leaderboards (highest altitude, most transplants) would need server-side checking to be fair.

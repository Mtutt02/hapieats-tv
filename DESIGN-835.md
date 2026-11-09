# DESIGN-835: Stations counts and honest render UI

## Who
A viewer on a phone (390px) browsing Stations. Creators only meet the render change if they open the legacy editor.

## Top 3 jobs (one primary action per screen)
1. See which stations have videos. Primary action on the list: open a station.
2. Open a station. Primary action on a station page: watch a video.
3. Watch. Primary action: play.

## What is there today (text wireframes)

Stations list (`/stations`):
```
Stations                      <- title + one line of help
[Global Foods banner]         <- link
[Featured station card]       <- first by followers, "N videos"
[card][card]...               <- cover, name, description, followers, "N videos"
[+ Create a Station]
```
Station page (`/stations/[slug]`):
```
[banner]
[icon] Name   followers / "N videos"   [Follow] [Upload here]
description
Videos
  grid of video cards   OR   empty state ("No videos yet in this station")
```

## Where the change fits
- The "N videos" number on the list comes from a stored column nobody updates. The station page counts live rows with a different filter. They disagree. Fix: both read ONE helper (`lib/stations/videos.ts`). No layout change.
- A video is shown and counted when: status = ready, visibility = public, and is_clip is not true. A null is_clip is a normal video. (`.neq('is_clip', true)` in SQL silently drops nulls; `.eq('is_clip', false)` on the TV page does too.)
- Empty state keeps its shape but gets a plain next step: a station with 0 videos says "No videos here yet" and offers "Upload a video". Copy no longer promises something false.
- Render: the legacy editor's Export button calls a server route that is a placeholder. The route now answers 503 with a stable code, and the editor shows an inline note instead of `alert()`.

## Scenarios
| Case | What the viewer sees |
|---|---|
| Station with 0 videos | Card shows "0 videos". Page shows empty state with "Upload a video". |
| Clips only | Counted as 0 videos (clips live in Clips, not stations). Same empty state. |
| Null is_clip rows | Counted and listed as normal videos. |
| Not ready / private / unlisted | Not counted, not listed. |
| Slow / offline data | Query error gives an empty list with a visible "Couldn't load videos, try again" line on the station page. No fake zero claim. |
| Loading | Server rendered (revalidate 60s), so no spinner state. |
| Render service offline | Export button shows "Rendering is offline right now, try again later" inline. No success state, no endless spinner, button locked while a request is in flight. |

## Light/dark and mobile
No new colors. Existing tokens (`text-muted-foreground`, `border-border`) only, so both themes follow the existing styles.

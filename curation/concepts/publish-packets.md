# Semi-Automatic Publish Packets

The goal is automatic transmission, not autonomous posting.

Robot 790 should be able to assemble the materials for a public post, but Scott
keeps the final judgment: what goes out, where it goes, and when.

## Packet Shape

Each publishable run can produce a folder like:

```text
publish-packets/
  20260903-215205-the-note-that-marked-its-own-evidence/
    video.mp4
    cover.jpg
    caption.md
    alt-text.md
    hashtags.txt
    links.md
    manifest.json
```

The packet is not the post. It is the tray of ready parts.

When the video and cover are already published in `docs/`, the packet should
usually reference those files instead of copying large media again. A full
export copy can come later if a platform needs direct upload files gathered in
one local folder.

## Desired Interaction

The user-facing shape should be closer to:

```text
I am proud of this run.
Make me a publish packet.
```

Then the system gathers the reviewed artifacts, drafts the platform text, makes
the covers and links, and leaves Scott with a small number of final choices.

The button should not mean "post this everywhere." It should mean "prepare the
social work so I can say yes, tweak, or no."

That preserves the important boundary:

```text
automatic packaging, human publication judgment
```

The social UI should offer a roster of do-ables, especially while Scott is still
learning the platforms:

```text
YouTube: ready video, title, description, thumbnail, tags
Instagram: ready video/image, caption, hashtags, cover
Reddit: subreddit-safe title, short context post, link, disclosure note
GitHub/docs: article, media entry, catalog, receipts
NotebookLM: source article/notes and cover art packet
```

This is not an engagement or monetization machine. The goal is to help
interesting artifacts travel to people who might care, while keeping the tone
honest, low-pressure, and visibly handmade.

## Required Pieces

- `video.mp4`: final reviewed video, compressed enough for social upload.
- `cover.jpg`: square or platform-appropriate cover frame.
- `caption.md`: human-readable caption draft.
- `alt-text.md`: image/video accessibility description.
- `hashtags.txt`: small hashtag set, not spammy.
- `links.md`: docs article, GitHub page, related video, and source receipts.
- `manifest.json`: machine-readable metadata.

## Manifest Draft

```json
{
  "id": "20260903-215205-the-note-that-marked-its-own-evidence",
  "title": "The Note That Marked Its Own Evidence",
  "date": "2026-09-03",
  "run_id": "20260903-215205",
  "video": "video.mp4",
  "cover": "cover.jpg",
  "caption": "caption.md",
  "alt_text": "alt-text.md",
  "hashtags": "hashtags.txt",
  "links": {
    "article": "https://dr3d.github.io/robot-790/?article=articles/the-note-that-marked-its-own-evidence.md#article-reader",
    "video": "https://dr3d.github.io/robot-790/?media=media/videos/The-Note-That-Marked-Its-Own-Evidence-2026-09-03-215205.mp4#media",
    "github": "https://github.com/dr3d/robot-790"
  },
  "status": "draft",
  "platforms": {
    "instagram": {
      "format": "reel-or-feed-video",
      "posted": false,
      "url": ""
    },
    "youtube": {
      "format": "short-or-video",
      "posted": false,
      "url": ""
    }
  }
}
```

## Caption Style

The caption should invite curiosity without overclaiming.

Good posture:

```text
Robot 790 / Eric wrote a run summary and marked what he did not verify himself.
That tiny provenance note may be one of the cleaner findings from the project:
presence is interesting, but receipts keep it honest.

Full article and run video on the docs site.
```

Avoid:

```text
My robot became self-aware.
```

The public voice should be: this is an embodied local AI companion project, the
mechanism is visible, the failures are part of the evidence, and the adventure is
worth watching.

## Workflow

1. Finish a run.
2. Capture raw artifacts: conversation, events, Brain 2 mull, audio, video,
   generated images, settings, and Eric's own summary.
3. Build or choose the reviewed video.
4. Choose the cover.
5. Write curation: postmortem, public note, and caption.
6. Generate the publish packet.
7. Scott reviews the packet.
8. Scott manually posts or schedules it.
9. Record posted URLs back into `manifest.json` if useful.

## Content Boundary

The social layer should help a good run travel farther without changing why the
run happened.

Rule:

```text
Run honestly first.
Harvest content afterward.
```

Do not start a session by steering Eric toward a clip. Let the companion work,
the build work, or the lab work happen for its own sake. Afterward, if the run
contains something Scott is proud of, the packet builder can turn it into social
materials.

This keeps Eric from becoming a content puppet and keeps Scott out of the
draining parts: resizing, captions, alt text, link gathering, thumbnail naming,
and platform-specific drafts.

## Why Not Full Autopost Yet

Instagram automation through the official API requires account setup, OAuth,
public media hosting, media container creation, status polling, and publishing.
That is a real subsystem and easy to over-automate.

For now, the right level is:

```text
Codex prepares the packet.
Scott decides and posts.
The repo keeps the receipts.
```

That keeps the clutch work low without removing Scott from the public judgment
loop.

## Future Tooling

A later script can generate packets from a known docs media item:

```powershell
.\scripts\build_publish_packet.ps1 `
  -RunId 20260903-215205 `
  -Video docs\media\videos\The-Note-That-Marked-Its-Own-Evidence-2026-09-03-215205.mp4 `
  -Cover docs\media\previews\The-Note-That-Marked-Its-Own-Evidence-2026-09-03-215205.jpg `
  -Article docs\articles\the-note-that-marked-its-own-evidence.md
```

The first version can be dumb and useful: copy files, write a manifest, draft a
caption, and leave everything in a folder for review.

# Public Media

Drop compressed public media here. Treat this folder as the public museum, not
the workshop.

Supported by the static page:

- `.mp4`, `.webm`, `.mov` video
- `.mp3`, `.wav`, `.m4a`, `.ogg` audio

Suggested folders:

- `images/` for still images
- `videos/` for compressed publishable videos
- `audio/` for audio clips
- `raw-video/` for large local originals that should not be committed
- `rejected/` for compressed outputs that are still too large to publish

Large original captures should stay local until compressed, stripped of private
metadata, or moved to a release asset / Git LFS path. Files in
`docs/media/raw-video/` are ignored by git.

Publishing rule of thumb:

- Prefer public videos under 25 MB.
- Avoid committing files over 50 MB unless there is a deliberate reason.
- GitHub blocks normal git pushes for individual files over 100 MB.
- Keep originals in ignored raw folders so the public copy can be regenerated.

The helper script `scripts/compress_docs_videos.ps1` writes publishable videos
to `videos/` and moves oversized results into `rejected/`.

After changing public media, rebuild the static catalog:

```powershell
.\scripts\build_docs_catalog.ps1
```

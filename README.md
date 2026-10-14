# AdLens – Meta Ad Library Analyzer

A lightweight Chrome extension (Manifest V3) that scans, analyzes, saves and exports ads from the [Meta Ad Library](https://www.facebook.com/ads/library/). Built for competitor research, creative inspiration and quick data analysis — no account, server or API key needed. Everything runs locally in your browser.

## Features

- **Scan & Live scan** – Detects every ad card on the page (by its Library ID) and keeps collecting new ones as you scroll.
- **Auto-scroll** – Scrolls the page automatically until a target number of ads is collected (default 100).
- **Extracted data per ad** – Advertiser, status (Active/Inactive), start/end date, days running, number of variants, media type (Image/Video), CTA, ad copy, landing URL, thumbnail and Ad Library link.
- **Filter & sort** – Filter by advertiser, copy, CTA or domain; sort by days running, variants or name.
- **Insights tab** – Totals, active and video share, average run length, average copy length, top advertisers, longest-running ads (winner signal), top CTAs, top keywords, common hooks (first 3 words) and landing domains.
- **Saved tab** – Star ads to keep them across sessions (stored with `chrome.storage.local`).
- **Export** – Download the current list as **CSV** or **JSON**.
- **Copy text** – Copy an ad's copy to the clipboard in one click.

## Installation

1. Download or clone this repository:
   ```bash
   git clone https://github.com/ferdousnahid95/adlens-extension.git
   ```
2. Open `chrome://extensions` in Chrome (or any Chromium browser such as Edge or Brave).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder (the one that contains `manifest.json`).

## Usage

1. Go to the [Meta Ad Library](https://www.facebook.com/ads/library/) and search for a keyword or advertiser.
2. The AdLens panel appears on the page. Click the extension icon to show or hide it.
3. Click **Scan page**, or leave **Live scan** on and scroll. Use **Auto-scroll** to collect ads up to the target count.
4. Browse the **Ads**, **Insights** and **Saved** tabs, filter or sort, then export with **CSV** / **JSON**.

## Project structure

```
├── manifest.json   # Extension manifest (MV3)
├── background.js   # Toggles the panel when the toolbar icon is clicked
└── content.js      # Ad extraction, analysis, UI panel, storage and export
```

## Permissions

| Permission | Why |
|---|---|
| `storage` | Keep your saved ads between sessions |
| `https://www.facebook.com/ads/library/*` | Run only on Meta Ad Library pages |

No data is sent anywhere — all scanning and analysis happens in your browser.

## Notes

- Extraction relies on the text layout of the Ad Library page. If Meta changes its layout, some fields may need updating.
- Use the data responsibly and in line with Meta's terms of service.

## License

MIT

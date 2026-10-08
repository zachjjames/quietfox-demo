# QuietFox (demo)

**Someone to talk to before you sleep.** QuietFox pairs adults for calm, anonymous, one-on-one voice calls. It's peer support, not therapy.

▶ **[Try the live demo](https://zachjjames.github.io/quietfox-demo/)**

> This repo is an interactive front-end demo that runs entirely in your browser on sample data. It has no server, so there are no real accounts, matching, audio, or messages. The full application is in active development, and its source code is private.

## What you can try

- Sign up with an 18+ age check, verify a phone (any 6 digits work), and set up a profile
- Tap **Start talking** to get "matched" and see the call screen, including skip-with-a-reason and reporting
- After a call, rate it and send a "stay connected" request
- Chat with connections. Messages that contain contact info (phone numbers, emails, social handles) are blocked before they send
- Block and unblock people, edit settings, and reach crisis helplines from any screen
- Use the **Screens** button (bottom right) to jump to any screen

## The full app (private)

| Layer | Tech |
|---|---|
| Front end | HTML, CSS, vanilla JavaScript |
| Back end | PHP REST-style API |
| Database | MariaDB (MySQL) |
| Voice | WebRTC peer-to-peer audio |
| Messaging | End-to-end encrypted with the Web Crypto API |

The production version also includes real-time matching, encrypted chat, and a safety and moderation system with an admin dashboard. None of that is part of this demo.

## Running it locally

There's nothing to build. Download the repo and open `index.html` in a browser.

---

© 2026 Zach James. All rights reserved. This code is shared for viewing only.

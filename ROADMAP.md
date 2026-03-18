# Chaos Player Roadmap

```mermaid
gantt
  title Chaos Player Roadmap — Cycle 13
  dateFormat YYYY-MM-DD

  section Completed
    MVP Foundation (Schema/Auth/Rooms)          :done, c1, 2026-03-18, 3d
    YouTube Search & Embedded Player            :done, c2, after c1, 4d
    Error Resilience & Integration Tests        :done, c3, after c2, 4d
    Leaderboards & Host Moderation              :done, c4, after c3, 5d
    Room Page & Auto-Advance Orchestration      :done, c5, after c4, 5d
    Source-Agnostic Queue & Winner Toasts       :done, c6, after c5, 3d
    GDPR Right to Erasure (Self-Destruct UI)    :done, c7, 2026-03-18, 5d

  section Now (Cycle 13)
    Resilient Bootstrap Orchestration           :active, c13-1, 2026-03-19, 2d
    Browser Autoplay Guard UI                   :active, c13-2, after c13-1, 2d
    Crowd Pleaser Token Rewards                 :active, c13-3, after c13-2, 3d
    Priority Queue Bump Spend                   :active, c13-4, after c13-3, 2d

  section Next (Cycles 14-15)
    Spotify Source Abstraction & Auth           :next1, 2026-03-25, 10d
    GDPR Data Portability (Export API)          :next2, after next1, 2d
    Mobile-optimized PWA                        :next3, after next2, 10d

  section Future (Cycle 16+)
    AI-assisted Queue Suggestions               :future1, after next3, 14d
    Smart Playlist Generation (Theme-based)     :future2, after future1, 10d
```

# Chaos Player Roadmap

```mermaid
gantt
  title Chaos Player Roadmap — Cycle 7
  dateFormat YYYY-MM-DD

  section Completed
    MVP Foundation (Schema/Auth/Rooms)          :done, c1, 2026-03-18, 3d
    YouTube Search & Embedded Player            :done, c2, after c1, 4d
    Error Resilience & Integration Tests        :done, c3, after c2, 4d
    Leaderboards & Host Moderation              :done, c4, after c3, 5d
    Room Page & Auto-Advance Orchestration      :done, c5, after c4, 5d
    Source-Agnostic Queue & Winner Toasts       :done, c6, after c5, 3d

  section Now (Cycle 7)
    GDPR Right to Erasure (Self-Destruct UI)    :done, c7, 2026-03-18, 5d

  section Next (Cycles 8-9)
    Spotify Source Abstraction & Auth           :next1, 2026-03-18, 10d
    Token Earn Events (Reward Loop)             :next2, after next1, 3d
    GDPR Data Portability (Export API)          :next3, after next2, 2d
    Mobile-optimized PWA                        :next4, after next3, 10d

  section Future (Cycle 10+)
    AI-assisted Queue Suggestions               :future1, after next3, 14d
    Smart Playlist Generation (Theme-based)     :future2, after future1, 10d
```

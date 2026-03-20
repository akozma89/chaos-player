# Chaos Player Roadmap

```mermaid
gantt
  title Chaos Player Roadmap — Cycle 21
  dateFormat YYYY-MM-DD

  section Completed
    MVP Foundation (Schema/Auth/Rooms)          :done, c1, 2026-03-18, 3d
    YouTube Search & Embedded Player            :done, c2, after c1, 4d
    Error Resilience & Integration Tests        :done, c3, after c2, 4d
    Leaderboards & Host Moderation              :done, c4, after c3, 5d
    Room Page & Auto-Advance Orchestration      :done, c5, after c4, 5d
    Source-Agnostic Queue & Winner Toasts       :done, c6, after c5, 3d
    GDPR Right to Erasure (Self-Destruct UI)    :done, c7, 2026-03-18, 5d
    Spotify Source Abstraction & Auth (PKCE)    :done, c18, 2026-03-19, 5d
    Playlist Resilience (Autoplay Guard UI)     :done, c19, 2026-03-19, 5d

  section Now (Cycle 21)
    Resilient Bootstrap State Machine           :active, c21-1, 2026-03-20, 2d
    Public Room Discovery (Homepage List)       :active, c21-2, after c21-1, 3d
    Vibe Master Reward Tiers (Gamification)     :active, c21-3, after c21-2, 2d

  section Next (Cycles 22-23)
    GDPR Data Portability (Export API)          :next1, 2026-03-25, 2d
    Mobile-optimized PWA                        :next2, after next1, 10d
    Smart Playlist Generation (Theme-based)     :next3, after next2, 10d

  section Future (Cycle 24+)
    AI-assisted Queue Suggestions               :future1, after next3, 14d
    Room Branding & Cosmetic Token Spends       :future2, after future1, 10d
```

### Strategic Priorities (Cycle 21)
1.  **Seamlessness**: Harden the bootstrap process to eliminate the "Playlist never starts" bug across all client scenarios.
2.  **Reach**: Fulfill the top user request to list public rooms on the homepage, driving growth through discovery.
3.  **Engagement**: Extend the gamification loop with multi-tiered token rewards for high-quality contributions.

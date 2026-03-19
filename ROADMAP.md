# Chaos Player Roadmap

```mermaid
gantt
  title Chaos Player Roadmap — Cycle 19
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

  section Now (Cycle 19)
    Playlist Resilience (Autoplay Guard UI)     :active, c19-1, 2026-03-19, 2d
    Resilient Bootstrap & RPC Hardening         :active, c19-2, after c19-1, 2d
    Crowd Pleaser Token Rewards (Gamification)  :active, c19-3, after c19-2, 3d

  section Next (Cycles 20-21)
    GDPR Data Portability (Export API)          :next1, 2026-03-25, 2d
    Mobile-optimized PWA                        :next2, after next1, 10d
    Smart Playlist Generation (Theme-based)     :next3, after next2, 10d

  section Future (Cycle 22+)
    AI-assisted Queue Suggestions               :future1, after next3, 14d
    Room Branding & Cosmetic Token Spends       :future2, after future1, 10d
```

### Strategic Priorities (Cycle 19)
1. **Seamlessness**: Eliminate the "Playlist never starts" bug through a branded Autoplay Guard UI that turns browser restrictions into an engagement moment.
2. **Fairness**: Harden the democratic bootstrap logic to ensure the highest-voted tracks always start first, even under high concurrency.
3. **Engagement**: Expand the token economy with 'Crowd Pleaser' rewards to encourage high-quality contributions.

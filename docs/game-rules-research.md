# Familiada / Family Feud — Game Rules Research

> Deep research conducted 2026-08-05 for the Familiada web implementation project.
> Sources: Wikipedia (pl & en), Family Feud official resources, existing GitHub implementations.

---

## 1. Game Flow Diagram (Step by Step)

```
┌─────────────────────────────────────────────────────────────┐
│                    GAME START                                │
│  Two teams: 4-5 players each. Rotating champion system.     │
│  Target: First to ≥300 points → advances to Finał (Fast Money)│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ROUND SETUP                                                │
│  - Host selects question (3-6 answers hidden on board)      │
│  - Point multipliers: R1=×1, R2=×1, R3=×2, R4=×3, R5=×3    │
│  - Bank starts at 0                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: FACE-OFF (Pojedynek)                              │
│  - Two players at podium (beczka)                           │
│  - Buzzer ARMED → host reads question                       │
│  - First player to buzz answers                             │
│  - If answer is #1 (most popular) → their team wins FACEOFF │
│  - Otherwise, opponent answers                              │
│  - Higher-scoring answer wins face-off                      │
│  - TIE → first answerer wins                                │
│  - NEITHER correct → next pair from each team (alternating) │
│  - After 4 wrong answers → question changed                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  DECISION: PLAY or PASS?                                     │
│  - Since Sept 2019 (Poland): winning team CHOOSES           │
│  - Before 2019 (Poland): winning team must PLAY             │
│  - USA (current, Steve Harvey): winning team CHOOSES         │
│  - USA (1988-1995, Ray Combs): winning team auto-plays      │
└───────┬─────────────────────────────────────────────────────┘
        │
        ├──── PLAY ────────┐
        │                  ▼
        │  ┌──────────────────────────────────────────────┐
        │  │  PHASE 2: MAIN PLAY (Gra)                    │
        │  │  - Team members answer in sequence (no hints) │
        │  │  - CORRECT → answer revealed, points to bank │
        │  │  - WRONG → STRIKE (X / iks)                  │
        │  │  • 1st strike: just an X                     │
        │  │  • 2nd strike: opponents can CONFER (narada) │
        │  │  • 3rd strike → STRIKEOUT → PHASE 3          │
        │  │  - ALL ANSWERS REVEALED → round ends, team   │
        │  │    gets all bank points                       │
        │  └──────────────────────────────────────────────┘
        │
        └──── PASS ────────┐
                           ▼
           ┌──────────────────────────────────────────────┐
           │  OPPONENT PLAYS (same as above)              │
           │  - Original pass-er waits, can confer         │
           └──────────────────────────────────────────────┘
                                         │
                    3 STRIKES (either team) │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: STEAL (Przejęcie)                                 │
│  - Opponents confer, captain gives ONE answer               │
│  - CORRECT → opponents win round, steal ALL bank points     │
│  - WRONG → original team keeps bank points they earned      │
│  - Unrevealed answers are then shown on board               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ROUND END (Koniec rundy)                                   │
│  - Points assigned to winning team                          │
│  - Team with ≥300 points → advances to Finał                │
│  - Otherwise → next round (sometimes with ×2/×3 multiplier) │
└───────┬─────────────────────────────────────────────────────┘
        │
        ▼ (≥300 pts)
┌─────────────────────────────────────────────────────────────┐
│  FINAŁ: FAST MONEY                                          │
│  - 2 players from winning team                              │
│  - Player 1: 5 questions, 15-20 seconds                     │
│  - Player 2: same 5 questions, 20-25 seconds (no duplicates)│
│  - Combined score ≥200 → wins grand prize                   │
│  - Otherwise: $5 per point                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Polish vs American Differences

| Aspect | Polish Familiada | American Family Feud |
|--------|-----------------|---------------------|
| **Host** | Karol Strasburger (since 1994) | Steve Harvey (since 2010) |
| **Team size** | 4 (since March 2025), was 5 | 5 (was 4 in 1994-95 only) |
| **Face-off play/pass choice** | Since Sept 2019: winner chooses | Current: winner chooses (except 1988-95 era) |
| **2nd strike behavior** | Opponents get "narada" (confer) | No special phase — just another X |
| **3rd strike → steal** | **One answer** from captain | **One answer** from captain |
| **Steal: correct** | Stealing team gets ALL round points | Stealing team gets ALL round points |
| **Steal: wrong** | Original team keeps their bank | Original team keeps their bank |
| **If all answers revealed** | Playing team wins round + all points | Playing team wins round + all points |
| **Point values** | 1 point per survey respondent (~100 per question) | 1 point per survey respondent (min 2) | 
| **Multipliers** | Later rounds ×2, ×3 | Later rounds ×2, ×3 |
| **Win condition** | First to ≥300 points | First to ≥300 points (was 200, then 400) |
| **Rounds structure** | Play until 300 reached (typically 4-6) | 4 rounds + sudden death if needed |
| **Champion rule** | Winner stays, max 3 episodes | Winner stays, max 5 days (current) |
| **Fast Money prize** | Cash prize (PLN) | $20,000 (USD) + car for 5-time champs |
| **Special rounds** | None | Bullseye/Bankroll (intermittent) |
| **Question length** | 3-6 answers | 4-8 answers (varies by round) |
| **Answer count** | Was 7-8, reduced to 3-6 over years | Reduces in later rounds |

### Unique Polish Details:
- The host tells a "krótka anegdotka" (short joke/story) at the start
- The podium is called "beczka" (barrel)
- Teams can be families OR friend groups (since 2007)
- Player answers individually with NO hints/conferring (unlike US where conferring is allowed in certain eras)
- Red team = returning champions, Blue team = newcomers

### Unique American Details:
- Returning champions can play up to 5 days
- 5-time winners get a new car (or $30k since May 2024, or vacation+$10k since Sept 2024)
- "Sudden death" question if no team reaches 300 after 4 rounds
- Bullseye round exists in some seasons (determines Fast Money stake)

---

## 3. Sound Design

Based on the existing sound library at `~/projekty/familiada-sounds/final/`:

### Polish Familiada Sounds:
| Sound | File | Duration | Trigger |
|-------|------|----------|---------|
| Correct answer | `pl_correct_answer.mp3` | 0.6s | Answer revealed on board |
| Wrong answer / X | `pl_wrong_answer.mp3` | 1.1s | Strike added |
| Intro music | `pl_intro.mp3` | 4.9s | Game start |
| Full theme | `pl_full_theme.mp3` | 2:36 | Opening credits |

### American Family Feud Sounds:
| Sound | File | Duration | Trigger |
|-------|------|----------|---------|
| Correct answer | `us_correct_answer.mp3` | 3.3s | Answer revealed |
| Single strike | `us_strike.mp3` | 2.3s | X added |
| Buzzer | `us_buzzer.mp3` | 2.4s | Face-off buzz |
| Intro | `us_intro.mp3` | 17.7s | Game intro |
| Three strikes | `us_three_strikes.mp3` | 4.1s | All 3 X's filled |

### Recommended Sound Mapping:
```
buzz     → us_buzzer.mp3       (face-off buzz-in)
correct  → pl_correct_answer.mp3 (answer revealed)  ⭐ authentic Polish
wrong/X  → pl_wrong_answer.mp3  (strike added)      ⭐ authentic Polish
3strikes → us_three_strikes.mp3 (all X's filled, przejęcie starts)
intro    → pl_intro.mp3         (game start)
```

**Sound Timing:** Sounds should play IMMEDIATELY on action, no pre-fetch delay. Preload all sounds at game start.

---

## 4. Scoring System

### Standard Round Scoring:
- Each answer worth: `number of survey respondents who gave that answer` (out of 100)
- Example: if 35 people said "pizza" → that answer is worth 35 points
- Minimum 2 respondents required for an answer to appear
- Bank = sum of all revealed answer points × round multiplier

### Multiplier Schedule (typical):
| Round | Multiplier | Notes |
|-------|-----------|-------|
| 1 | ×1 | Standard |
| 2 | ×1 | Standard |
| 3 | ×2 | First doubled round |
| 4 | ×3 | Tripled |
| 5+ | ×3 | All remaining |

### Round End — Point Distribution:
1. **All answers revealed by playing team** → Playing team gets entire bank
2. **3 strikes → steal correct** → Stealing team gets entire bank (all points from revealed + unrevealed)
3. **3 strikes → steal wrong** → Original playing team keeps their accumulated bank

### Game End:
- First team to reach ≥300 points wins the main game
- If 4 rounds played and no team has 300 (US only): sudden death face-off with top answer only

---

## 5. Key Findings from Code Implementations

### Existing GitHub projects analyzed:

1. **Family-Feud-Game (by AtHeartEngineer)** — Web app with host control panel + display board
   - Uses Node.js + Socket.io for real-time sync
   - Host instance controls the game board instance
   - State machine similar to ours (IDLE → FACE_OFF → PLAYING → STEAL → ROUND_END)

2. **Family Feud (by DeanHempshall)** — Pure HTML5+JS 
   - DIY template approach
   - Single-page app with embedded game logic
   - No buzzer hardware support

3. **family-feud (by zachary-kaelan)** — Modern Family Feud implementation
   - Client-side focused
   - Score tracking + team management

4. **100-argentinos-dicen** — Spanish-language variant
   - Includes custom answer animation
   - State-based answer reveal system
   - Scoreboard with strike tracking

### Common patterns across implementations:
- **State machines**: All use explicit game states (FACE_OFF, PLAYING, STEAL, ROUND_END)
- **Real-time sync**: Socket.io or BroadcastChannel for multi-screen setups
- **Answer reveal animation**: Flip/slide animations for board reveals
- **Strike tracking**: Visual X markers, typically 3 per round
- **Bank system**: Running total of revealed points per round
- **Multiplier by round**: Hardcoded [×1, ×1, ×2, ×3, ×3] pattern

### What our implementation does well:
- ✅ Clean state machine with reducer pattern
- ✅ BroadcastChannel for cross-window sync (no server needed)
- ✅ Hardware buzzer support via WebSerial
- ✅ Question management with batch loading
- ✅ Undo/redo history stack
- ✅ Configuration profiles
- ✅ Color-coded team UI

### Areas to improve (found from research):
- 🔧 Fast Money (finał) round not yet implemented
- 🔧 Sudden death round not implemented  
- 🔧 After steal: unrevealed answers should be shown on board
- 🔧 2nd strike "narada" (confer) phase not implemented (US doesn't have this, but Poland does)
- 🔧 Champion carry-over between games not implemented
- 🔧 Answer count per round (decreasing in later rounds) not implemented

---

## 6. Recommendations for Our Implementation

### Immediate Fixes:
1. **Fix double X rendering** — The BroadcastChannel + localStorage dual sync causes `renderuj()` to fire twice for the same state. Fix by updating `_ostatniHash` in the BroadcastChannel handler.

2. **Fix audio preload** — `preload()` creates Audio objects but doesn't actually load them. `graj()` does a HEAD fetch before playing on first call, causing delay. Fix by: proper preload with canplaythrough, skip HEAD check in graj().

3. **X's stay permanently** — The code already handles this correctly (only rebuilds on count decrease, only animates on new X). The dual sync bug masked this.

### Future Improvements:
4. **Implement Fast Money (finał)** — 2-player bonus round with 5 questions, 200-point target
5. **Add "narada" phase** — After 2nd X in Polish mode, show "narada" (opponents confer) indicator
6. **Reveal unrevealed answers at round end** — Currently only happens on steal, should always happen
7. **Champion tracking** — Track which team won, carry them to next game
8. **Round-based answer count** — Reduce number of answers in later rounds (8→6→5→4)

### State Machine Reference (Current Implementation):
```
IDLE → POJEDYNEK → GRA → PRZEJECIE → KONIEC_RUNDY → KONIEC_GRY
                       ↑             ↓
                       └──── 3 iksy ─┘
```

### Correct Game Flow Verification:
✅ Face-off: Host arms buzzer → player buzzes → answer revealed → higher score wins
✅ Play/pass: Winning team chooses (or auto-plays in some configs)  
✅ Main play: Sequential answering, each wrong = X
✅ 3 strikes → przejęcie: Opponent team ONE guess
✅ Steal correct → opponents win round + all points
✅ Steal wrong → original team keeps bank
✅ All revealed → playing team wins + all points
✅ Round end → bank to winning team → check ≥300 → next round or finał

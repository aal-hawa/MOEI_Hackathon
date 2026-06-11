# Mobile Phone Call App UI Design Specifications

> Research-based UI specs for implementing a phone calling interface in React/Tailwind CSS.
> Sources: iOS 17 Phone App, Google Phone (Material 3 Expressive), Samsung One UI 8

---

## 1. DIALER SCREEN (Keypad/Number Pad)

### 1.1 Layout Structure
```
┌─────────────────────────┐
│     [Number Display]     │  ← Top 25% of screen
│    (123) 456-7890       │
│        [⌫ Backspace]    │
├─────────────────────────┤
│   1       2       3     │  ← Keypad grid
│         ABC   DEF       │
│                         │
│   4       5       6     │
│  GHI    JKL    MNO      │
│                         │
│   7       8       9     │
│  PQRS   TUV   WXYZ     │
│                         │
│   *       0       #     │
│         +               │
├─────────────────────────┤
│      [🟢 Call]          │  ← Green call button
└─────────────────────────┘
```

### 1.2 iOS 17 Phone App - Dialer

| Element | Specification |
|---------|--------------|
| **Grid** | 3×4 grid of circular buttons |
| **Button size** | ~76px diameter (on 375pt width) |
| **Button spacing** | ~20px horizontal, ~16px vertical |
| **Number font** | SF Pro, ~28px, weight: thin/light |
| **Letter font** | SF Pro, ~10px, weight: regular, uppercase, tracking: 0.1em |
| **Number color** | `#FFFFFF` (white on dark bg) |
| **Letter color** | `rgba(255,255,255,0.5)` (semi-transparent white) |
| **Button background** | `rgba(255,255,255,0.08)` → `rgba(255,255,255,0.15)` on press |
| **Number display** | Top area, SF Pro ~32px, weight: light, `#FFFFFF`, formatted as (XXX) XXX-XXXX |
| **Backspace button** | Right side of number display, `⌫` icon, `rgba(255,255,255,0.4)`, fades in when digits present |
| **Call button** | Bottom center, circular ~76px, `#34C759` (iOS system green) |
| **Call icon** | White phone icon, filled, centered in green circle |
| **Background** | Pure black `#000000` (iOS) or dark gradient |
| **Contact match** | Below number display, shows matching contact name + avatar in smaller text |

### 1.3 Google Phone App - Dialer (M3 Expressive)

| Element | Specification |
|---------|--------------|
| **Grid** | 3×4 grid of circular buttons |
| **Button size** | ~72px diameter |
| **Number font** | Roboto/Google Sans, ~26px, weight: regular |
| **Letter font** | ~9px, weight: medium, includes T9 search letters |
| **Number color** | `#E8EAED` (light gray on dark) or `#1F1F1F` (on light) |
| **Button background** | `rgba(255,255,255,0.08)` (dark mode) or `rgba(0,0,0,0.06)` (light) |
| **Number display** | Top area, Google Sans, ~28px, `#E8EAED` |
| **Backspace button** | Right of number display, material delete icon |
| **Call button** | Bottom center, circular ~64px, Google Green `#0B8043` / M3 primary green `#4CAF50` |
| **Contact search** | Real-time T9 search as you dial, shows matching contacts below number display |
| **Search bar** | Top of screen with hamburger menu for contacts drawer |
| **Background** | `#1C1B1F` (M3 dark surface) |

### 1.4 Tailwind CSS Implementation (Dialer)

```tsx
// Dialer keypad button
<button className="
  w-[76px] h-[76px]           /* Circular button */
  rounded-full                /* Perfect circle */
  bg-white/[0.08]             /* Subtle background */
  active:bg-white/[0.15]      /* Press state */
  flex flex-col               /* Stack number + letters */
  items-center justify-center
  transition-colors duration-100
  select-none                 /* Prevent text selection */
">
  <span className="text-[28px] font-light text-white">5</span>
  <span className="text-[10px] font-normal text-white/50 tracking-widest">JKL</span>
</button>

// Green call button
<button className="
  w-[76px] h-[76px]
  rounded-full
  bg-[#34C759]                /* iOS system green */
  active:bg-[#2DB84D]         /* Slightly darker on press */
  flex items-center justify-center
  transition-colors duration-100
  shadow-lg shadow-green-500/30
">
  <PhoneIcon className="w-8 h-8 text-white fill-white" />
</button>

// Number display
<div className="text-[32px] font-light text-white tracking-wide text-center">
  (123) 456-7890
</div>

// Backspace button
<button className="text-white/40 hover:text-white/60 transition-colors">
  <BackspaceIcon className="w-7 h-7" />
</button>
```

---

## 2. CALLING / CONNECTING SCREEN (Ringing / Outgoing)

### 2.1 Layout Structure
```
┌─────────────────────────┐
│                         │
│    [Contact Avatar]      │  ← Large circular avatar
│    ⏳ Pulsing ring       │  ← Pulsing animation ring
│                         │
│    Contact Name          │  ← Name, large text
│    Mobile • Calling...   │  ← Label + status
│                         │
│    🎵 Ringtone visual    │  ← Optional waveform
│                         │
├─────────────────────────┤
│                         │
│  [🔇] [⌨️] [🔊] [➕]   │  ← Action buttons row
│  Mute Key Speaker Add   │
│                         │
│      [🔴 Cancel]        │  ← Red end/cancel button
└─────────────────────────┘
```

### 2.2 iOS 17 - Connecting/Outgoing Call Screen

| Element | Specification |
|---------|--------------|
| **Background** | Blurred/light gray `#F2F2F7` (light mode) or `#1C1C1E` (dark mode) - changed from black in iOS 17 |
| **Contact Poster** | Full-width Contact Poster (new in iOS 17) - large photo/memoji with name overlay, takes top ~60% of screen |
| **Avatar** | If no Contact Poster: circular, ~100px, centered, with 3-ring pulse animation |
| **Contact name** | SF Pro, ~22px, weight: semibold, white on dark / black on light |
| **Status label** | "Calling..." or "Mobile", SF Pro ~15px, weight: regular, secondary color |
| **Caller ID type** | Small icon + label (Mobile, Home, Work), `#8E8E93` |
| **Action buttons** | 2×3 grid of circular ~60px buttons, same as active call |
| **Cancel/End button** | Bottom center, red `#FF3B30`, circular ~64px, white phone-down icon |
| **Pulse animation** | Concentric rings expanding from avatar, 2s cycle, ease-out, opacity 0.4→0 |

### 2.3 Google Phone - Connecting Screen (M3 Expressive)

| Element | Specification |
|---------|--------------|
| **Background** | Dark gradient or M3 surface color `#1C1B1F` |
| **Avatar** | Large circular ~88px, centered in upper half |
| **Pulse animation** | Ripple rings from avatar, M3-style, 3 concentric circles, 1.5s stagger |
| **Contact name** | Google Sans, ~24px, weight: medium, `#E8EAED` |
| **Status label** | "Calling..." with animated 3-dot indicator, ~14px, `#9AA0A6` |
| **Calling dots** | Three dots animating in sequence: `• • •` opacity cycling |
| **Action buttons** | Pill-shaped buttons in a row, M3 Expressive style |
| **Cancel button** | Bottom, large pill/capsule shape, red `#B3261E` (M3 error), white text "Cancel" |
| **Card layout** | M3 Expressive: contact info in a card-style container with rounded corners (28px radius) |

### 2.4 Tailwind CSS Implementation (Connecting)

```tsx
// Pulsing avatar ring animation
<div className="relative flex items-center justify-center">
  {/* Pulse ring 1 */}
  <div className="absolute w-[140px] h-[140px] rounded-full bg-white/10 animate-ping [animation-duration:2s]" />
  {/* Pulse ring 2 */}
  <div className="absolute w-[120px] h-[120px] rounded-full bg-white/5 animate-ping [animation-duration:2s] [animation-delay:0.5s]" />
  {/* Avatar */}
  <Avatar className="w-[100px] h-[100px] border-4 border-white/20">
    <AvatarImage src="/contact.jpg" />
    <AvatarFallback className="bg-[#5E5CE6] text-white text-3xl">JD</AvatarFallback>
  </Avatar>
</div>

// Calling status with animated dots
<div className="flex items-center gap-1 text-[#9AA0A6] text-sm">
  <span>Calling</span>
  <span className="animate-[dotPulse_1.5s_infinite_0s]">.</span>
  <span className="animate-[dotPulse_1.5s_infinite_0.3s]">.</span>
  <span className="animate-[dotPulse_1.5s_infinite_0.6s]">.</span>
</div>

// Cancel button (iOS style)
<button className="
  w-[64px] h-[64px]
  rounded-full
  bg-[#FF3B30]              /* iOS system red */
  active:bg-[#D63029]
  flex items-center justify-center
  transition-colors duration-100
  shadow-lg shadow-red-500/30
">
  <PhoneDownIcon className="w-8 h-8 text-white fill-white rotate-[135deg]" />
</button>

// Cancel button (Google M3 style - pill shape)
<button className="
  px-12 py-4
  rounded-full
  bg-[#B3261E]              /* M3 error color */
  text-white text-base font-medium
  active:bg-[#8C1D18]
  transition-colors duration-100
">
  Cancel
</button>
```

---

## 3. ACTIVE CALL SCREEN

### 3.1 iOS 17 - Active Call Layout

**Major change in iOS 17**: All buttons moved to bottom third of screen to make room for Contact Poster at top.

```
┌─────────────────────────┐
│                         │
│   [Contact Poster]      │  ← NEW: Large photo/Memoji poster
│   Full-bleed image      │     Takes up ~55-60% of screen
│   with name overlay     │
│                         │
├─────────────────────────┤
│   4:32                  │  ← Call duration, centered
│                         │
│  [🔇]  [⌨️]  [🔊]     │  ← Row 1: Mute, Keypad, Speaker
│  Mute  Key   Speaker    │
│                         │
│  [➕]  [📹]  [👥]      │  ← Row 2: Add Call, FaceTime, Contacts
│  Add   Video  Contacts  │     (Keypad/FaceTime swapped in iOS 17!)
│                         │
│       [🔴 End]          │  ← Red end call button (CENTERED, not bottom!)
│                         │  ← In iOS 16 it was separated at bottom;
│                         │     In iOS 17 it's in the 2×3 grid area
└─────────────────────────┘
```

### 3.2 iOS 17 Active Call - Detailed Specs

| Element | Specification |
|---------|--------------|
| **Background** | Light gray `#F2F2F7` (changed from black in iOS 17) or contact poster bg |
| **Contact Poster** | Full-width, top of screen, ~55% height, personalized photo/memoji |
| **Call duration** | SF Pro Mono, ~17px, weight: regular, `#3C3C43` (60% opacity), centered below poster |
| **Button grid** | 2 rows × 3 columns, evenly spaced across screen width |
| **Button size** | Circular, ~60px diameter |
| **Button bg** | `rgba(255,255,255,0.12)` (dark) or `rgba(0,0,0,0.06)` (light), with blur |
| **Button active bg** | `#FFFFFF` bg with `#007AFF` (iOS blue) icon when toggled ON |
| **Button icon size** | ~24px, SF Symbols |
| **Button label** | ~10px, below button, `#3C3C43` at 60% opacity |
| **Mute button** | Row 1, Col 1: `mic.slash` SF Symbol |
| **Keypad button** | Row 1, Col 2: `grid` SF Symbol (SWAPPED with FaceTime in iOS 17) |
| **Speaker button** | Row 1, Col 3: `speaker.wave.3` SF Symbol (SWAPPED with mute position in iOS 17) |
| **Add Call** | Row 2, Col 1: `phone.badge.plus` SF Symbol |
| **FaceTime** | Row 2, Col 2: `video` SF Symbol (SWAPPED with Keypad in iOS 17) |
| **Contacts** | Row 2, Col 3: `person.crop.circle` SF Symbol |
| **End Call button** | Below the 2×3 grid, centered, circular ~64px, `#FF3B30` red, white phone-down icon |
| **Button spacing** | ~40px between columns, ~20px between rows |
| **Bottom safe area** | ~34px padding above home indicator |

**iOS 17 vs iOS 16 Key Changes**:
- End call button moved from isolated bottom position to center of button group
- Mute ↔ Speaker positions swapped
- Keypad ↔ FaceTime positions swapped
- All buttons now in lower third of screen (was spread across screen)
- Contact Poster takes top half

### 3.3 Google Phone - Active Call (M3 Expressive)

```
┌─────────────────────────┐
│                         │
│     [Contact Avatar]    │  ← Smaller avatar, card-style
│     Contact Name        │
│     4:32 • Mobile       │
│                         │
├─────────────────────────┤
│  ┌──────────────────┐   │
│  │ [🔇]  [⌨️]  [🔊] │   │  ← Pill-shaped buttons
│  │ Mute  Key  Speaker│   │     in a card container
│  │                  │   │
│  │ [➕]  [⏸️]  [📹] │   │  ← Second row
│  │ Add   Hold  Video │   │
│  └──────────────────┘   │
│                         │
│     [🔴 End Call]       │  ← Large pill/capsule end button
│                         │
└─────────────────────────┘
```

### 3.4 Google Phone Active Call - Detailed Specs

| Element | Specification |
|---------|--------------|
| **Background** | M3 surface dark `#1C1B1F` or dynamic color surface |
| **Avatar** | ~80px, in a card-style container with rounded corners |
| **Contact name** | Google Sans, ~22px, weight: medium, `#E8EAED` |
| **Call duration** | `4:32 • Mobile` format, ~14px, `#9AA0A6` |
| **Card container** | Rounded rectangle, ~28px corner radius, surface-variant bg `#2B2930` |
| **Button style** | **Pill-shaped** (new M3 Expressive!), morph to rounded rectangles when active |
| **Button inactive** | Pill shape, `rgba(255,255,255,0.08)` bg, white icon |
| **Button active** | Rounded rectangle, `#D0BCFF` (M3 primary container) bg, `#381E72` (M3 on-primary-container) icon |
| **End call button** | Large pill/capsule, `#B3261E` (M3 error), white text "End call", wider than other buttons |
| **Button layout** | 2×3 grid inside card container |
| **Button labels** | Below each button, ~11px, `#9AA0A6` |
| **Hold button** | Included (vs iOS which has FaceTime), with pause icon |

### 3.5 Tailwind CSS Implementation (Active Call)

```tsx
// iOS-style call action button (inactive)
<button className="
  w-[60px] h-[60px]
  rounded-full
  bg-white/[0.12]
  backdrop-blur-xl
  flex flex-col items-center justify-center
  active:bg-white/[0.2]
  transition-all duration-150
">
  <MicIcon className="w-6 h-6 text-white" />
  <span className="text-[10px] text-white/60 mt-0.5">Mute</span>
</button>

// iOS-style call action button (active/toggled ON)
<button className="
  w-[60px] h-[60px]
  rounded-full
  bg-white
  flex flex-col items-center justify-center
  transition-all duration-150
">
  <MicOffIcon className="w-6 h-6 text-[#007AFF]" />
  <span className="text-[10px] text-[#007AFF] mt-0.5">Mute</span>
</button>

// iOS End Call button
<button className="
  w-[64px] h-[64px]
  rounded-full
  bg-[#FF3B30]
  active:bg-[#D63029]
  flex items-center justify-center
  transition-colors duration-100
">
  <PhoneDownIcon className="w-7 h-7 text-white fill-white" />
</button>

// Google M3 Expressive pill button (inactive)
<button className="
  px-6 py-3
  rounded-full
  bg-white/[0.08]
  flex flex-col items-center gap-1
  active:bg-white/[0.15]
  transition-all duration-150
">
  <MicIcon className="w-5 h-5 text-[#E8EAED]" />
  <span className="text-[11px] text-[#9AA0A6]">Mute</span>
</button>

// Google M3 Expressive pill button (active/toggled)
<button className="
  px-6 py-3
  rounded-2xl                    /* Morphs from pill to rounded rect */
  bg-[#D0BCFF]                   /* M3 primary container */
  flex flex-col items-center gap-1
  transition-all duration-200
">
  <MicOffIcon className="w-5 h-5 text-[#381E72]" />
  <span className="text-[11px] text-[#381E72]">Mute</span>
</button>

// Google M3 End Call button (large pill)
<button className="
  w-full max-w-[280px]
  py-4
  rounded-full
  bg-[#B3261E]
  active:bg-[#8C1D18]
  text-white text-base font-medium
  transition-colors duration-100
">
  End call
</button>
```

---

## 4. COLOR SCHEMES

### 4.1 iOS System Colors (Phone App)

| Role | Color Name | Hex | Tailwind | Usage |
|------|-----------|-----|----------|-------|
| **Call / Answer** | systemGreen | `#34C759` | `bg-[#34C759]` | Call button, answer button |
| **End Call** | systemRed | `#FF3B30` | `bg-[#FF3B30]` | End call, cancel, decline |
| **Active Toggle** | systemBlue | `#007AFF` | `bg-[#007AFF]` | Mute/Speaker active state |
| **Background (Dark)** | systemBlack | `#000000` | `bg-black` | Keypad screen background |
| **Background (Light)** | systemGroupedBackground | `#F2F2F7` | `bg-[#F2F2F7]` | Active call background (iOS 17) |
| **Secondary Label** | secondaryLabel | `#3C3C43` 60% | `text-black/60` | Button labels, duration |
| **Tertiary Label** | tertiaryLabel | `#3C3C43` 40% | `text-black/40` | Subtle labels |
| **Separator** | separator | `#3C3C43` 29% | `border-black/29` | Dividers |
| **Keypad button** | — | `rgba(255,255,255,0.08)` | `bg-white/[0.08]` | Dialer button bg (dark) |
| **Keypad press** | — | `rgba(255,255,255,0.15)` | `bg-white/[0.15]` | Dialer button pressed |

### 4.2 Material Design 3 Colors (Google Phone)

| Role | Color Name | Hex | Tailwind | Usage |
|------|-----------|-----|----------|-------|
| **Call / Answer** | M3 Green | `#0B8043` | `bg-[#0B8043]` | Google Phone green |
| **End Call** | M3 Error | `#B3261E` | `bg-[#B3261E]` | End call, decline |
| **Primary** | M3 Primary | `#D0BCFF` | `bg-[#D0BCFF]` | Active button bg (dark theme) |
| **On-Primary** | M3 OnPrimaryContainer | `#381E72` | `text-[#381E72]` | Active button text/icon |
| **Surface** | M3 Surface | `#1C1B1F` | `bg-[#1C1B1F]` | Main background |
| **Surface Variant** | M3 SurfaceVariant | `#2B2930` | `bg-[#2B2930]` | Card backgrounds |
| **On Surface** | M3 OnSurface | `#E8EAED` | `text-[#E8EAED]` | Primary text |
| **On Surface Variant** | M3 OnSurfaceVariant | `#9AA0A6` | `text-[#9AA0A6]` | Secondary text, labels |
| **Outline** | M3 Outline | `#49454F` | `border-[#49454F]` | Borders, dividers |
| **Keypad button** | — | `rgba(255,255,255,0.08)` | `bg-white/[0.08]` | Dialer button bg |

### 4.3 Samsung One UI Colors

| Role | Hex | Usage |
|------|-----|-------|
| **Call / Answer** | `#0B8043` or dynamic | Green call button |
| **End Call** | `#C62828` | Red end call |
| **Background** | `#1B1B1F` | Dark mode surface |
| **Surface** | `#2B2B30` | Cards, containers |
| **Primary** | `#AACBFF` | Active elements (blue-ish) |
| **Text Primary** | `#E4E4E9` | Main text |
| **Text Secondary** | `#8E8E93` | Labels, descriptions |

---

## 5. ANIMATIONS

### 5.1 Pulsing Avatar Ring (iOS/Universal)

Used when call is connecting/ringing. Concentric rings expand outward from the avatar.

```css
/* Keyframe animation */
@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 0.4;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}
```

```tsx
// React component with Tailwind
const PulseAvatar = ({ src, name }: { src: string; name: string }) => (
  <div className="relative flex items-center justify-center">
    {/* Ring 1 - slow pulse */}
    <div
      className="absolute w-28 h-28 rounded-full border-2 border-white/20"
      style={{ animation: 'pulse-ring 2s ease-out infinite' }}
    />
    {/* Ring 2 - delayed pulse */}
    <div
      className="absolute w-28 h-28 rounded-full border-2 border-white/10"
      style={{ animation: 'pulse-ring 2s ease-out infinite 0.6s' }}
    />
    {/* Ring 3 - further delayed */}
    <div
      className="absolute w-28 h-28 rounded-full border-2 border-white/5"
      style={{ animation: 'pulse-ring 2s ease-out infinite 1.2s' }}
    />
    {/* Avatar */}
    <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white/20 z-10">
      <img src={src} alt={name} className="w-full h-full object-cover" />
    </div>
  </div>
);
```

**Timing**: 2s cycle per ring, 3 rings staggered at 0s/0.6s/1.2s, ease-out, scale 1→1.8, opacity 0.4→0

### 5.2 Ripple Effect (Google/Android)

Material Design ripple on button press - radial expansion from touch point.

```css
@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 0.2;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}
```

```tsx
// M3-style ripple button
const RippleButton = ({ children, onClick }: any) => (
  <button
    onClick={onClick}
    className="relative overflow-hidden rounded-full bg-white/[0.08] active:bg-white/[0.15] transition-colors"
  >
    <span className="relative z-10">{children}</span>
    {/* Ripple is triggered on click via JS to start at touch point */}
  </button>
);
```

### 5.3 Connecting Dots Animation (Google Phone)

Three dots animating in sequence to indicate "Calling..." status.

```css
@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}
```

```tsx
const CallingDots = () => (
  <span className="inline-flex gap-0.5">
    <span className="w-1.5 h-1.5 rounded-full bg-white/60"
      style={{ animation: 'dot-pulse 1.4s ease-in-out infinite' }} />
    <span className="w-1.5 h-1.5 rounded-full bg-white/60"
      style={{ animation: 'dot-pulse 1.4s ease-in-out infinite 0.2s' }} />
    <span className="w-1.5 h-1.5 rounded-full bg-white/60"
      style={{ animation: 'dot-pulse 1.4s ease-in-out infinite 0.4s' }} />
  </span>
);
```

### 5.4 Call Duration Timer

Monospace font, ticking every second.

```tsx
const CallTimer = ({ startTime }: { startTime: Date }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <span className="font-mono text-[17px] text-[#3C3C43]/60">
      {formatTime(elapsed)}
    </span>
  );
};
```

### 5.5 Button Morph Animation (M3 Expressive)

Pill-shaped buttons morph to rounded rectangles when toggled active.

```css
@keyframes morph-pill-to-rect {
  0% { border-radius: 9999px; }
  100% { border-radius: 16px; }
}
```

```tsx
// M3 Expressive button morph
<button className={`
  px-6 py-3
  transition-all duration-200 ease-in-out
  ${isActive
    ? 'rounded-2xl bg-[#D0BCFF] text-[#381E72]'
    : 'rounded-full bg-white/[0.08] text-[#E8EAED]'
  }
`}>
  {label}
</button>
```

### 5.6 Waveform / Audio Visualization (Active Call)

Optional: shows audio level during active call.

```css
@keyframes audio-bar {
  0%, 100% { height: 4px; }
  50% { height: 20px; }
}
```

```tsx
const AudioWaveform = () => (
  <div className="flex items-center gap-[2px] h-6">
    {[0, 0.1, 0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0].map((delay, i) => (
      <div
        key={i}
        className="w-[3px] rounded-full bg-white/40"
        style={{
          animation: `audio-bar 0.8s ease-in-out infinite ${delay}s`,
          height: '4px',
        }}
      />
    ))}
  </div>
);
```

---

## 6. LAYOUT & ONE-HANDED USE PRINCIPLES

### 6.1 General Layout Rules

| Principle | Implementation |
|-----------|---------------|
| **Thumb zone** | All interactive elements in bottom 60% of screen |
| **Call/End buttons** | Always at bottom, reachable with thumb |
| **Action buttons** | Bottom 40% of screen |
| **Info display** | Top 40-60% of screen (name, avatar, status) |
| **Safe areas** | 34px bottom padding (iPhone home indicator), 44px top (status bar) |
| **Min touch target** | 44×44px (iOS) / 48×48dp (Android) |
| **Button spacing** | Minimum 8px between touch targets |
| **Screen width** | Design for 375px (iPhone), 360dp (Android) base |

### 6.2 Screen Breakdown (Portrait, ~844px tall iPhone 14)

```
iOS 17 Active Call Screen:
├── Status bar:          54px  (time, signal, battery)
├── Contact Poster:     ~480px  (55-60% of remaining space)
├── Call duration:       ~30px  (centered, below poster)
├── Button row 1:        ~70px  (Mute, Keypad, Speaker)
├── Button row 2:        ~70px  (Add, FaceTime, Contacts)
├── End call button:     ~64px  (centered)
├── Bottom spacer:       ~34px  (home indicator safe area)
└── Total:              ~844px
```

```
Dialer Screen:
├── Status bar:          54px
├── Number display:     ~100px  (number + backspace)
├── Keypad grid:       ~360px  (4 rows × ~90px)
├── Call button:        ~76px
├── Bottom spacer:      ~34px
└── Total:             ~844px
```

### 6.3 Responsive Grid for Keypad

```tsx
// 3×4 keypad grid - responsive
<div className="grid grid-cols-3 gap-y-4 gap-x-6 px-12 max-w-[320px] mx-auto">
  {['1','2','3','4','5','6','7','8','9','*','0','#'].map(key => (
    <KeypadButton key={key} digit={key} />
  ))}
</div>
```

---

## 7. COMPLETE TAILWIND THEME EXTENSION

```js
// tailwind.config.ts - Phone app color theme
module.exports = {
  theme: {
    extend: {
      colors: {
        // iOS Phone App Colors
        'ios-green': '#34C759',
        'ios-green-dark': '#2DB84D',
        'ios-red': '#FF3B30',
        'ios-red-dark': '#D63029',
        'ios-blue': '#007AFF',
        'ios-bg-dark': '#000000',
        'ios-bg-light': '#F2F2F7',
        'ios-surface': '#1C1C1E',
        'ios-separator': 'rgba(60,60,67,0.29)',

        // M3 Expressive Colors (Google Phone)
        'm3-green': '#0B8043',
        'm3-error': '#B3261E',
        'm3-error-dark': '#8C1D18',
        'm3-primary': '#D0BCFF',
        'm3-on-primary': '#381E72',
        'm3-surface': '#1C1B1F',
        'm3-surface-variant': '#2B2930',
        'm3-on-surface': '#E8EAED',
        'm3-on-surface-variant': '#9AA0A6',
        'm3-outline': '#49454F',

        // Samsung One UI Colors
        'sam-green': '#0B8043',
        'sam-red': '#C62828',
        'sam-surface': '#1B1B1F',
        'sam-surface-alt': '#2B2B30',
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        'dot-pulse': 'dot-pulse 1.4s ease-in-out infinite',
        'audio-bar': 'audio-bar 0.8s ease-in-out infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.4' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        'dot-pulse': {
          '0%, 80%, 100%': { opacity: '0.2' },
          '40%': { opacity: '1' },
        },
        'audio-bar': {
          '0%, 100%': { height: '4px' },
          '50%': { height: '20px' },
        },
      },
    },
  },
};
```

---

## 8. KEY DESIGN DIFFERENCES SUMMARY

| Feature | iOS 17 Phone | Google Phone (M3 Expressive) | Samsung One UI |
|---------|-------------|------------------------------|----------------|
| **Dialer button shape** | Circle | Circle | Circle |
| **Call button shape** | Circle | Circle | Circle (larger) |
| **Call button color** | `#34C759` | `#0B8043` | `#0B8043` |
| **End call shape** | Circle | Pill/capsule | Pill/capsule |
| **End call color** | `#FF3B30` | `#B3261E` | `#C62828` |
| **In-call button shape** | Circle | Pill → rounded rect (morph) | Pill/circle |
| **Active state** | White bg + blue icon | M3 primary container | Blue highlight |
| **Background** | Black (dialer) / Gray (call) | Dark surface | Dark surface |
| **Contact poster** | Full-bleed poster | Avatar + card | Avatar + card |
| **T9 search** | No (as-you-type matches) | Yes, on keypad | Yes, on keypad |
| **Pulse animation** | Concentric rings | M3 ripple rings | Subtle glow |
| **Tab navigation** | Bottom: Favorites/Recents/Contacts/Keypad/Voicemail | Bottom: Home/Keypad/Voicemail | Bottom: Keypad/Recents/Contacts |
| **End call position** | Center of button grid (iOS 17 change!) | Bottom, separate pill | Bottom, separate |

---

## 9. ACCESSIBILITY NOTES

- **Contrast ratios**: Green `#34C759` on black = 6.8:1 ✓ | Red `#FF3B30` on black = 4.6:1 ✓
- **Haptic feedback**: Keypad presses should trigger light haptic (10ms impact)
- **VoiceOver/TalkBack**: All buttons need accessibility labels
- **Large text**: Dynamic Type support; keypad buttons should scale
- **Reduce motion**: Pulse animations should respect `prefers-reduced-motion`
- **Color blind**: Never rely solely on color; use icons + labels alongside green/red

```css
/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .pulse-ring,
  .dot-pulse,
  .audio-bar {
    animation: none !important;
  }
}
```

---

## Sources

- Sparklin: iOS 17 call screen redesign analysis
- 9to5Google: Google Phone Material 3 Expressive redesign (Aug 2025)
- PhoneArena: iOS 17 end call button changes
- Medium: Google's M3 Update for Contacts & Calling Screen (UI/UX perspective)
- Apple HIG: Color, Layout guidelines
- Material Design 3: Color system, Expressive design language
- Reddit/Apple Communities: User feedback on iOS 17 button placement changes
- Samsung One UI 8/8.5: Dialer app design patterns

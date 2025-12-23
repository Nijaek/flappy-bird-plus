# Auth Modal Frontend Design

## Overview

Implement a blocking sign-in modal that appears when unauthenticated users load the page. Users must choose to sign in, create an account, or play as guest before accessing game content.

## Modal States & Flow

The `AuthModal` component has 4 states:

```
SIGN_IN (default)
├─ Google button → Google OAuth
│   └─ New user (no displayName)? → CHOOSE_USERNAME
│   └─ Existing user? → SUCCESS → dismiss
├─ Email form (sign in mode)
│   └─ Success → SUCCESS → dismiss
└─ "Play as Guest" → dismiss (no auth)

CREATE_ACCOUNT (toggle from SIGN_IN)
├─ Shows: displayName + email + password + confirm
└─ Success → SUCCESS → dismiss

CHOOSE_USERNAME (after Google SSO for new users)
├─ Shows: username input with real-time availability check
└─ Submit → SUCCESS → dismiss

SUCCESS
├─ Shows: "Welcome, [username]!" for 1.5 seconds
└─ Auto-dismisses to home screen
```

The modal is **blocking** - renders over a dark overlay, no game content visible until dismissed.

## Visual Layout & Styling

### Modal Container
- Centered on screen with semi-transparent dark overlay (`rgba(0,0,0,0.7)`)
- Background: tan panel color `#DEB858`
- Border: 4px solid `#8B6914` with pixel-art shadow
- Padding: 24px, max-width ~320px
- Font: "Press Start 2P" throughout

### SIGN_IN State Layout
```
┌──────────────────────────────────┐
│         Flappy Bird+             │  ← Title with bird icon
│                                  │
│  ┌────────────────────────────┐  │
│  │   Continue with Google  G  │  │  ← Cream button, Google icon
│  └────────────────────────────┘  │
│                                  │
│          ─── or ───              │  ← Divider
│                                  │
│  Email                           │
│  ┌────────────────────────────┐  │
│  │                            │  │  ← Input field (cream bg)
│  └────────────────────────────┘  │
│  Password                        │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │        Sign In             │  │  ← Primary action button
│  └────────────────────────────┘  │
│                                  │
│  Don't have an account?          │
│  Create one                      │  ← Clickable link
│                                  │
│          ─── or ───              │
│                                  │
│  ┌────────────────────────────┐  │
│  │     Play as Guest          │  │  ← Secondary/outlined style
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

### CREATE_ACCOUNT State
Same layout but form shows:
- Display Name field
- Email field
- Password field
- Confirm Password field
- "Create Account" button
- "Already have an account? Sign in" link

### CHOOSE_USERNAME State
Simplified modal:
- Title: "Choose Your Username"
- Username input with real-time availability indicator
- Submit button
- Shows checkmark if available, X if taken

### SUCCESS State
- "Welcome, [username]!" message
- Auto-dismisses after 1.5 seconds

### Button Styles
- Primary: cream `#F8F0D8` background, `#8B6914` border, 2px press offset
- Guest: outlined/muted style to de-emphasize
- Inputs: cream `#F8F0D8` background, `#8B6914` border, dark text

## Form Validation

### Sign In
- Email: required, valid format
- Password: required
- Backend error: "Invalid email or password"

### Create Account
- Display name: 3-20 chars, alphanumeric + underscores/hyphens, unique
- Email: required, valid format, not already registered
- Password: 8+ chars, uppercase, lowercase, number required
- Confirm password: must match

### Choose Username (Google SSO)
- Same rules as display name
- Real-time availability check (debounced 500ms)
- Visual feedback: checkmark if available, X if taken

### Error Display
- Inline red text (`#E85858`) under problematic field
- Font: 8px "Press Start 2P"
- Fields with errors get red border

### Loading States
- Buttons show "..." while processing
- Inputs disabled during submission
- Username check shows loading indicator

## Technical Implementation

### New Files
```
src/components/AuthModal.tsx
src/components/AuthModal.css
src/app/api/auth/check-username/route.ts
src/app/api/users/me/route.ts (extend for PATCH)
```

### Component Interface
```tsx
type ModalState = 'SIGN_IN' | 'CREATE_ACCOUNT' | 'CHOOSE_USERNAME' | 'SUCCESS'

interface AuthModalProps {
  onComplete: () => void
}
```

### API Integration
- Google: `signIn('google')`
- Email sign-in: `signIn('credentials', { email, password, redirect: false })`
- Email signup: `POST /api/auth/signup`
- Username check: `GET /api/auth/check-username?name=xxx`
- Username save: `PATCH /api/users/me` with `{ displayName }`

### App Integration
- `page.tsx` checks session on load
- If unauthenticated, render `<AuthModal />` instead of game
- `onComplete` triggers game render

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Tab closed during Google OAuth | On return, check displayName → show CHOOSE_USERNAME if empty |
| Username taken while typing | Real-time error, submit blocked |
| Network error | Inline error: "Connection failed. Please try again." |
| Google auth cancelled | Return to SIGN_IN with error |
| Returning Google user | Sign in, skip username, show SUCCESS |
| Email already registered | Show: "Email already registered. Try signing in." |
| Guest selection | Modal dismisses, guest session starts |

### Browser Refresh
- Authenticated → no modal, straight to home
- Guest → modal appears again (not persisted)

### Accessibility
- Focus trapped in modal
- Escape does nothing (blocking)
- Proper tab order and label associations

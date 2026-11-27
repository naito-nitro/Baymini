# Baymini

![React](https://img.shields.io/badge/React-19-1B4332?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-2D6A4F?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-1B4332?style=flat-square&logo=tailwindcss&logoColor=white)
![Gemini API](https://img.shields.io/badge/Gemini_API-GenAI-2D6A4F?style=flat-square&logo=googlegemini&logoColor=white)
![Google Maps](https://img.shields.io/badge/Google_Maps-Places_%26_Geo-1B4332?style=flat-square&logo=googlemaps&logoColor=white)
![Google Calendar](https://img.shields.io/badge/Google_Calendar-Sync_%26_ICS-2D6A4F?style=flat-square&logo=googlecalendar&logoColor=white)

**AI-powered personal health and wellness platform with locally tailored daily plans, safety-first symptom triage, live Google Maps doctor discovery, and Google Calendar booking.**

Baymini is built as a calm, guest-first health web application. Users can generate personalized wellness routines, evaluate symptoms with layered emergency safeguards, discover nearby doctors matched to their needs, and sync appointments to Google Calendar without hitting a mandatory login wall on startup.

---

## Preview

<!-- Replace with screenshots from your app once uploaded to /docs or /public -->
> **Light & Dark Mode** — Designed with a high-contrast Botanical Pine / Warm Alabaster light theme and Obsidian Forest / Luminous Sage dark theme, complete with print-ready PDF stylesheets.

---

## Core Features

### 1. Your Customized Health Plan
* **Region & Budget-Aware Nutrition:** Generates daily meal recommendations tailored to the user's country, local cuisine, dietary preferences, and food budget using practical everyday ingredients.
* **Single-Item AI Swap:** Swap an individual meal or exercise card (for a cheaper, quicker, or injury-safe alternative) without regenerating the entire plan.
* **Collapsible Local Shopping List:** Automatically extracts categorized everyday ingredients from the generated meals with one-click clipboard copy.
* **Routine-to-Calendar Sync:** Optional just-in-time Google Calendar sync (with `.ics` and pre-filled calendar link fallbacks) to add morning movement, midday hydration, or evening wind-down blocks.
* **Clean Print / PDF Output:** Dedicated `@media print` styling exports crisp ink-on-paper plans regardless of whether Light or Dark Mode is active.

### 2. Profile-Aware Symptoms Checker
* **3-Step Adaptive Triage:** Initial searchable symptom checklist, dynamically generated Gemini clinical follow-up questions, and structured guidance with urgency levels (`Emergency`, `Prompt`, `Routine`, `Self-Care`).
* **Profile-Aware Opt-Out:** Automatically factors in saved age, chronic conditions, allergies, and medications from the user's Health Profile with a single transparent opt-out toggle.
* **3-Layer Emergency Safety Intercept:**
  1. Always-visible quick shortcut to emergency hospital search.
  2. Instant client-side red-flag combination and typo-tolerant keyword detection (works even offline).
  3. AI-level emergency override across multi-language inputs.
* **Printable Pre-Visit Doctor Brief:** Compiles the clinical summary, follow-up answers, relevant profile context, and suggested doctor questions into a single copyable/printable clinic handoff sheet.

### 3. Take Doc's Advice (Live Maps & Calendar Booking)
* **Smart Specialty Discovery:** Powered by Google Maps with dual location input (on-demand GPS geolocation + manual city/area search), specialty query expansion, automatic broadening when narrow listings are sparse, local Haversine distance calculation, and dark-mode map styling.
* **Seamless Triage Handoff:** Carries the recommended specialty and clinical brief directly from the Symptoms Checker into the doctor finder and booking drawer.
* **Calendar Conflict Check & Sync:** Optional Google Calendar Free/Busy check on appointment slots, automatic event creation with attached symptom notes, automatic OAuth re-authorization retry on token expiry, and zero-login fallbacks (`.ics` file download + pre-filled Google Calendar URL).
* **My Bookings Manager:** Persistent drawer for viewing upcoming/past visits, rescheduling, cancelling, opening Maps directions, and re-syncing calendar events.

### 4. Actionable Floating Gemini Health Assistant
* **Full Session Awareness:** Context-aware across the user's active Health Plan, latest Symptom Check, and upcoming Bookings.
* **Multilingual & Scoped:** Replies naturally in the user's language while staying strictly focused on health and wellness with instant emergency escalation.
* **Clickable Action Chips:** Surfaces direct navigation chips (such as jumping to a matched specialist or starting a symptom check) right beneath relevant replies.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Tailwind CSS, Lucide React |
| **AI Engine** | Google Gemini API (`@google/genai`) with structured JSON schemas & defensive normalizers |
| **Location & Maps** | Google Maps JavaScript API, Places & Geocoding, Haversine distance utilities |
| **Scheduling** | Google Calendar API (just-in-time OAuth), RFC 5545 `.ics` generator |
| **State & Privacy** | React Context (`BayminiContext`) + validated `localStorage` with 1-click **Clear My Data** |

---

## Getting Started

### Prerequisites
* **Node.js** `20.0.0` or higher
* **npm** (or compatible package manager)
* A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/)
* *(Optional for standalone hosting)* Google Cloud API credentials for Google Maps JavaScript / Places API and a Google OAuth 2.0 Client ID for Calendar API

### Local Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/KhademHere/baymini.git](https://github.com/KhademHere/baymini.git)
   cd baymini

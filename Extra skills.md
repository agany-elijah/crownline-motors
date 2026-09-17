1. ADDITIONAL FRONTEND DESIGN SKILLS
# Frontend Design Pro Tailwind Skill

A Claude Code skill for building professional, official-looking frontend interfaces with **Tailwind CSS latest/v4**, **React/Next.js**, **TypeScript/JavaScript**, and full **RTL/LTR multilingual UI support**.

This skill is designed for projects that need polished, production-ready interfaces such as dashboards, landing pages, admin panels, forms, SaaS apps, government portals, enterprise systems, and Arabic/English multilingual products.

## What This Skill Does

`frontend-design-pro-tailwind` guides an AI coding agent to create and refactor frontend interfaces using modern Tailwind CSS practices.

It focuses on:

- Professional UI composition
- Official and enterprise-grade design style
- Tailwind CSS latest/v4 conventions
- CSS-first Tailwind configuration
- Design tokens and reusable primitives
- RTL/LTR-safe layouts
- Arabic-first and multilingual interfaces
- Responsive design
- Accessible components
- Modern React/Next.js UI patterns
- Direction-aware icons
- Clean, maintainable frontend architecture

## Key Features

### Tailwind CSS Latest / v4 Ready

The skill encourages modern Tailwind CSS usage, including:

- `@import "tailwindcss";`
- CSS-first configuration with `@theme`
- Design tokens through CSS variables
- Logical utilities
- Dynamic utility values
- Container-aware layouts
- Modern variants and states
- Clean component-level class composition

### RTL/LTR Multilingual Support

The skill enforces direction-aware frontend development.

It prefers logical Tailwind utilities such as:

```txt
ms-* / me-* instead of ml-* / mr-*
ps-* / pe-* instead of pl-* / pr-*
start-* / end-* instead of left-* / right-*
text-start / text-end instead of text-left / text-right
border-s-* / border-e-* instead of border-l-* / border-r-*
rounded-s-* / rounded-e-* instead of rounded-l-* / rounded-r-*
```

This helps interfaces work correctly in both:

```html
<html lang="en" dir="ltr">
```

and:

```html
<html lang="ar" dir="rtl">
```

### Direction-Aware Icons

The skill includes a strict rule to avoid raw directional icons such as:

```tsx
<ChevronRight />
<ChevronLeft />
```

for navigation-related actions.

Instead, it provides reusable components:

```tsx
<ForwardChevron />
<BackChevron />
<DropdownChevron />
```

This prevents common RTL bugs where the layout is correct but the icon direction breaks the user experience.

### Professional UI System

The skill includes guidance for:

- Page shells
- Hero sections
- Dashboards
- Cards
- Forms
- Tables
- Navigation
- Sidebars
- Empty states
- Status badges
- Landing pages
- Responsive sections
- Official visual hierarchy
- Consistent spacing and typography

## Folder Structure

After extracting the package, the skill is structured like this:

```txt
skills/
  frontend-design-pro-tailwind/
    SKILL.md
    references/
      tailwind-v4-system.md
      official-ui-style.md
      rtl-ltr-ui.md
      layout-composition.md
      typography.md
      color-elevation.md
      component-patterns.md
      responsive-design.md
      accessibility.md
      motion-states.md
      final-ui-audit.md
    assets/
      globals.css
      directional-icons.tsx
      primitives.tsx
      professional-page-shell.tsx
      dashboard-template.tsx
      landing-page-template.tsx
      form-template.tsx
  README.md
  skills.md
```

## Installation in Claude Code

### Install for One Project

From the root of your project:

```bash
mkdir -p .claude/skills
unzip frontend_design_pro_tailwind_skill.zip
cp -R skills/frontend-design-pro-tailwind .claude/skills/
```

Your final project structure should look like this:

```txt
your-project/
  .claude/
    skills/
      frontend-design-pro-tailwind/
        SKILL.md
        references/
        assets/
```

### Install Globally for All Projects

To make the skill available across all Claude Code projects:

```bash
mkdir -p ~/.claude/skills
unzip frontend_design_pro_tailwind_skill.zip
cp -R skills/frontend-design-pro-tailwind ~/.claude/skills/
```

## How to Use

Inside Claude Code, run a prompt like:

```txt
Use the frontend-design-pro-tailwind skill to redesign this page as a professional official Tailwind v4 interface with RTL/LTR support.
```

Or:

```txt
Use the frontend-design-pro-tailwind skill to audit this project for RTL issues, Tailwind v4 issues, layout problems, and raw ChevronRight/ChevronLeft usage.
```

Or:

```txt
Use the frontend-design-pro-tailwind skill to create a professional dashboard page using Tailwind CSS v4, React, TypeScript, and Arabic/English RTL/LTR support.
```

## Recommended Prompts

### Build a Professional Page

```txt
Use the frontend-design-pro-tailwind skill.

Create a professional official frontend page using Tailwind CSS v4 and React.

Requirements:
- Clean enterprise-grade layout
- RTL/LTR support
- Responsive design
- Accessible components
- Logical Tailwind utilities
- No raw ChevronRight or ChevronLeft
- Use ForwardChevron and BackChevron for directional navigation
```

### Audit Existing Code

```txt
Use the frontend-design-pro-tailwind skill.

Audit the current frontend code for:
- Tailwind CSS v4 best practices
- RTL/LTR problems
- raw ChevronRight/ChevronLeft usage
- ml/mr/pl/pr usage
- left/right positioning
- text-left/text-right alignment
- inaccessible components
- weak spacing, typography, or visual hierarchy

Refactor the code to be professional, official, responsive, and RTL-safe.
```

### Improve UI Quality

```txt
Use the frontend-design-pro-tailwind skill.

Improve this interface to look more professional and official.

Focus on:
- layout hierarchy
- spacing
- typography
- color usage
- cards and sections
- responsive behavior
- accessible states
- RTL/LTR compatibility
- Tailwind v4 logical utilities
```

## Included Assets

### `globals.css`

A Tailwind v4-ready global CSS starter with theme tokens and professional UI foundations.

### `directional-icons.tsx`

Reusable icon components for multilingual interfaces:

- `ForwardChevron`
- `BackChevron`
- `DropdownChevron`

### `primitives.tsx`

Reusable frontend primitives for professional UI composition.

### `professional-page-shell.tsx`

A page shell template for official and enterprise layouts.

### `dashboard-template.tsx`

A dashboard starter template.

### `landing-page-template.tsx`

A landing page starter template.

### `form-template.tsx`

A professional form starter template.

## RTL Safety Rules

The skill strongly discourages physical left/right utilities unless there is a specific reason.

Avoid by default:

```txt
left-*
right-*
ml-*
mr-*
pl-*
pr-*
text-left
text-right
border-l-*
border-r-*
rounded-l-*
rounded-r-*
space-x-* without rtl:space-x-reverse
```

Prefer:

```txt
start-*
end-*
ms-*
me-*
ps-*
pe-*
text-start
text-end
border-s-*
border-e-*
rounded-s-*
rounded-e-*
gap-*
```

## Icon Rules

Do not use raw directional icons for navigation:

```tsx
// Avoid
<ChevronRight className="size-4" />
<ChevronLeft className="size-4" />
```

Use:

```tsx
<ForwardChevron />
<BackChevron />
```

For dropdowns, use:

```tsx
<DropdownChevron />
```

## Best Use Cases

This skill is useful for:

- Next.js applications
- React dashboards
- SaaS admin panels
- Arabic/English websites
- Government or official portals
- Enterprise applications
- Landing pages
- Authentication pages
- Forms and settings screens
- Design system foundations
- Tailwind CSS refactoring
- RTL migration

## Requirements

Recommended project stack:

- Tailwind CSS latest/v4
- React or Next.js
- TypeScript or JavaScript
- lucide-react for icons
- A `cn()` utility for class merging

Example `cn()` utility:

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## Notes

This skill does not replace a complete design system, but it gives Claude Code strong frontend rules, reusable templates, and RTL-safe conventions for building polished interfaces faster.

It is especially useful when the AI agent tends to generate LTR-first Tailwind code or uses raw `ChevronRight` icons that break RTL user experience.

## License

MIT


2. EXTRA INSTRUCTIONS TO FOLLOW

# SKILL: ULTIMATE FRONTEND DESIGN & ENGINEERING SYSTEM — CROWNLINE MOTORS

> **Purpose:** This is the authoritative frontend design and engineering specification for Crownline Motors. It governs all UI, UX, layout, component, styling, interaction, responsive, accessibility, and frontend architecture decisions across the website.
>
> **Stack:** Next.js + TypeScript + Tailwind CSS + shadcn/Radix where appropriate.
>
> **Primary objective:** Produce a production-grade automotive website that looks deliberately designed and engineered by an experienced human product/design team—not generic AI-generated or "vibe-coded" software.

---

# 0. CORE DIRECTIVE — READ BEFORE WRITING CODE

Before writing or modifying ANY frontend code:

### 0.1 State the aesthetic direction

Begin by explicitly stating the design direction in one sentence.

Use this as the project's permanent foundation:

> **"Calm, precise, modern automotive luxury with strong visual hierarchy, exceptional vehicle photography, high-trust signals, and restrained premium detailing."**

Commit to this direction.

Do not drift toward:

* SaaS aesthetics
* startup landing-page conventions
* generic dashboard aesthetics
* flashy luxury aesthetics
* gaming interfaces
* excessive minimalism
* "AI-generated" visual patterns

Crownline Motors should feel like a **serious international automotive business serving South Sudan**, combining the clarity of a modern dealership with the visual discipline of a premium automotive brand.

---

# 1. PRODUCT DESIGN PHILOSOPHY

The interface must communicate five qualities:

1. **Trust**
2. **Professionalism**
3. **Automotive expertise**
4. **Clarity**
5. **Premium quality without ostentation**

Cars and useful information are the visual priority.

Decoration is secondary.

Every visual element must justify its existence through one or more of:

* helping the user understand something
* helping the user navigate
* helping the user make a decision
* increasing confidence
* improving usability
* establishing brand identity

Do not add visual effects merely because they are technically possible.

---

# 2. ANTI-AI / ANTI-TEMPLATE DIRECTIVE

The following patterns are prohibited unless there is a specific, documented design reason.

## 2.1 Prohibited visual tropes

### NO generic gradients

Do not use:

* purple → blue gradients
* teal → purple gradients
* colorful blurred blobs
* `blur-3xl` decorative blobs
* glowing gradient backgrounds

Do not place blurred color blobs behind text or containers.

Directional image gradients are permitted **only when necessary to preserve text readability over photography**, for example:

```text
bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent
```

This is an image-legibility mechanism, not decoration.

---

### NO uniform card swarms

Do not create rows of:

```text
rounded-2xl
bg-white
border
generic icon
heading
paragraph
```

repeated three or four times.

Avoid interfaces that look assembled from identical cards.

Use:

* asymmetric composition
* editorial hierarchy
* varied content density
* full-width sections
* photography
* structured information
* intentional whitespace
* different visual weights

---

### NO generic typography

Never use:

* Inter as the primary display font
* Roboto
* Arial
* generic `system-ui`
* browser-default sans-serif typography

Typography must be intentionally configured.

---

### NO lazy shadows

Avoid:

* `shadow-2xl`
* `shadow-black/50`
* large artificial floating shadows

Prefer:

* borders
* surface contrast
* restrained ambient shadows
* subtle depth

---

### NO pure black / pure white large surfaces

Avoid:

```text
#000000
#ffffff
```

for major page surfaces.

Use calibrated neutrals such as:

```text
zinc-950
zinc-900
zinc-800
neutral-50
neutral-100
```

or equivalent project tokens.

Pure white may still be used selectively for small content surfaces, typography, icons, or photography treatment where appropriate.

---

### NO arbitrary magic values

Do not invent arbitrary Tailwind values such as:

```text
p-[13px]
w-[342px]
top-[11.5px]
gap-[19px]
```

Use established design tokens and the project's spacing scale.

Exceptions are permitted only when a value is genuinely required for:

* optical alignment
* image composition
* a documented brand measurement
* browser/platform-specific correction

Such exceptions must be intentional, not habitual.

---

# 3. DESIGN SYSTEM FOUNDATIONS

## 3.1 8-POINT SPATIAL GRID

All major layout dimensions must follow an 8px rhythm.

A 4px sub-grid is permitted for dense micro-components.

### 4px — micro

Use for:

* badge internals
* icon/text micro spacing
* compact metadata

Tailwind examples:

```text
gap-1
p-1
```

### 8px — tight

Use for:

* button icon gaps
* inline controls
* compact rows

```text
gap-2
p-2
```

### 16px — standard

Use for:

* standard component padding
* small list gaps
* form spacing

```text
gap-4
p-4
```

### 24px — medium

Use for:

* card interiors
* medium grid gaps
* grouped content

```text
gap-6
p-6
```

### 32px — large

Use for:

* section internals
* large component separation
* major content groups

```text
gap-8
p-8
```

### 64px+

Use for:

* major section separation
* page-level vertical rhythm

```text
py-16
py-24
```

Do not mechanically apply the same spacing everywhere.

The grid establishes rhythm; hierarchy determines scale.

---

# 4. LAYOUT & COMPOSITION

## 4.1 Avoid predictable compositions

Do not default to:

```text
Centered heading
↓
paragraph
↓
button
↓
three cards
```

unless the content genuinely requires it.

Prefer compositions that establish hierarchy through:

* asymmetry
* scale
* photography
* whitespace
* strong alignment
* variable column spans
* editorial rhythm

---

## 4.2 12-column grid

For complex desktop compositions, use a 12-column CSS grid.

Example:

```text
Hero visual:     col-span-12 lg:col-span-8
Technical panel: col-span-12 lg:col-span-4
```

Use asymmetric spans when they improve hierarchy.

Do not force asymmetry merely to satisfy this rule.

---

## 4.3 Split-screen compositions

When appropriate:

```text
60% visual stage
40% information / interaction
```

This is especially appropriate for:

* vehicle detail pages
* quote interfaces
* vehicle highlights
* technical information sections

---

## 4.4 Full-bleed sections

Use full-width visual or contextual bands where appropriate.

Examples:

* automotive photography
* brand statements
* logistics/process sections
* customer trust sections
* informational order-tracking stages

A centered content container should not constrain every section.

---

# 5. OPTICAL ALIGNMENT

Mathematical alignment is not always visual alignment.

Prioritize optical alignment.

Use:

* `items-center`
* baseline alignment
* controlled offsets
* carefully considered icon placement

Small optical corrections are acceptable when necessary.

Do not introduce arbitrary offsets without a visual reason.

---

# 6. TYPOGRAPHY ARCHITECTURE

Use three distinct typographic roles.

## 6.1 Display font — brand character

Reserved for:

* H1
* H2
* major hero statements
* major statistics
* important automotive statements

Suitable directions include:

* Clash Display
* Bricolage Grotesque
* Cabinet Grotesque
* Syne
* another distinctive professional display face

Choose **one**.

Do not combine multiple decorative display fonts.

---

## 6.2 Body font — reading ergonomics

Use a highly legible modern typeface such as:

* Geist
* Plus Jakarta Sans
* Source Sans 3
* another carefully selected neutral sans

Body text should generally begin around:

```text
16px
```

with approximately:

```text
1.6–1.7 line-height
```

Do not use an oversized body type merely to make the design appear premium.

---

## 6.3 Technical mono — automotive data

Use a technical monospace font such as:

* Geist Mono
* JetBrains Mono

Reserved for:

* prices
* mileage
* vehicle specifications
* VIN
* order numbers
* tracking numbers
* timestamps
* inventory quantities
* technical identifiers
* status codes

Apply:

```text
font-mono tabular-nums
```

where numerical alignment matters.

---

# 7. TYPOGRAPHIC SCALE

Use a disciplined hierarchy.

| Level      | Size                   | Weight    | Tracking | Leading | Usage                     |
| ---------- | ---------------------- | --------- | -------- | ------- | ------------------------- |
| Hero       | `text-5xl lg:text-7xl` | bold      | tight    | ~1.05   | Primary value proposition |
| H1         | `text-3xl lg:text-4xl` | semibold  | tight    | tight   | Major page titles         |
| H2         | `text-xl lg:text-2xl`  | semibold  | snug     | snug    | Section titles            |
| Body Large | `text-lg`              | normal    | normal   | relaxed | Lead text                 |
| Body       | `text-sm lg:text-base` | normal    | normal   | normal  | Main content              |
| Caption    | `text-xs lg:text-sm`   | medium    | wide     | tight   | Metadata                  |
| Kicker     | `text-xs`              | mono bold | widest   | tight   | Category labels           |

Do not create arbitrary typographic levels without reason.

---

# 8. TEXT MEASURE

Body content should generally be constrained to:

```text
max-w-[65ch]
```

or an equivalent semantic design token.

Long-form text should never span the entire viewport simply because space is available.

---

# 9. COLOR ARCHITECTURE

Use a semantic token system.

Do not scatter raw color decisions throughout components.

Define the project's palette centrally.

## 9.1 Allocation

Use approximately:

### 60% — dominant surface

Examples:

```text
neutral-50
zinc-950
```

depending on page mode.

### 30% — secondary surfaces

Examples:

```text
zinc-900
zinc-800
white
neutral-100
```

### 10% — accent

Choose one principal accent and use it consistently.

The accent should primarily identify:

* primary CTAs
* active states
* important interactive controls
* selected states
* focus indicators where appropriate

Do not turn every heading, border, icon, and decoration into the accent color.

---

# 10. CROWNLINE BRAND APPLICATION

The design should preserve Crownline Motors' existing premium automotive direction:

* black / charcoal
* white / off-white
* restrained gold accent
* green for relevant positive/price states where already established
* blue where it serves semantic or informational purposes

Do not introduce a second competing accent system without a design reason.

The gold accent should feel **premium and restrained**, not metallic or ornamental.

---

# 11. SURFACE HIERARCHY

## Dark surfaces

Use luminance stepping rather than flat black.

Conceptual hierarchy:

```text
Canvas
  #09090b

Sub-surface
  #121215

Interactive surface
  #18181b

Hover surface
  #27272a

Active border
  #3f3f46
```

Never place black cards on a black canvas without meaningful separation.

---

# 12. BORDER-FIRST ELEVATION

Default:

```text
border border-white/10
```

Light surfaces:

```text
border border-black/10
```

Hover:

```text
hover:border-white/30
```

Use subtle shadows only when they reinforce hierarchy.

Example:

```text
shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)]
```

Do not use shadows as the primary method of creating hierarchy.

---

# 13. BORDER RADIUS SYSTEM

Choose one coherent radius language.

Preferred Crownline direction:

* `rounded-md` — controls / dense elements
* `rounded-lg` — standard components
* `rounded-xl` — major cards
* `rounded-2xl` — large visual surfaces only

Nested elements must not have larger radii than their parent.

Do not make every element extremely rounded.

Automotive interfaces should retain some structural precision.

---

# 14. COMPONENT ENGINEERING

Use reusable components immediately when a pattern repeats.

Examples:

```text
Button
Input
Select
Badge
VehicleCard
VehicleGallery
SpecGrid
FilterBar
QuoteForm
StatusIndicator
SectionHeading
TrustSignal
OrderTimeline
```

Use `class-variance-authority` or an equivalent variant system where component variants become complex.

Do not duplicate large blocks of Tailwind classes across the application.

---

# 15. TAILWIND CLASS ORDER

Maintain a consistent class ordering:

1. Position
2. Display / Flex / Grid
3. Sizing
4. Spacing
5. Typography
6. Background / surface
7. Border / radius
8. Interactive states
9. Motion

Example:

```text
relative flex items-center gap-4
w-full min-h-12 px-4
font-medium text-sm
bg-zinc-900 text-zinc-100
rounded-lg border border-white/10
hover:bg-zinc-800 focus-visible:ring-2
active:scale-[0.98]
transition-transform duration-200
```

---

# 16. INTERACTIVE STATE SYSTEM

Every interactive element must account for six states.

## 16.1 Default

Clear baseline.

## 16.2 Hover

Provide explicit visual feedback.

Examples:

```text
hover:bg-zinc-800
hover:border-white/30
hover:text-white
```

## 16.3 Focus-visible

Mandatory keyboard-accessible indication.

Example:

```text
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-amber-500
focus-visible:ring-offset-2
```

The ring offset must visually contrast against the current surface.

## 16.4 Active / pressed

Provide tactile feedback where appropriate.

Example:

```text
active:scale-[0.98]
```

Do not apply physical scaling to every element indiscriminately.

## 16.5 Disabled

Use:

```text
disabled:opacity-40
disabled:cursor-not-allowed
disabled:pointer-events-none
```

where applicable.

## 16.6 Loading / pending

Loading must communicate system activity.

Use:

* spinner
* skeleton
* pulse
* progress indicator

Never leave the user wondering whether their action registered.

---

# 17. BUTTON SYSTEM

Buttons must have:

* minimum mobile target of 44×44px
* clear hierarchy
* visible focus state
* disabled state
* pending state
* pressed state
* accessible text or `aria-label`

Do not create five competing primary buttons.

Every screen should have an obvious primary action.

---

# 18. VEHICLE CARD SYSTEM

Vehicle cards are among the most important reusable components in the product.

They must communicate information efficiently.

Required hierarchy:

1. Vehicle photography
2. Year / make / model
3. Price
4. Key specifications
5. Relevant status/badges
6. Primary action

Example structure:

```text
[Large Vehicle Image]

2024
Toyota Harrier XGL

$XX,XXX

Automatic · Petrol
XX,XXX km · 2.0L

[Explore Vehicle]
```

Do not bury the primary information beneath decorative content.

---

# 19. VEHICLE IMAGE RULES

Vehicle imagery must use explicit aspect ratios.

Preferred:

```text
aspect-[16/10]
```

or:

```text
aspect-[4/3]
```

Use:

```text
object-cover
```

when appropriate.

All Next.js images must have:

* explicit dimensions or `fill`
* appropriate `sizes`
* meaningful `alt`
* no avoidable layout shift

---

# 20. IMAGE MOTION

For vehicle photography:

```text
overflow-hidden
```

on the image container.

Optional hover treatment:

```text
group-hover:scale-105
transition-transform
duration-700
```

Motion must remain restrained.

The vehicle itself—not the animation—is the focal point.

---

# 21. IMAGE TEXT OVERLAYS

When text is placed over photography, use a directional readability layer.

Example:

```text
bg-gradient-to-t
from-zinc-950
via-zinc-950/40
to-transparent
```

This is explicitly permitted because its purpose is legibility.

Do not use decorative gradients behind ordinary interface content.

---

# 22. SPECIFICATION MATRICES

Technical information should use dense, aligned matrices.

Example conceptual structure:

```tsx
<div>
  <span>ENGINE</span>
  <span>2.0L TURBO</span>
</div>
```

Labels should be visually subordinate.

Values should use:

```text
font-mono
tabular-nums
```

where numerical precision or alignment matters.

Specifications should be grouped logically:

* Engine
* Transmission
* Fuel
* Mileage
* Drive
* Body type
* Year
* Dimensions
* Performance

Do not display irrelevant specifications merely to make the card appear more complete.

---

# 23. HOMEPAGE / LANDING PAGE

The homepage must establish the business within seconds.

Recommended hierarchy:

### Hero

Use strong automotive photography or inventory imagery.

The hero must communicate:

* what Crownline Motors does
* geographic relevance
* quality/trust
* primary action

Avoid the generic:

```text
Centered heading
Centered paragraph
Two floating buttons
```

Instead, use strong visual hierarchy and an intentional composition.

---

### Inventory access

Provide a clear route into vehicles.

Possible actions:

```text
Explore Vehicles
Browse Inventory
Get a Quote
```

Choose based on page context.

---

### Trust signals

Introduce trust near the upper portion of the page.

Potential information:

* vehicle sourcing
* import markets
* customer service
* inspection
* logistics
* payment process
* business location
* years / experience if factually supported

Do not invent credibility claims.

---

### Featured vehicles

Use real vehicle photography.

Do not use placeholder images in the finished interface.

---

### Process / How it works

Explain the journey:

```text
Select vehicle
↓
Request quote
↓
Confirm details
↓
Initial deposit
↓
Procurement / shipment
↓
Arrival
↓
Final payment
↓
Handover
```

The presentation should feel like an automotive procurement process, not a generic SaaS workflow.

---

# 24. INVENTORY / SEARCH RESULTS PAGE

Inventory must prioritize scanning.

Required capabilities where applicable:

* make
* model
* price
* year
* mileage
* body type
* fuel type
* transmission
* sorting
* pagination or controlled loading

Filters must be URL-addressable when technically appropriate.

Example:

```text
/inventory?make=Toyota&year=2024
```

The URL should represent meaningful filter state.

---

## Desktop filters

Possible:

* sticky sidebar
* structured horizontal controls

---

## Mobile filters

Use a bottom sheet or equivalent thumb-accessible control.

Example conceptual structure:

```text
fixed
inset-x-0
bottom-0
z-50
rounded-t-2xl
```

Do not allow the filter interface to cover critical content without a clear dismissal mechanism.

---

# 25. EMPTY STATES

Every major data-driven interface must have an intentional empty state.

Examples:

```text
No vehicles match these filters.
```

Then provide useful actions:

```text
Clear filters
Browse all vehicles
Adjust price range
```

Never leave a blank page.

---

# 26. VEHICLE DETAIL PAGE — HIGHEST-PRIORITY CONVERSION SURFACE

The Vehicle Detail Page must be treated as a premium product page.

Above the fold should establish:

1. Large vehicle gallery
2. Year / make / model
3. Trim
4. Price
5. Core specifications
6. Primary CTA
7. Secondary contact path

For Crownline Motors, primary actions may include:

```text
Get a Quote
Contact via WhatsApp
```

depending on the vehicle/business workflow.

Do not create unnecessary ecommerce checkout behavior if the business process is quote-based.

---

# 27. VEHICLE GALLERY

Support:

* multiple angles
* exterior
* interior
* dashboard
* engine where available
* detail shots

Mobile should support natural swipe interaction where implemented.

Desktop should support clear gallery navigation.

Images must load efficiently.

---

# 28. QUOTE EXPERIENCE

Quote forms must remain short and purposeful.

Typical fields:

* full name
* phone
* email
* WhatsApp
* city
* notes

Do not turn a quote request into an unnecessarily long application.

The vehicle context should remain visible while the user completes the request.

Example:

```text
Toyota Harrier XGL
2024 · Automatic

[Customer information]

[Additional notes]

[Submit Quote Request]
```

---

# 29. TRUST & TRANSACTION UX

The interface must clearly distinguish between:

* informational content
* customer requests
* administrative actions
* confirmed business transactions

Do not visually imply that a payment or order is automatically confirmed if the real business process requires manual verification.

Where the business process is manual, the interface should explain that clearly and professionally.

---

# 30. ORDER TRACKING EXPERIENCE

The tracking page should be designed as an **informational customer journey**, not merely a status number.

The customer should understand the stages through which a vehicle or spare-part order progresses.

Possible stages:

```text
Quote / Order Confirmed
↓
Initial Deposit Confirmed
↓
Procurement
↓
Inspection / Preparation
↓
Shipment
↓
Port / Mombasa
↓
Transit
↓
Arrival
↓
Final Payment
↓
Ready for Handover
↓
Completed
```

Only display stages that correspond to the actual business process.

Use:

* clear stage labels
* concise explanations
* relevant imagery where useful
* dates when available
* current-stage emphasis
* completed/current/upcoming visual distinction

The tracking number should be treated as a precise technical identifier and use:

```text
font-mono
tabular-nums
```

Do not expose internal administrative information.

---

# 31. SPARE PARTS UX

Spare parts should feel like a natural extension of the automotive business.

The interface should communicate:

* part identity
* compatibility
* category
* availability
* related vehicle
* quantity where relevant
* images
* quote action

If the business process is quote-based, do not create a fake ecommerce checkout merely because an ecommerce pattern is familiar.

Use:

```text
Add to Quote
```

or an equivalent action where appropriate.

---

# 32. FORMS

Forms must be:

* short
* logically grouped
* clearly labelled
* keyboard accessible
* mobile friendly
* validated
* error tolerant

Labels must always be visible.

Do not rely on placeholder text as the label.

Errors must appear close to the relevant field.

Do not pre-disable the submit button merely because fields are incomplete.

Instead:

* allow submission where appropriate
* validate
* clearly explain missing/invalid information

---

# 33. RESPONSIVE DESIGN

Mobile-first is mandatory.

Do not treat mobile as a shrunken desktop.

Design specifically for:

* thumb reach
* narrow viewports
* touch interaction
* reduced visual density
* image cropping
* sticky actions
* readable typography

---

# 34. TOUCH TARGETS

Interactive mobile controls must have a minimum physical target of approximately:

```text
44 × 44px
```

This applies to:

* buttons
* icon buttons
* navigation
* tabs
* filter controls
* carousel controls
* form controls

---

# 35. STICKY ELEMENTS

Sticky headers, filters, and mobile CTA bars must never:

* obscure focused elements
* cover critical information
* trap users
* create accidental clicks

Always account for safe spacing and viewport constraints.

---

# 36. MOTION SYSTEM

Motion must explain or reinforce interaction.

Never animate merely to demonstrate technical capability.

## Enter / reveal

Use approximately:

```text
300–600ms
```

with a controlled ease-out curve such as:

```text
cubic-bezier(0.16, 1, 0.3, 1)
```

## State changes

Approximately:

```text
200ms
```

with:

```text
cubic-bezier(0.4, 0, 0.2, 1)
```

## Hover

Generally:

```text
150–200ms
```

## Cinematic sections

Generally:

```text
400–600ms
```

Avoid:

* linear motion
* excessive bounce
* spongy springs
* unnecessary parallax
* constant movement

---

# 37. PREFERS-REDUCED-MOTION

All non-essential motion must respect:

```text
prefers-reduced-motion
```

Users who request reduced motion must receive a usable interface without cinematic animation.

Do not make core information dependent on animation.

---

# 38. ACCESSIBILITY

Accessibility is a core engineering requirement, not a finishing step.

Every interface must provide:

* semantic HTML
* keyboard navigation
* visible focus
* sufficient contrast
* meaningful labels
* accessible names for icon buttons
* correct heading hierarchy
* appropriate ARIA only where necessary
* accessible form errors
* non-color-only status communication

Target WCAG AA contrast as a minimum.

Aim for strong practical readability rather than merely passing automated checks.

---

# 39. COLOR IS NOT THE ONLY STATUS SIGNAL

Do not communicate state using color alone.

For example:

Instead of:

```text
green = completed
yellow = pending
red = failed
```

also provide:

```text
Completed
Pending
Action Required
```

and/or icons or structural indicators.

---

# 40. NEXT.JS ENGINEERING RULES

Use Server Components by default.

Use Client Components only when required for:

* interaction
* browser APIs
* state
* forms
* animation libraries
* client-side filtering
* other genuinely interactive behavior

Do not mark entire pages as `"use client"` without a reason.

---

# 41. TYPESCRIPT

All component props must be strictly typed.

Do not use:

```text
any
```

unless an external library forces it and there is no safer boundary type.

Prefer:

* explicit interfaces
* discriminated unions
* reusable domain types
* schema-derived types where appropriate

Do not duplicate domain models unnecessarily.

---

# 42. DATA & DOMAIN CONSISTENCY

Frontend terminology must reflect the actual Crownline Motors business domain.

Use consistent terms for:

* Vehicle
* Spare Part
* Quote
* Order
* Payment
* Shipment
* Tracking
* Customer
* Admin
* Status
* Handover

Do not invent alternative labels for the same concept across different pages.

---

# 43. PERFORMANCE

Every frontend decision should consider:

* image size
* image format
* lazy loading
* responsive image sizes
* layout stability
* JavaScript bundle size
* unnecessary client components
* animation cost
* rendering cost
* network requests

Prefer the simplest implementation that produces the required experience.

Do not introduce a library merely because it can produce an effect that CSS can handle.

---

# 44. IMAGES

Automotive photography is a primary design asset.

Prioritize:

* high-quality images
* correct cropping
* consistent aspect ratios
* responsive sizes
* meaningful alt text
* lazy loading where appropriate
* appropriate priority loading for above-the-fold imagery

Never allow poor image handling to undermine an otherwise premium interface.

---

# 45. GLOBAL NAVIGATION

Navigation should make the business understandable.

Possible primary destinations:

```text
Vehicles
Spare Parts
How It Works
Track Order
About
Contact
```

Use the actual project requirements rather than blindly implementing every item.

The navigation must prioritize the most important customer journeys.

---

# 46. MOBILE NAVIGATION

Mobile navigation should be:

* simple
* thumb-friendly
* clearly hierarchical
* keyboard accessible where relevant
* dismissible
* free from unnecessary animation

Avoid hamburger menus containing an excessive number of nested layers.

---

# 47. FOOTER

The footer should function as a genuine navigation and trust area.

Possible groups:

* Vehicles
* Spare Parts
* Customer
* Company
* Contact
* Legal

Include relevant business contact information and social channels where actually available.

Do not fabricate addresses, phone numbers, certifications, partnerships, warranties, or other claims.

---

# 48. EMPTY / ERROR / LOADING STATES

Every data-driven feature must consider:

### Loading

Show useful skeletons or progress indicators.

### Empty

Explain what happened and provide a next action.

### Error

Explain the problem in human language.

Avoid exposing raw:

```text
500
Prisma error
fetch failed
undefined
```

to customers.

Technical diagnostics belong in logs.

---

# 49. ERROR RECOVERY

Whenever possible, provide a recovery path:

```text
Try again
Return to inventory
Clear filters
Contact Crownline Motors
```

Do not create dead ends.

---

# 50. CONTENT PRINCIPLES

Interface copy must be:

* concise
* factual
* professional
* customer-oriented
* unambiguous

Avoid:

* exaggerated marketing claims
* empty luxury language
* meaningless superlatives
* excessive exclamation marks
* generic AI copy

Instead of:

> "Experience the ultimate automotive journey of unparalleled excellence."

Prefer concrete information.

---

# 51. TRUST SIGNALS MUST BE EVIDENCE-BASED

Never invent:

* review counts
* customer numbers
* years of operation
* certifications
* warranties
* inspection guarantees
* shipping times
* partnerships
* market leadership claims

If the business has not supplied the fact, do not manufacture it to make the website look more credible.

---

# 52. CLASS COMPOSITION DISCIPLINE

Prefer components over enormous repeated class strings.

If a pattern appears repeatedly, extract it.

Do not abstract components prematurely when the abstraction makes the design harder to understand.

The objective is:

```text
Reusable
+
Readable
+
Strongly typed
+
Design-consistent
```

—not maximal abstraction.

---

# 53. DESIGN TOKENS MUST BE CENTRALIZED

Colors, typography, radius, spacing, and other repeated design decisions should be represented centrally wherever the project architecture permits.

Do not create local versions of the same token.

If Crownline changes its accent from one gold value to another, the change should ideally happen in one design-system location rather than dozens of components.

---

# 54. SHADCN / RADIX CUSTOMIZATION

shadcn/Radix components are implementation primitives, not the final visual design.

Never ship an untouched default shadcn interface when it conflicts with the Crownline visual language.

Customize:

* radius
* typography
* spacing
* borders
* surfaces
* states
* focus treatment
* component density

The final product must look like Crownline Motors, not like a shadcn demo.

---

# 55. DESIGN HIERARCHY RULE

When visual elements compete, use this hierarchy:

```text
1. Vehicle / primary content
2. Primary action
3. Important commercial information
4. Supporting information
5. Navigation
6. Decorative treatment
```

Decorative elements must never compete with the vehicle or primary action.

---

# 56. DO NOT OVER-DESIGN

Premium does not mean:

* more animation
* more gradients
* more glass
* more borders
* more cards
* more gold
* more text
* more icons

Premium means:

* intentional
* coherent
* restrained
* precise
* high quality
* trustworthy

When uncertain, remove rather than add.

---

# 57. HUMAN-DESIGN TEST

Before considering a component finished, ask:

### Could this component belong to any random AI-generated website?

If yes, redesign it.

### Does the layout communicate hierarchy without decoration?

If no, improve the composition.

### Does the photography remain the visual hero?

If no, reduce UI noise.

### Does the interface feel appropriate for an actual automotive company?

If no, redesign it.

### Does the component communicate its purpose immediately?

If no, simplify it.

---

# 58. REQUIRED PROCESS FOR EVERY UI TASK

Before implementation:

## Step 1 — Aesthetic direction

State the design direction in one sentence.

## Step 2 — Understand the user journey

Identify:

* user goal
* page purpose
* primary action
* secondary action
* important information
* edge cases

## Step 3 — Sketch hierarchy

Describe the structure briefly:

```text
Header
Hero
Primary information
Supporting content
Trust/process
CTA
Footer
```

Do not begin coding before the hierarchy is understood.

## Step 4 — Identify reusable components

Determine which elements should become:

* shared components
* page-specific components
* primitives

## Step 5 — Apply design tokens

Use the established:

* typography
* spacing
* colors
* radius
* borders
* motion

## Step 6 — Implement mobile-first

Start with the narrowest meaningful layout.

Then enhance for tablet and desktop.

## Step 7 — Add interaction states

Verify:

* default
* hover
* focus-visible
* active
* disabled
* loading

## Step 8 — Add accessibility

Verify:

* keyboard navigation
* labels
* semantics
* focus
* contrast
* touch targets

## Step 9 — Add performance safeguards

Verify:

* image dimensions
* `sizes`
* loading strategy
* unnecessary client components
* unnecessary dependencies

## Step 10 — Self-critique

Do not stop after the first implementation.

Inspect the result critically and correct:

* generic compositions
* excessive repetition
* inconsistent spacing
* weak hierarchy
* unnecessary decoration
* poor mobile behavior
* inaccessible interactions
* inconsistent terminology

---

# 59. MANDATORY FINAL VERIFICATION CHECKLIST

Before presenting frontend code, verify every applicable item.

### Design system

* [ ] Distinctive display font configured
* [ ] Body font configured
* [ ] Technical mono font configured
* [ ] Typography hierarchy is intentional
* [ ] 8px / 4px spacing rhythm respected
* [ ] No unexplained magic Tailwind values
* [ ] Design tokens used consistently
* [ ] Radius system is coherent
* [ ] No generic AI visual patterns

### Visual design

* [ ] No generic gradient blobs
* [ ] No unnecessary glassmorphism
* [ ] No neon glow
* [ ] No uniform card swarm
* [ ] No harsh shadows
* [ ] No sterile pure-white or pure-black large surfaces
* [ ] Vehicle imagery receives appropriate visual priority
* [ ] Composition has deliberate hierarchy
* [ ] Whitespace is purposeful

### Interaction

* [ ] Default state
* [ ] Hover state
* [ ] Focus-visible state
* [ ] Active state
* [ ] Disabled state
* [ ] Loading/pending state
* [ ] Reduced-motion behavior
* [ ] Touch targets ≥44px where applicable

### Accessibility

* [ ] Semantic HTML
* [ ] Keyboard navigation
* [ ] Visible focus indicators
* [ ] Accessible labels
* [ ] Icon buttons have accessible names
* [ ] Form errors are clear
* [ ] Contrast is sufficient
* [ ] Status is not communicated by color alone

### Images

* [ ] Explicit image dimensions or `fill`
* [ ] Appropriate `sizes`
* [ ] Correct aspect ratio
* [ ] `object-cover` where appropriate
* [ ] Meaningful alt text
* [ ] No avoidable layout shift
* [ ] Appropriate loading priority

### Engineering

* [ ] Server Components used by default
* [ ] Client Components only where necessary
* [ ] Strict TypeScript
* [ ] No unjustified `any`
* [ ] Repeated patterns extracted
* [ ] shadcn/Radix components customized where necessary
* [ ] No unnecessary dependencies
* [ ] URL state used for meaningful filters where appropriate

### Automotive UX

* [ ] Vehicle information is immediately understandable
* [ ] Price is visually clear
* [ ] Core specifications are scannable
* [ ] Primary vehicle action is obvious
* [ ] Quote workflow is clear
* [ ] Inventory filters are usable
* [ ] Vehicle detail page prioritizes gallery + commercial information
* [ ] Empty states exist
* [ ] Loading states exist
* [ ] Error states exist
* [ ] Order tracking explains the customer's journey
* [ ] Spare-parts experience follows the actual business model
* [ ] Trust claims are factual and evidence-based

---

# 60. FINAL QUALITY GATE

Before shipping any page or component, it must satisfy all four dimensions:

## A. DESIGN

Does it look deliberately designed rather than generated from a template?

## B. UX

Can a real customer understand what to do without instruction?

## C. ENGINEERING

Is the implementation maintainable, performant, typed, and responsive?

## D. BRAND

Does it feel unmistakably appropriate for Crownline Motors?

If any answer is "no", revise the implementation before considering the work complete.

---

# FINAL PRINCIPLE

**Build less like a collection of UI components and more like a coherent automotive product.**

Every page should feel as though the same experienced design and engineering team deliberately created it.

The result should be:

**Professional automotive clarity + restrained premium aesthetics + strong photography + high-trust UX + disciplined engineering.**

Never optimize for visual novelty at the expense of usability.

Never optimize for speed of code generation at the expense of design quality.

Never add decoration merely because an AI model can generate it.

**Clarity first. Automotive content second. Trust third. Brand expression fourth. Decoration last.**

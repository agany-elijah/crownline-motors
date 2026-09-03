## NON-NEGOTIABLE RULES

1. **READ BEFORE MODIFYING**
   Always inspect the relevant existing code, architecture, dependencies, and configuration before making changes. Never modify files based on assumptions.

2. **FOLLOW THE PROJECT SPECIFICATION**
   Treat this `CLAUDE.md` and the approved project requirements as the authoritative source of truth. Do not invent features, business rules, or architecture that contradict them.

3. **DO NOT BREAK EXISTING FUNCTIONALITY**
   Before implementing a change, understand what currently works and preserve it. New functionality must integrate with the existing system rather than unnecessarily replacing working code.

4. **NO UNNECESSARY REWRITES**
   Never rewrite, restructure, or replace large sections of the application when a smaller, targeted change is sufficient.

5. **PRODUCTION-QUALITY CODE ONLY**
   Write maintainable, modular, readable, typed, secure, and production-oriented code. Do not implement temporary hacks or "demo-quality" solutions unless explicitly requested.

6. **NEVER COMPROMISE SECURITY**
   Never weaken authentication, authorization, validation, database security, access controls, or security policies to make a feature work.

7. **PROTECT ALL SECRETS**
   Never expose, hard-code, commit, log, or display API keys, passwords, tokens, service-role keys, private credentials, or other secrets. Respect `.env` and `.gitignore` conventions.

8. **RESPECT AUTHORIZATION BOUNDARIES**
   Never assume that hiding a UI element provides security. Every protected operation must be enforced server-side and at the appropriate database/API layer.

9. **VALIDATE ALL EXTERNAL INPUT**
   Treat user input, API requests, uploaded files, URL parameters, form submissions, and third-party data as untrusted. Validate, sanitize, and constrain them appropriately.

10. **DATABASE CHANGES REQUIRE EXTREME CAUTION**
    Never delete, truncate, reset, or destructively modify production data or production database structures without explicit approval. Preserve existing data and relationships.

11. **USE THE EXISTING TECHNOLOGY STACK**
    Do not introduce a new framework, library, service, database technology, authentication mechanism, or architectural pattern merely because it is convenient. First determine whether the existing stack already provides an appropriate solution.

12. **KEEP TYPES AND CONTRACTS CONSISTENT**
    Maintain consistency between database schemas, TypeScript types, API contracts, validation schemas, server logic, and UI components. Do not silence type errors with `any`, unsafe casts, or ignored errors unless there is a documented reason.

13. **HANDLE ERRORS PROPERLY**
    Never hide errors or use empty `catch` blocks, arbitrary fallbacks, or silent failures to make the application appear functional. Errors must be handled deliberately and communicated appropriately.

14. **TEST AFTER SIGNIFICANT CHANGES**
    After implementing meaningful changes, run the appropriate type checks, linting, tests, and build verification. Do not claim a feature works without verifying it.

15. **INVESTIGATE ROOT CAUSES**
    When something fails, diagnose the underlying cause before applying a fix. Do not repeatedly patch symptoms or make random changes until an error disappears.

16. **PRESERVE DATA AND BUSINESS LOGIC**
    Never change calculations, pricing rules, order states, payment logic, inventory behavior, permissions, or other business-critical logic without first understanding and preserving the intended business rules.

17. **DESIGN FOR ACCESSIBILITY AND RESPONSIVENESS**
    All user-facing interfaces must be usable across supported screen sizes and should follow appropriate accessibility practices, semantic HTML, keyboard navigation, readable contrast, and meaningful labels.

18. **OPTIMIZE WITHOUT PREMATURE COMPLEXITY**
    Prioritize correctness and maintainability first, then performance. Avoid unnecessary dependencies, excessive abstraction, duplicated logic, and premature optimization.

19. **ASK BEFORE MAKING HIGH-IMPACT DECISIONS**
    If a change could significantly alter architecture, database structure, authentication, security, deployment, business logic, or existing functionality, stop and explain the implications before proceeding unless explicit authorization has already been given.

20. **VERIFY YOUR OWN WORK**
    After every substantial implementation, inspect the resulting changes as if reviewing another developer's work. Check for regressions, security weaknesses, incorrect assumptions, dead code, broken imports, type errors, incomplete functionality, and inconsistencies with this specification.


Crownline Motors (Name to be changed later) WEBSITE PRODUCT BRIEF
# 1. BUSINESS

**Business name:** Crownline Motors

**Business type:** Vehicle dealership and international vehicle-import business, with future spare-parts sales.

**Main market:** South Sudan 🇸🇸

**Vehicle sources:** Japan 🇯🇵 and South Korea 🇰🇷

**Business model:** Customers should be able to browse vehicles, see their full details and pricing, request/buy a vehicle, and track the vehicle throughout the import and delivery process.

The website should also be architected to support a **spare-parts marketplace and ordering system** as a later expansion without requiring the core platform to be rebuilt.

The website should look like a large, premium international automotive company, not a basic small-business website.

The visual identity should use the Crownline Motors logo and a premium black, gold and white colour scheme.

⸻

## 2. MAIN WEBSITE NAVIGATION

The main navigation should contain:

* Home
* Cars
* Spare Parts
* How It Works
* Track My Order
* Get a Quote
* About Us
* Contact

There should also be prominent buttons for:

**VIEW CARS**

**SPARE PARTS**

**TRACK MY ORDER**

**GET A QUOTE**

**WHATSAPP US**

The website must be fully responsive and work properly on phones, tablets and computers.

The **Track My Order** function should eventually support both vehicle shipments and spare-parts orders rather than creating completely separate tracking systems.

⸻

## 3. HOME PAGE

The homepage should immediately communicate what Crownline Motors does.

### Hero section

Display a premium automotive image/video with:

**CROWNLINE MOTORS**

**Quality Cars. Global Standards. Local Commitment.**

Supporting text:

“Quality vehicles sourced from Japan and Korea and delivered to South Sudan.”

Buttons:

**VIEW AVAILABLE CARS**

**TRACK MY ORDER**

The homepage may also introduce spare parts as a future/available product category once the spare-parts section is launched.

⸻

## 4. CAR SEARCH SYSTEM

Create a proper vehicle marketplace/inventory system.

Customers should be able to search and filter vehicles by:

* Make
* Model
* Year
* Price
* Mileage
* Fuel type
* Transmission
* Engine size
* Drive type
* Vehicle location
* Availability

Example:

Toyota → Harrier → 2021 → Automatic → Under $25,000

The results should display attractive vehicle cards.

Each card should show:

* Main vehicle photo
* Make and model
* Year
* Mileage
* Engine
* Transmission
* Fuel
* Price
* Availability
* Country of origin

Each card should have:

**VIEW DETAILS**

The vehicle inventory should be database-driven and managed through the admin dashboard.

The underlying product/inventory architecture should be designed so that spare parts can later exist alongside vehicles without requiring a complete rebuild of the inventory system.

⸻

## 5. INDIVIDUAL VEHICLE PAGE

Every vehicle needs its own detailed page.

For example:

**Toyota Harrier 2021**

Large vehicle photo gallery at the top.

Display:

Price: $XX,XXX

Mileage: 42,000 km

Year: 2021

Engine: 2.0L

Transmission: Automatic

Fuel: Petrol

Drive: 2WD

Exterior: Black

Interior: Black

Country: Japan

### Vehicle description

Include a detailed description of the vehicle and its condition.

### Photo gallery

Allow multiple high-quality photographs.

Potentially include:

* Front
* Rear
* Side
* Interior
* Dashboard
* Engine
* Wheels
* Any damage
* Auction sheet/documentation where applicable

### Price section

Show:

Vehicle price

* Shipping estimate
* Clearing/port estimate
* Other applicable charges

= **Estimated delivered price**

Important: clearly state when a price is an estimate and when it is confirmed.

Buttons:

**REQUEST THIS VEHICLE**

**GET A QUOTE**

**WHATSAPP ABOUT THIS CAR**

The WhatsApp button should automatically generate a contextual message containing the vehicle name and listing/reference number.

⸻

## 6. GET A QUOTE SYSTEM

Customers who cannot find exactly what they want should be able to request a vehicle.

Create a form asking:

* Full name
* Phone number
* WhatsApp number
* Email
* Country/city
* Make
* Model
* Preferred year
* Maximum budget
* Preferred country: Japan / Korea / Either
* Fuel type
* Transmission
* Additional requirements

Button:

**REQUEST MY CAR**

The information should be sent to the Crownline Motors admin dashboard/email.

The quotation system should also be architected to support **spare-parts quotation requests** later.

Spare parts with clearly established prices should be capable of being purchased directly through a cart/order workflow, while uncommon, imported or unavailable parts can use the **Get a Quote** process.

The quotation system should therefore support:

* Vehicle quotations
* Spare-parts quotations
* Quotations containing multiple items
* Quotations containing both vehicles and spare parts where appropriate

⸻

## 7. HOW IT WORKS PAGE

Create a professional visual timeline explaining the entire vehicle import process.

**STEP 1 — Choose Your Vehicle**

Customer searches our available vehicles or requests a specific vehicle.

**STEP 2 — Reserve Your Vehicle**

Customer confirms the vehicle and completes the required payment/deposit.

**STEP 3 — Inspection & Verification**

Vehicle information, condition and documentation are checked.

**STEP 4 — Export**

Vehicle is prepared and transported to the relevant shipping port.

**STEP 5 — International Shipping**

Vehicle is shipped toward Mombasa, Kenya.

**STEP 6 — Clearing**

The vehicle goes through the required port/customs and clearing process.

**STEP 7 — Transport**

Vehicle is transported from Mombasa toward South Sudan.

**STEP 8 — Delivery**

Customer is notified when the vehicle is ready for collection or delivery.

Use photographs/icons and a visual progress timeline so this is easy to understand.

Once spare parts are introduced, the website should also provide an appropriate spare-parts purchasing/fulfillment explanation rather than forcing spare parts through the vehicle-import workflow.

⸻

## 8. ORDER AND PURCHASE SYSTEM

Customers should be able to move from a vehicle or spare-parts product to an order.

The system should distinguish between:

* Enquiry
* Quote
* Accepted quote
* Order
* Payment
* Fulfillment
* Shipment
* Delivery

### Vehicle orders

Vehicle purchases should follow an appropriate commercial workflow such as:

Customer request/quote

↓

Quotation

↓

Customer accepts quotation

↓

Required deposit

↓

Payment confirmation

↓

Order confirmed

↓

Vehicle reserved/procured

↓

Export/shipping

↓

Tracking

↓

Final payment

↓

Delivery/release

The exact payment stages should be configurable by the dealership.

### Spare-parts orders

Spare parts should support:

Product selection

↓

Cart or quote request

↓

Order

↓

Payment

↓

Processing

↓

Packing/dispatch

↓

Shipment tracking

↓

Delivery

The same underlying order and payment infrastructure should be used for both vehicles and spare parts, while each product type can have its own specific workflow.

⸻

## 9. VEHICLE TRACKING SYSTEM

This is one of the most important features.

The customer-facing page should eventually be called:

**TRACK MY ORDER**

This should support both vehicle tracking and spare-parts shipment tracking.

For vehicle orders, customers can enter their unique tracking number.

Example:

**CLM-2026-000125**

Button:

**TRACK ORDER**

After entering the tracking number, display the vehicle information.

Example:

**Toyota Harrier 2021**

Tracking number: CLM-2026-000125

Current status: **IN TRANSIT 🚢**

### Vehicle tracking timeline

Vehicle Purchased ✓

Inspection Completed ✓

Export Documentation ✓

Vehicle Exported ✓

Loaded for Shipping ✓

In Transit 🔵

Arrived at Mombasa ○

Clearing ○

Transport to South Sudan ○

Ready for Collection ○

Each stage should have:

* Date
* Status
* Location
* Optional notes

For example:

**21 August 2026**

**In Transit**

Vehicle currently being transported by sea.

### Spare-parts tracking

The same underlying tracking infrastructure should support spare-parts shipments, but spare parts should have a simpler appropriate timeline, for example:

Order Confirmed ✓

Processing ✓

Packed ✓

Dispatched ✓

In Transit 🔵

Out for Delivery ○

Delivered ○

The customer should not need to understand the internal distinction between vehicle logistics and spare-parts logistics. The system should identify the type of order from the tracking number and display the appropriate tracking experience.

The tracking number should be generated automatically by the system when the relevant vehicle or shipment tracking record is created.

Customers should receive their tracking number through their customer account and, where configured, through email/SMS/WhatsApp notifications.

If a customer has not yet reached the stage where tracking is available, the system should clearly communicate that tracking has not yet been activated.

⸻

## 10. ADMIN DASHBOARD

The website must have a secure administrator dashboard.

The administrator should be able to:

### Vehicles

* Add vehicle
* Edit vehicle
* Delete vehicle
* Upload multiple photos
* Change price
* Change mileage
* Change availability
* Mark vehicle as sold
* Add description
* Add specifications
* Manage vehicle documents where applicable

### Spare Parts

The architecture should support a dedicated spare-parts inventory section.

The administrator should eventually be able to:

* Add spare part
* Edit spare part
* Delete spare part
* Upload product images
* Add part number
* Add category
* Add description
* Set price
* Set stock quantity
* Set availability
* Add compatible vehicle models
* Manage supplier information where appropriate
* Mark parts as out of stock
* Publish/unpublish parts

### Orders

View customers who have requested or purchased vehicles or spare parts.

Orders should clearly identify:

* Customer
* Product/order type
* Order number
* Amount
* Payment status
* Fulfillment status
* Shipment/tracking status
* Order date

### Customers

Store customer information securely.

### Vehicle tracking

Admin should be able to update a customer's tracking status.

For example:

Purchased → Inspection → Exported → Shipped → Mombasa → Clearing → South Sudan → Delivered

The customer should automatically see the updated status on the tracking page.

### Spare-parts fulfillment/tracking

Admin should be able to update spare-parts orders through stages such as:

Processing → Packed → Dispatched → In Transit → Out for Delivery → Delivered

### Quotes

Admin should be able to view quote requests and respond to customers.

The quotation system should support both vehicle and spare-parts quote requests.

### Payments

Admin should be able to:

* View payments
* View pending payments
* Confirm manual payments
* Reject invalid payments
* Record payment references
* View payment history
* View outstanding balances
* Issue/record refunds where applicable

All payment confirmations and important financial actions should have an audit trail showing who performed the action and when.

⸻

## 11. CUSTOMER ACCOUNT

Eventually, customers should be able to create an account.

After logging in they should see:

* My Vehicles
* My Orders
* My Payments
* My Documents
* Order Tracking
* Messages/Updates
* Quotes

For a purchased vehicle, they should be able to see its entire journey.

For spare-parts purchases, they should be able to see:

* Orders
* Payment status
* Shipment/tracking status
* Delivery information

Customers must only be able to access their own information.

⸻

## 12. PAYMENTS

Build the website so payment functionality can be added securely.

Initially, we may use:

* Bank transfer
* Mobile money
* Manual payment confirmation

The website should provide customers with clear payment instructions and allow them to submit payment references or indicate that a payment has been made.

Manual payments should initially enter a **pending verification** state.

An authorized administrator must verify the payment before the system considers it confirmed.

The system should support payment statuses such as:

* Pending
* Submitted
* Under verification
* Confirmed
* Failed
* Rejected
* Refunded

The payment architecture should be provider-agnostic so that online payment providers appropriate for South Sudan/international customers can be integrated later without rebuilding the order system.

Later, the system should be expandable to support online payment providers.

The website should use secure server-side payment verification/webhooks when online payment providers are introduced.

Payments should be associated with orders but maintained as individual transaction records so that one order can support deposits, subsequent payments, balances, refunds and other financial events.

For vehicle orders, payment confirmation should control the appropriate stages of the order workflow.

Payment Policy

Crownline Motors will use the following payment structure for customer vehicle orders:

50% Initial Payment
Once a customer's vehicle order has been accepted and confirmed by Crownline Motors, the customer must pay 50% of the total agreed vehicle price. Shipment and procurement will proceed after this payment is received.
25% Mombasa Payment
When the vehicle arrives at Mombasa, the customer must pay a further 25% of the total agreed price.
25% Final Payment
The remaining 25% must be paid before the vehicle is released and handed over to the customer.

The customer must therefore have paid the full 100% of the agreed vehicle price before final handover.
These are not fixed percentages, they should be configurable by the admin.
The system should clearly show the customer the payment stages, amounts paid, remaining balance, and the payment milestone that is currently due. And clearly calculate the amounts due in each stage for easy interpretation by the customer and easy tracking, so incorporate that appropriately in the database where necessary, don't just place it, but put it without breaking the database schema and business rules associated, should also match the relevant features.
The same payment infrastructure should be reusable for spare-parts orders.

⸻

## 13. WHATSAPP INTEGRATION

Because WhatsApp will be important for customers, add a WhatsApp button throughout the website.

On an individual vehicle page, the button should automatically create a message such as:

“Hello Crownline Motors, I am interested in the Toyota Harrier 2021, listing reference CLM-XXXXX.”

The customer should be able to contact the dealership immediately.

The WhatsApp functionality should be contextual.

For example, on a spare-parts page it should generate a message referring to:

* Spare-part name
* Part number/reference
* Relevant product information

On an order/tracking page it can generate a support message containing the relevant order or tracking reference.

The dealership's WhatsApp number should be configurable from the admin/settings area rather than hard-coded into individual pages.

Initially, this can use WhatsApp click-to-chat functionality.

A future version may integrate WhatsApp Business/API functionality for:

* Automated order notifications
* Payment confirmations
* Tracking updates
* Delivery notifications
* Customer support
* CRM integration

⸻

## 14. CONTACT PAGE

Include:

* Phone
* WhatsApp
* Email
* Location
* Business hours
* Social media links
* Contact form

Also include a map/location section if appropriate.

⸻

## 15. DESIGN

The website should look:

* Premium
* Modern
* Luxury
* Trustworthy
* International
* Automotive
* Clean
* Fast

Use the Crownline Motors branding.

### Colours

Primary:

**Black**

**Gold**

**White**

Avoid making the website look overly flashy.

The gold should be used mainly for accents, buttons, headings and branding.

Use high-quality vehicle photography.

Use large images and clean typography.

The website should feel closer to a premium international automotive dealership than a basic local classified-ads website.

The spare-parts section should use the same Crownline Motors design system so that it feels like part of the same company rather than a separate website.

⸻

## 16. MOBILE DESIGN

Mobile is extremely important because many customers will access the website through their phones.

The mobile version must have:

* Easy navigation
* Large vehicle images
* Easy filtering
* Click-to-call
* WhatsApp button
* Easy quote request
* Easy vehicle/order tracking
* Easy spare-parts browsing once launched
* Easy spare-parts ordering once launched
* Fast loading

The website should look excellent on an iPhone and Android phone.

⸻

## 17. SECURITY

The developer must build the website securely.

Important areas:

* Secure admin login
* Customer data protection
* Secure database
* HTTPS/SSL
* Secure payment integration
* Protection against common website attacks
* Regular backups
* Proper authentication and authorization
* Secure file/image uploads
* Audit logs for important administrative and financial actions

Customers must only be able to see their own orders/tracking information.

Administrators should only have permissions appropriate to their roles.

Payment credentials and sensitive card information must never be stored directly in the website database.

⸻

## 18. SEARCH ENGINE OPTIMISATION

Build the website with SEO in mind.

Examples of searches we want to eventually rank for:

“Cars for sale in South Sudan”

“Imported cars South Sudan”

“Japan cars South Sudan”

“Japan car imports Juba”

“Korea cars South Sudan”

“Toyota South Sudan”

“Used cars Juba”

Create proper SEO titles, descriptions, URLs and structured vehicle pages.

The architecture should also support future SEO pages for spare parts, for example:

“Toyota spare parts South Sudan”

“Toyota parts Juba”

“Japanese car spare parts South Sudan”

“Toyota Harrier spare parts”

Each vehicle and spare-part product page should have appropriate metadata and structured information.

⸻

## 19. WEBSITE SPEED

The website must be optimized for people using slower mobile internet connections.

Use:

* Compressed images
* Lazy loading
* Optimized code
* Fast hosting
* Caching
* Mobile optimization

Do not load huge image files unnecessarily.

The spare-parts catalogue should follow the same performance principles, particularly because it may eventually contain a large number of product images.

⸻

## 20. FUTURE EXPANSION

Build the system so it can eventually expand beyond South Sudan.

Potential future markets:

🇸🇸 South Sudan

🇺🇬 Uganda

🇰🇪 Kenya

🇷🇼 Rwanda

🇹🇿 Tanzania

🇪🇹 Ethiopia

🌍 Other African markets

The system should therefore not be built in a way that makes expansion and scaling difficult.

Potential future features:

* Multiple currencies
* Multiple countries
* Multiple dealerships
* Financing
* Trade-ins
* Vehicle auctions
* Customer reviews
* Insurance
* Vehicle valuation
* Fleet sales
* Spare-parts marketplace
* Supplier management
* Parts inventory management
* Parts compatibility database
* Automated logistics integrations
* WhatsApp Business/API integration

⸻

## 21. IMPORTANT — DO NOT BUILD EVERYTHING AT ONCE

Because Crownline Motors is a new business, build the website in phases.

### PHASE 1 — Launch Version

Must have:

1. Professional homepage
2. Vehicle inventory
3. Vehicle detail pages
4. Search/filter
5. Quote request
6. WhatsApp integration
7. Contact page
8. How It Works
9. Basic vehicle tracking
10. Secure admin dashboard
11. Basic order management
12. Basic payment management supporting bank transfer, mobile money and manual confirmation
13. Database-driven vehicle inventory
14. Tracking-number generation and tracking-event management

The architecture of Phase 1 must already be designed to accommodate spare parts, even if the full spare-parts marketplace is not activated at launch.

### PHASE 2 — Customer & Commerce Expansion

Add:

1. Customer accounts
2. Spare-parts inventory and marketplace
3. Spare-parts product pages
4. Spare-parts cart and ordering
5. Spare-parts quote requests for products requiring quotation
6. Shared order system for vehicles and spare parts
7. Customer dashboard
8. Documents
9. Automated notifications
10. More advanced tracking
11. Spare-parts shipment tracking
12. Inventory/stock management

### PHASE 3

Add:

1. Multiple countries
2. Multiple currencies
3. Financing
4. Trade-ins
5. Advanced logistics tracking
6. Multiple dealerships
7. Supplier integrations
8. WhatsApp Business/API automation
9. Mobile app if the business becomes large enough

The architecture should ensure that moving from Phase 1 to Phase 2 does not require rebuilding the core customer, order, quotation, payment, inventory or tracking systems.

⸻

## 22. IMPORTANT TECHNICAL REQUIREMENT

I do not want a website where the developer has to manually edit the code every time I add a car.

I need a CMS/admin dashboard where I can log in and:

**Add Car → Upload Photos → Enter Specifications → Enter Price → Publish**

and the vehicle automatically appears on the website.

Similarly, when I update:

**Tracking Status → Mombasa → Clearing**

the customer should automatically see the new status when they enter their tracking number.

The system should be built as a proper database-driven website rather than a collection of static pages.

The same principle should apply to spare parts when that section is activated:

**Add Spare Part → Upload Image → Enter Part Number → Enter Compatibility → Enter Price/Quote Status → Set Stock → Publish**

and the product should automatically appear in the spare-parts section.

The underlying architecture should use shared core entities where appropriate, including:

* Customers
* Products
* Orders
* Quotations
* Payments
* Shipments
* Tracking events
* Documents
* Notifications

Vehicles and spare parts should have their own product-specific information while sharing the appropriate core infrastructure.

The system should not duplicate separate payment, customer, order or tracking systems unnecessarily.

⸻

## 23. FINAL RESULT

The goal is to create a website where a customer can go from:

**Finding a car**

↓

**Understanding the car**

↓

**Seeing the price**

↓

**Requesting/buying the car**

↓

**Making the required payment/deposit**

↓

**Receiving a tracking number**

↓

**Following the vehicle’s journey**

↓

**Receiving the vehicle in South Sudan**

The same platform should eventually allow a customer to:

**Find a spare part**

↓

**View compatibility, availability and price**

↓

**Add to cart or request a quote**

↓

**Place an order**

↓

**Make payment**

↓

**Receive a shipment/tracking number**

↓

**Track the order**

↓

**Receive the spare parts**

The website should make Crownline Motors look professional, trustworthy and established, even as a new company.

Most importantly, the platform should be designed as a **scalable automotive commerce system**, not merely a vehicle catalogue. The initial launch should focus on vehicles, while the underlying architecture should be sufficiently extensible to support spare parts, additional product categories, payments, logistics, multiple markets and other future commercial capabilities without requiring a fundamental rebuild.


Make sure to go step by step implementing every feature gradually as you build them on top of each other without breaking previous features or architecture. Just be consistent in every stage therefore, and given your scope of the project now, you have to build a feature knowing in mind what is coming ahead, build wholeheartedly and keep in mind, its not a demo project, its an actual company website given to me by a client who is paying for it, so its not to be taken merely.




TECH STACK
Language  ➡️  TypeScript

Frontend  ➡️  Next.js (App Router) + React

Styling  ➡️  Tailwind CSS

UI Components  ➡️  shadcn/ui + Radix UI

Backend/API  ➡️    Next.js API routes / Server Actions

Database  ➡️   PostgreSQL (Supabase)

ORM   ➡️   Prisma

Auth  ➡️   Supabase Auth

File Storage  ➡️   Supabase Storage (Future: Cloudflare R2)

Validation  ➡️   Zod

Testing  ➡️   Vitest + Playwright

Version Control  ➡️  Git + GitHub

CI/CD    ➡️   GitHub Actions  ➡️  Vercel

CDN / WAF / DNS   ➡️  Cloudflare

Hosting  ➡️  Vercel

Monitoring   ➡️   Sentry

NOT PRIORITY FOR NOW:
Cache / Background Jobs  ➡️  Deferred to Phase 2 (Upstash Redis + QStash)
API Documentation ➡️  Deferred to Phase 2 (OpenAPI)



## MASTER DEVELOPMENT ROADMAP
WAVE A — EVERYTHING NEEDED TO LAUNCH
Next.js + Supabase + Prisma Architecture
This plan supersedes the previous Flask-based development plan. It preserves the business requirements from the latest Crownline Motors brief, incorporates the spare-parts expansion, and restructures the implementation around the new TypeScript/Next.js stack.
The central principle is:
Build the core platform once, prove each vertical slice, and make vehicles and spare parts share the appropriate commerce infrastructure without forcing them into the same business workflow.

PHASE 0 — PROJECT FOUNDATION
Stage 1 — Project skeleton and development environment
Objective
Establish a clean, production-oriented Next.js application before implementing business functionality.
Project structure
Use a structure broadly along these lines:

crownline-motors/
│
├── app/
│   ├── (marketing)/
│   ├── cars/
│   ├── spare-parts/
│   ├── track/
│   ├── quote/
│   ├── contact/
│   ├── admin/
│   ├── account/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── vehicles/
│   ├── spare-parts/
│   ├── orders/
│   ├── tracking/
│   ├── quotes/
│   └── shared/
│
├── lib/
│   ├── prisma/
│   ├── supabase/
│   ├── auth/
│   ├── validation/
│   ├── whatsapp/
│   └── utils/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── public/
│
├── tests/
│   ├── unit/
│   └── e2e/
│
├── types/
│
├── actions/
│
├── .env.local
├── .env.example
├── .gitignore
├── package.json
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── README.md

The exact directory organization can be adjusted by the coding agent where Next.js conventions make a better alternative, but separation of concerns must be maintained.
Configure
	•	TypeScript 
	•	Next.js App Router 
	•	React 
	•	Tailwind CSS 
	•	shadcn/ui 
	•	Radix UI 
	•	ESLint 
	•	Prisma 
	•	Supabase client/server utilities 
	•	Zod 
	•	Vitest 
	•	Playwright 
	•	Git 
	•	GitHub 
Environment variables
Create:
.env.local
.env.example

Never commit secrets.
Expected configuration will eventually include:

DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_WHATSAPP_NUMBER
SENTRY_DSN

Only the variables that actually belong in the project should be added.
Git
Initialize:
main
development

Use feature branches for substantial changes.
Validation gate
Do not proceed until:
	•	Next.js starts successfully. 
	•	TypeScript compiles. 
	•	Tailwind works. 
	•	shadcn/ui works. 
	•	Prisma connects. 
	•	Supabase connection works. 
	•	Git repository exists. 
	•	.env.local is ignored. 
	•	.env.example exists. 
	•	Vitest runs. 
	•	Playwright can launch. 
	•	Production build succeeds. 

PHASE 1 — DATABASE AND CORE ARCHITECTURE
Stage 2 — Design the database architecture
Objective
Define the business model before building individual features.
This is one of the most important stages because the platform will eventually contain:
	•	Vehicles 
	•	Spare parts 
	•	Customers 
	•	Quotes 
	•	Orders 
	•	Payments 
	•	Tracking 
	•	Documents 
	•	Notifications 
The architecture should avoid creating completely independent systems for each product type.

Core entities
Identity
	•	User/Profile 
	•	Customer 
	•	Admin/User role 
Supabase Auth handles authentication.
Your PostgreSQL database stores the application-specific profile and authorization information.

Vehicle domain
	•	Vehicle 
	•	VehiclePhoto 
	•	VehicleDocument 

Spare-parts domain
	•	SparePart 
	•	PartPhoto 
	•	Category 
	•	PartCompatibility 
	•	Inventory record 

Commerce
Rather than designing completely separate financial infrastructure for everything, use a common commerce foundation.
Core entities should include:
	•	Quote 
	•	Order 
	•	OrderItem 
	•	Payment 
An order can contain different types of products where commercially appropriate.
For example:

Order
 ├── Customer
 ├── OrderItems
 │     ├── Vehicle
 │     └── SparePart
 └── Payments

However, vehicle orders and spare-parts orders can have different business rules and fulfillment workflows.

Logistics
	•	Shipment 
	•	TrackingRecord 
	•	TrackingEvent 
This is preferable to creating a completely isolated "vehicle tracking database."
The underlying tracking architecture can support:

Vehicle Shipment
       OR
Spare-Part Shipment

while displaying different timelines according to shipment type.


Important relationships
Conceptually:

Customer
 ├── Quotes
 ├── Orders
 └── Payments

Vehicle
 ├── Photos
 ├── Documents
 └── OrderItems

SparePart
 ├── Photos
 ├── Category
 ├── Compatibility
 └── OrderItems

Order
 ├── Customer
 ├── OrderItems
 ├── Payments
 └── Shipment

Shipment
 └── TrackingEvents

Database requirements
Define:
	•	UUIDs or appropriate primary keys 
	•	Human-readable references 
	•	Foreign keys 
	•	Cascading rules 
	•	Required/optional fields 
	•	Enums/statuses 
	•	Timestamps 
	•	Indexes 
	•	Unique constraints 
	•	Soft deletion where appropriate 
Validation gate
Create the first Prisma migration.
Verify:
	•	Migration succeeds. 
	•	Database can be reset in development. 
	•	Relationships are correct. 
	•	Unique constraints work. 
	•	Foreign-key constraints work. 
	•	Prisma Client generates correctly. 
Do not proceed until the schema is coherent.

PHASE 2 — DESIGN SYSTEM AND APPLICATION SHELL
Stage 3 — Crownline design system
Objective
Establish the visual language before building dozens of pages.
Use:
Black + Gold + White
with a restrained premium automotive aesthetic.
Define:
	•	Typography 
	•	Font hierarchy 
	•	Spacing 
	•	Border radius 
	•	Shadows 
	•	Buttons 
	•	Cards 
	•	Inputs 
	•	Tables 
	•	Badges 
	•	Dialogs 
	•	Alerts 
	•	Navigation 
	•	Mobile navigation 
	•	Loading states 
	•	Empty states 
	•	Error states 
Use:
	•	Tailwind CSS 
	•	shadcn/ui 
	•	Radix UI 
Avoid excessive custom components where shadcn/ui already provides a suitable foundation.

Stage 4 — Public website shell
Build:
	•	Header 
	•	Navigation 
	•	Footer 
	•	Mobile navigation 
	•	WhatsApp floating button 
	•	Page container system 
	•	Breadcrumbs 
	•	Responsive layout 
	•	Global metadata structure 
Navigation:

Home
Cars
Spare Parts
How It Works
Track My Order
Get a Quote
About Us
Contact

Primary CTAs:

VIEW CARS
SPARE PARTS
TRACK MY ORDER
GET A QUOTE
WHATSAPP US

Some features can initially be disabled/marked unavailable until their implementation stage.
Validation gate
Verify the shell at:
	•	Desktop 
	•	Tablet 
	•	Mobile 

PHASE 3 — AUTHENTICATION AND ADMIN FOUNDATION
Stage 5 — Supabase authentication
Use:
Supabase Auth
for authentication.
Implement:
	•	Admin login 
	•	Customer authentication foundation 
	•	Session handling 
	•	Logout 
	•	Password reset 
	•	Protected routes 
	•	Authentication state 
Do not duplicate authentication logic unnecessarily inside Next.js.

Stage 6 — Authorization
Authentication answers:
Who are you?
Authorization answers:
What are you allowed to do?
Implement roles such as:

ADMIN
STAFF
CUSTOMER

Initially, you may only need:

ADMIN
CUSTOMER

but the architecture should not make staff roles difficult later.
Protect:

/admin/*

and customer-private routes:

/account/*

Validation gate
Attempt:

Unauthenticated → /admin

Must be denied.
Attempt:

Customer → admin-only functionality

Must be denied.

PHASE 4 — ADMIN DASHBOARD
Stage 7 — Admin dashboard shell
Build:

Dashboard
Vehicles
Spare Parts
Quotes
Orders
Customers
Payments
Tracking
Documents
Settings

Build reusable:
	•	Tables 
	•	Forms 
	•	Search 
	•	Pagination 
	•	Filters 
	•	Dialogs 
	•	Confirmation dialogs 
	•	Status badges 
	•	Toasts 
	•	Empty states 
	•	Error states 

PHASE 5 — VEHICLE INVENTORY
This is the first major vertical slice.
Stage 8 — Vehicle administration
Admin must be able to:
Add vehicle
	•	Make 
	•	Model 
	•	Year 
	•	Price 
	•	Mileage 
	•	Fuel 
	•	Transmission 
	•	Engine 
	•	Drive type 
	•	Exterior 
	•	Interior 
	•	Country of origin 
	•	Vehicle location 
	•	Availability 
	•	Description 
	•	Listing/reference number 
Edit
Modify appropriate vehicle information.
Archive
Prefer soft deletion/archiving where historical orders could be affected.
Status
For example:

Available
Reserved
Sold
In Transit
Delivered
Archived


Stage 9 — Vehicle media management
Use:
Supabase Storage
for initial image/document storage.
Implement:
	•	Multiple images 
	•	Primary image 
	•	Image ordering 
	•	Replace 
	•	Delete 
	•	File validation 
	•	File-size limits 
	•	Secure naming 
	•	Compression/resizing where appropriate 
	•	Thumbnail/optimized versions 
Vehicle media:
	•	Front 
	•	Rear 
	•	Side 
	•	Interior 
	•	Dashboard 
	•	Engine 
	•	Wheels 
	•	Damage 
	•	Auction documentation 
Design the media abstraction so that storage can later migrate to:
Cloudflare R2
without rewriting the vehicle system.

Validation gate
Enter genuine sample vehicles.
Test:

Admin
 ↓
Add vehicle
 ↓
Upload photos
 ↓
Save
 ↓
Edit
 ↓
Publish

The vehicle must appear correctly in the database and be retrievable through the application.

PHASE 6 — PUBLIC VEHICLE MARKETPLACE
Stage 10 — Cars catalogue
Create:
Cars
with database-driven vehicle cards.
Each card:
	•	Photo 
	•	Make/model 
	•	Year 
	•	Mileage 
	•	Engine 
	•	Transmission 
	•	Fuel 
	•	Price 
	•	Availability 
	•	Country 
	•	View Details 
No vehicle should be hard-coded into the frontend.

Stage 11 — Vehicle detail page
Include:
	•	Gallery 
	•	Specifications 
	•	Description 
	•	Price 
	•	Shipping estimate 
	•	Clearing/port estimate 
	•	Other charges 
	•	Estimated delivered price 
	•	Availability 
	•	Reference number 
Buttons:

REQUEST THIS VEHICLE
GET A QUOTE
WHATSAPP ABOUT THIS CAR

Clearly distinguish:
Estimated
from:
Confirmed
pricing.

Validation gate — Milestone 1
Complete:

Admin
 ↓
Creates vehicle
 ↓
Database
 ↓
Public Cars
 ↓
Customer opens vehicle
 ↓
Full vehicle experience


PHASE 7 — VEHICLE SEARCH
Stage 12 — Search and filtering
Implement:
	•	Make 
	•	Model 
	•	Year 
	•	Price 
	•	Mileage 
	•	Fuel 
	•	Transmission 
	•	Engine 
	•	Drive type 
	•	Vehicle location 
	•	Availability 
Support combinations.
Test:
	•	No filters 
	•	Single filter 
	•	Multiple filters 
	•	Invalid values 
	•	No results 
	•	Pagination 
	•	Mobile filtering 

PHASE 8 — WHATSAPP
Stage 13 — Contextual WhatsApp
Initially use WhatsApp click-to-chat, not the WhatsApp Business API.
Vehicle:

Hello Crownline Motors, I am interested in the Toyota Harrier 2021, listing reference CLM-XXXXX.

Spare part:

Hello Crownline Motors, I am interested in the Toyota Harrier brake pads, part number CLM-SP-XXXXX.

Order:

Hello Crownline Motors, I need assistance with order ORD-XXXXX.

Tracking:

Hello Crownline Motors, I need assistance with tracking number CLM-XXXXX.

The WhatsApp number should be configurable.
Do not hard-code it throughout the application.

PHASE 9 — SPARE-PARTS PLATFORM
The vehicle system has now been proven.
Now build the second inventory domain.
Stage 14 — Spare-parts administration
Admin can:
	•	Add part 
	•	Edit part 
	•	Archive/delete part 
	•	Upload images 
	•	Set part number 
	•	Set category 
	•	Set price 
	•	Set stock 
	•	Set availability 
	•	Add description 
	•	Add specifications 
	•	Publish/unpublish 
Categories should be database-driven.
Initial categories:
	•	Engine 
	•	Brakes 
	•	Suspension 
	•	Electrical 
	•	Body 
	•	Interior 
	•	Transmission 
	•	Cooling 
	•	Filters 
	•	Lighting 
	•	Wheels/tyres 
	•	Accessories 

Stage 15 — Spare-parts compatibility
Implement:

Spare Part
 ↓
Compatible Vehicles

Support:
	•	Make 
	•	Model 
	•	Year range 
	•	Engine 
	•	Notes 
Example:

Toyota Harrier Brake Pads

Toyota Harrier
2020–2023
2.0L

Do not assume a part belongs to only one vehicle.

Stage 16 — Public spare-parts catalogue
Create:
Spare Parts
Features:
	•	Search 
	•	Categories 
	•	Make/model filtering 
	•	Price filtering 
	•	Availability 
	•	Part number search 
Cards:
	•	Image 
	•	Part name 
	•	Part number 
	•	Compatibility 
	•	Price 
	•	Stock/availability 

Stage 17 — Spare-part detail
Include:
	•	Gallery 
	•	Part number 
	•	Description 
	•	Compatibility 
	•	Price 
	•	Stock 
	•	Quantity 
	•	Order/request button 
	•	WhatsApp 
Validation gate — Milestone 2

Admin
 ↓
Adds part
 ↓
Part becomes public
 ↓
Customer searches
 ↓
Customer checks compatibility
 ↓
Customer requests/orders


PHASE 10 — CUSTOMER AND QUOTATION SYSTEM
Stage 18 — Customer profiles
Create a centralized customer profile.
Store:
	•	Name 
	•	Phone 
	•	WhatsApp 
	•	Email 
	•	Country/city 
	•	Quotes 
	•	Orders 
	•	Payments 
	•	Relevant communication records 
Avoid unnecessary duplication.

Stage 19 — Vehicle quote requests
Implement:
Get a Quote
Fields:
	•	Name 
	•	Phone 
	•	WhatsApp 
	•	Email 
	•	Country/city 
	•	Make 
	•	Model 
	•	Year 
	•	Budget 
	•	Japan/Korea/Either 
	•	Fuel 
	•	Transmission 
	•	Requirements 
Admin:

Quotes
 ↓
View
 ↓
Review
 ↓
Internal notes
 ↓
Prepare response
 ↓
Update status


Stage 20 — Spare-parts quote requests
Not every spare part necessarily needs direct checkout.
Support two paths:
Standard part

Product
 ↓
Price
 ↓
Order

Special/imported part

Product/request
 ↓
Get Quote
 ↓
Admin quotation
 ↓
Customer accepts
 ↓
Order

This prevents the spare-parts system from assuming every product has a fixed immediate price.

PHASE 11 — ORDER ARCHITECTURE
Stage 21 — Unified order system
This is an important architectural stage.
Do not create an entirely independent payment/order architecture for vehicles and spare parts.
Use:

Customer
   ↓
Order
   ↓
Order Items
   ├── Vehicle
   └── Spare Part

But maintain product-specific workflows.

Vehicle order
Typical lifecycle:

Request/Quote
 ↓
Accepted
 ↓
Order Created
 ↓
Deposit Required
 ↓
Deposit Confirmed
 ↓
Vehicle Procurement
 ↓
Inspection
 ↓
Export
 ↓
Shipping
 ↓
Clearing
 ↓
Delivery


Spare-parts order

Order Created
 ↓
Payment
 ↓
Processing
 ↓
Packed
 ↓
Dispatched
 ↓
In Transit
 ↓
Delivered

The statuses must be modeled separately because a vehicle import and a spare-parts shipment are not operationally identical.

PHASE 12 — PAYMENTS
Stage 22 — Payment foundation
Initial payment methods:
	•	Bank transfer 
	•	Mobile money 
	•	Manual confirmation 
Do not build card processing yet.
Customer can submit:
	•	Amount 
	•	Method 
	•	Transaction reference 
	•	Payment date 
	•	Receipt 
	•	Notes 
Payment status:

Pending
Submitted
Under Verification
Confirmed
Rejected
Failed
Refunded

Payment Policy
Crownline Motors will use the following payment structure for customer vehicle orders:
	1.	50% Initial PaymentOnce a customer's vehicle order has been accepted and confirmed by Crownline Motors, the customer must pay 50% of the total agreed vehicle price. Shipment and procurement will proceed after this payment is received.
	2.	25% Mombasa PaymentWhen the vehicle arrives at Mombasa, the customer must pay a further 25% of the total agreed price.
	3.	25% Final PaymentThe remaining 25% must be paid before the vehicle is released and handed over to the customer.
The customer must therefore have paid the full 100% of the agreed vehicle price before final handover.
The system should clearly show the customer the payment stages, amounts paid, remaining balance, and the payment milestone that is currently due. And clearly calculate the amounts due in each stage for easy interpretation by the customer 

Stage 23 — Payment verification
Admin:

Payments
 ↓
Pending
 ↓
Review
 ↓
Confirm / Reject

Maintain an audit trail.

Stage 24 — Partial payments
Support:

Order total: $22,000

Deposit: $5,000
Balance: $17,000

Then:

Payment 1 → Confirmed
Payment 2 → Confirmed
Payment 3 → Confirmed

The order should calculate its financial state from actual payment records rather than relying on a manually edited "paid" field.

Future payment architecture
The payment model should eventually support:

Order
 ↓
Payment
 ↓
External Provider
 ↓
Webhook
 ↓
Verified Payment
 ↓
Order Status Update

When online payment providers are introduced, use provider-hosted/tokenized payment mechanisms.
Never store raw card details.

PHASE 13 — CUSTOMER TRACKING
Stage 28 — Track My Order
The customer-facing page should be:
TRACK MY ORDER
rather than creating completely separate systems.
Customer enters:

CLM-2026-000125

The system determines what type of shipment it represents.
Vehicle
Shows:
	•	Vehicle 
	•	Tracking reference 
	•	Current status 
	•	Timeline 
	•	Dates 
	•	Locations 
	•	Notes 
Spare part
Shows:
	•	Order/part information 
	•	Current status 
	•	Timeline 
	•	Delivery information 

Security
Tracking references should not expose unnecessary private customer information.
Once customer accounts are implemented, authenticated customers should see their complete private order information only after authorization.


PHASE 14 — VEHICLE TRACKING
Stage 25 — Shipment and tracking foundation
Create a shipment/tracking record after the relevant vehicle order reaches the appropriate operational stage.
Generate a unique human-readable reference:

CLM-2026-000125

The tracking reference should be system-generated.

Stage 26 — Vehicle tracking lifecycle
Vehicle:

Vehicle Purchased
 ↓
Inspection Completed
 ↓
Export Documentation
 ↓
Vehicle Exported
 ↓
Loaded for Shipping
 ↓
In Transit
 ↓
Arrived at Mombasa
 ↓
Clearing
 ↓
Transport to South Sudan
 ↓
Ready for Collection
 ↓
Delivered

Each event:
	•	Status 
	•	Date 
	•	Location 
	•	Notes 
	•	Created timestamp 
	•	Updated timestamp 
Admin controls the operational updates.

PHASE 15 — SPARE-PARTS TRACKING
Stage 27 — Shared shipment infrastructure
Reuse the shipment/tracking architecture.
Spare-parts lifecycle:

Order Confirmed
 ↓
Processing
 ↓
Packed
 ↓
Dispatched
 ↓
In Transit
 ↓
Out for Delivery
 ↓
Delivered

The tracking system identifies:

Vehicle shipment
OR
Spare-part shipment

and displays the appropriate timeline.
PHASE 16 — HOMEPAGE AND INFORMATIONAL PAGES
Stage 32 — Complete public pages
Build:
Home
Hero:
CROWNLINE MOTORS
Quality Cars. Global Standards. Local Commitment.
Supporting text:
Quality vehicles sourced from Japan and Korea and delivered to South Sudan.
CTAs:

VIEW AVAILABLE CARS
TRACK MY ORDER


How It Works
Vehicle timeline:

Choose
 ↓
Reserve
 ↓
Inspection
 ↓
Export
 ↓
Shipping
 ↓
Clearing
 ↓
Transport
 ↓
Delivery

Include the spare-parts purchasing/fulfillment process once that module is active.

About Us
Professional company presentation.

Contact
Include:
	•	Phone 
	•	WhatsApp 
	•	Email 
	•	Location 
	•	Hours 
	•	Social links 
	•	Contact form 
	•	Map where appropriate 


PHASE 17 — CUSTOMER ACCOUNTS
Stage 29 — Customer dashboard
Build:

My Dashboard

My Vehicles
My Orders
My Quotes
My Payments
My Documents
My Tracking
Messages/Updates

For spare parts:

My Part Orders

Customer must only access their own records.


PHASE 18 — MOBILE AND UX
Stage 33 — Responsive optimization
Test every important workflow on:
	•	Android 
	•	iPhone 
	•	Tablet 
	•	Desktop 
Priority:
	1.	Vehicle browsing 
	2.	Vehicle photos 
	3.	Search/filter 
	4.	Quote form 
	5.	WhatsApp 
	6.	Tracking 
	7.	Spare-parts catalogue 
	8.	Part ordering 
	9.	Customer dashboard 
	10.	Admin dashboard 

PHASE 19 — SEO
Stage 34 — Technical SEO
Implement:
	•	Metadata 
	•	Page titles 
	•	Descriptions 
	•	Canonical URLs 
	•	Sitemap 
	•	Robots.txt 
	•	Structured data 
	•	Open Graph 
	•	Clean URLs 
	•	Semantic HTML 
	•	Proper heading hierarchy 
Vehicle pages should be individually indexable.
Spare-part pages should eventually be individually indexable.
Target:

Cars for sale in South Sudan
Imported cars South Sudan
Japan cars South Sudan
Japan car imports Juba
Korea cars South Sudan
Toyota South Sudan
Used cars Juba
Toyota spare parts South Sudan
Toyota parts Juba


PHASE 20 — PERFORMANCE
Stage 35 — Performance optimization
Optimize for slower mobile connections.
Implement:
	•	Next.js image optimization 
	•	Lazy loading 
	•	Responsive images 
	•	Appropriate image formats 
	•	Pagination 
	•	Efficient Prisma queries 
	•	Database indexes 
	•	Caching where justified 
	•	Minimal JavaScript 
	•	Optimized fonts 
	•	Fast page rendering 
Do not prematurely introduce Redis.
The architecture should remain compatible with:
Upstash Redis + QStash
in Phase 2 when caching/background jobs genuinely become necessary.

PHASE 21 — SECURITY HARDENING
Stage 36 — Security audit
Test:
	•	Supabase authentication 
	•	Authorization 
	•	Admin access 
	•	Customer isolation 
	•	CSRF-related protections where applicable 
	•	XSS 
	•	SQL injection 
	•	File uploads 
	•	Session security 
	•	Secrets 
	•	API/server actions 
	•	Input validation 
	•	Rate limiting where appropriate 
	•	Payment security 
	•	Storage permissions 
All incoming data should be validated with:
Zod
Do not rely solely on client-side validation.
Server-side validation is mandatory.

PHASE 22 — TESTING
Stage 37 — Unit and integration testing
Use:
Vitest
Test:
	•	Pricing calculations 
	•	Payment calculations 
	•	Order status transitions 
	•	Tracking transitions 
	•	Validation schemas 
	•	Compatibility logic 
	•	Search/filter logic 
	•	Reference-number generation 
	•	Authorization logic 

Stage 38 — End-to-end testing
Use:
Playwright
Test the real browser experience.
Vehicle

Admin login
 ↓
Create vehicle
 ↓
Upload images
 ↓
Publish
 ↓
Customer opens Cars
 ↓
Filters
 ↓
Opens vehicle
 ↓
Requests vehicle
 ↓
Admin sees request
 ↓
Order created
 ↓
Payment submitted
 ↓
Payment verified
 ↓
Tracking created
 ↓
Tracking updated
 ↓
Customer tracks vehicle

Spare parts

Admin creates part
 ↓
Customer searches
 ↓
Views compatibility
 ↓
Orders part
 ↓
Payment
 ↓
Admin processes
 ↓
Shipment created
 ↓
Tracking updated
 ↓
Customer tracks


PHASE 23 — OBSERVABILITY
Stage 39 — Sentry
Integrate:
Sentry
for production error monitoring.
Track:
	•	Server errors 
	•	Client errors 
	•	Failed requests 
	•	Important exceptions 
	•	Performance issues where appropriate 
Do not expose sensitive customer/payment information in error reports.

PHASE 24 — CI/CD
Stage 40 — GitHub Actions
Create automated checks for pull requests:

GitHub
 ↓
Push / Pull Request
 ↓
Install dependencies
 ↓
TypeScript check
 ↓
Lint
 ↓
Vitest
 ↓
Build

Later include:

Playwright

where the CI environment supports it reliably.

PHASE 25 — PRODUCTION DEPLOYMENT
Stage 41 — Vercel deployment
Deploy Next.js through:
Vercel
Production environment:

GitHub
 ↓
GitHub Actions
 ↓
Validation
 ↓
Vercel
 ↓
Production

Configure:
	•	Production environment variables 
	•	Preview environments 
	•	Domain 
	•	HTTPS 
	•	Build configuration 
	•	Deployment settings 

PHASE 26 — CLOUDFLARE
Stage 42 — DNS/CDN/WAF
Use:
Cloudflare
for:
	•	DNS 
	•	CDN where appropriate 
	•	WAF 
	•	Security controls 
	•	Domain-level protection 
Do not unnecessarily introduce Cloudflare R2 during initial development.
Start with:
Supabase Storage
and migrate/expand to:
Cloudflare R2
when scale, cost, or storage architecture justifies it.
This avoids forcing additional infrastructure costs into the early development process.

PHASE 27 — BACKUPS AND RECOVERY
Stage 43 — Production resilience
Establish:
	•	Database backup strategy 
	•	Storage backup considerations 
	•	Recovery procedure 
	•	Environment recovery procedure 
	•	Git repository recovery 
	•	Admin account recovery 
Before launch, you should be able to answer:
"If the production database fails tomorrow, how do we recover Crownline Motors?"

PHASE 28 — FINAL ACCEPTANCE TEST
Stage 44 — Business acceptance
Test the complete platform from the perspective of:
Customer

Home
 ↓
Cars
 ↓
Search
 ↓
Vehicle
 ↓
Quote / Request
 ↓
Order
 ↓
Payment
 ↓
Tracking
 ↓
Delivery

Spare-parts customer

Spare Parts
 ↓
Search
 ↓
Compatibility
 ↓
Product
 ↓
Order / Quote
 ↓
Payment
 ↓
Shipment
 ↓
Tracking
 ↓
Delivery

Administrator

Login
 ↓
Dashboard
 ↓
Inventory
 ↓
Quotes
 ↓
Orders
 ↓
Payments
 ↓
Tracking
 ↓
Customers


PHASE 29 — PRODUCTION LAUNCH
Stage 45 — Launch checklist
Before launch:
Application
	•	Production build passes 
	•	No critical errors 
	•	All core workflows tested 
	•	Mobile tested 
	•	Forms tested 
	•	Tracking tested 
	•	Payments tested 
	•	Admin permissions tested 
Database
	•	Production database configured 
	•	Migrations verified 
	•	Indexes verified 
	•	Backups configured 
Security
	•	Secrets secured 
	•	HTTPS active 
	•	Storage policies verified 
	•	Authentication verified 
	•	Authorization verified 
Infrastructure
	•	Vercel configured 
	•	Supabase configured 
	•	Cloudflare configured 
	•	Domain connected 
	•	Sentry active 
	•	GitHub Actions active 
Business
	•	Real vehicles entered 
	•	Contact information verified 
	•	WhatsApp number verified 
	•	Payment instructions verified 
	•	Tracking workflow understood by staff 
	•	Admin trained 

PHASE 30 — HANDOVER
Stage 46 — Final handover
Provide:
	•	Source repository 
	•	GitHub access 
	•	Vercel access 
	•	Supabase access 
	•	Cloudflare access 
	•	Sentry accesss
	•	Domain information 
	•	Environment-variable documentation 
	•	Admin URL 
	•	Admin credentials 
	•	Backup procedure 
	•	Deployment procedure 
	•	Database migration procedure 
	•	Admin user guide 

FINAL DEVELOPMENT MILESTONES
Rather than thinking about this as dozens of disconnected stages, I would manage the project around these major milestones:
MILESTONE 0 — Foundation

Next.js
+
TypeScript
+
Supabase
+
Prisma
+
GitHub
+
Testing

↓
MILESTONE 1 — Vehicle Marketplace

Admin
 ↓
Vehicle inventory
 ↓
Photos
 ↓
Public catalogue
 ↓
Vehicle details
 ↓
Search/filter
 ↓
WhatsApp

↓
MILESTONE 2 — Spare Parts

Spare-part inventory
 ↓
Categories
 ↓
Compatibility
 ↓
Catalogue
 ↓
Product pages
 ↓
WhatsApp

↓
MILESTONE 3 — Commercial Engine

Customers
 ↓
Quotes
 ↓
Orders
 ↓
Payments

↓
MILESTONE 4 — Logistics

Orders
 ↓
Shipments
 ↓
Tracking
 ↓
Customer tracking

↓
MILESTONE 5 — Customer Platform

Accounts
 ↓
Orders
 ↓
Payments
 ↓
Documents
 ↓
Tracking

↓
MILESTONE 6 — Production

Security
 ↓
SEO
 ↓
Performance
 ↓
Testing
 ↓
Sentry
 ↓
CI/CD
 ↓
Vercel
 ↓
Cloudflare
 ↓
Launch


THE TARGET ARCHITECTURE
The resulting system should conceptually look like this:

                         CROWNLINE MOTORS
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
          VEHICLES          SPARE PARTS         CUSTOMERS
             │                  │                  │
             │                  │                  │
             └──────────────┬───┴──────────────────┘
                            │
                       QUOTES / ORDERS
                            │
                     ┌──────┴──────┐
                     │             │
                  PAYMENTS      DOCUMENTS
                     │
                     │
                  SHIPMENTS
                     │
                ┌────┴─────┐
                │          │
             VEHICLE    SPARE PART
             TRACKING   TRACKING
                │          │
                └────┬─────┘
                     │
                CUSTOMER
                TRACKING

And technically:

                         USERS
                           │
                      Supabase Auth
                           │
                           ▼
                     Next.js / React
                           │
             ┌─────────────┴─────────────┐
             │                           │
       Server Actions              API Routes
             │                           │
             └─────────────┬─────────────┘
                           │
                          Zod
                           │
                         Prisma
                           │
                      PostgreSQL
                       (Supabase)
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
      Supabase          Supabase          Future
      Storage           Services          Services
          │
          │
       Images/
       Documents

External infrastructure:

Cloudflare
    │
    └── DNS / CDN / WAF

Vercel
    │
    └── Next.js hosting

Sentry
    │
    └── Monitoring

GitHub
    │
    └── Source + CI/CD

Future:

Upstash Redis
QStash
Cloudflare R2
OpenAPI
Payment providers
WhatsApp Business APIs



The critical boundary

Wave A is not a prototype.

It is the complete first production version of Crownline Motors, specifically for the vehicle-import business.

It must be capable of operating the real workflow:

Vehicle discovery → enquiry → quote → order → deposit/payment → import → tracking → delivery.

Wave B is an expansion of that production system, not a completion of an unfinished Wave A.

The critical boundary

Wave A is not a prototype.

It is the complete first production version of Crownline Motors, specifically for the vehicle-import business.

It must be capable of operating the real workflow:

Vehicle discovery → enquiry → quote → order → deposit/payment → import → tracking → delivery.

Wave B is an expansion of that production system, not a completion of an unfinished Wave A.



## WEBSITE DESIGN PHILOSOPHY
The target should be:
Premium automotive + modern dealership + restrained luxury + excellent usability + African/East African commercial practicality.
Not:
	•	a flashy luxury template 
	•	a generic Tailwind/shadcn website 
	•	an AI-generated landing page 
	•	a car marketplace cluttered with specifications 
	•	an animation showcase 
	•	an overly black/gold "luxury" website 
The website should feel as though a professional automotive company commissioned a serious digital agency to build it.

1. Design philosophy
I would define the Crownline design principles as:
1. Photography first
Large, high-quality vehicle photography should carry much of the visual weight.
Porsche is the strongest reference here. Its current site uses vehicle imagery as a major part of the experience rather than surrounding the cars with excessive UI. 
For Crownline:
Image → vehicle identity → concise information → action
rather than:
Image → 15 badges → 12 specifications → 5 colours → several buttons

2. Motion with purpose
This is one of the most important things you said.
We should have animation, but the user should rarely think:
"That website has lots of animations."
They should think:
"This website feels smooth."
That distinction matters.
Porsche's own design-system guidance is an excellent benchmark: short transitions around 0.25s for interaction/hover, around 0.4s for things such as carousels and modal transitions, and longer durations only where deliberate movement is appropriate. 
So Crownline should use:
	•	fade/slide page entrances 
	•	subtle image scaling 
	•	button hover transitions 
	•	navigation transitions 
	•	card image zoom 
	•	gallery transitions 
	•	smooth mobile menu 
	•	section reveal on scroll 
	•	subtle loading transitions 
	•	smooth filtering 
	•	polished modal/sheet transitions 
But avoid:
	•	constantly floating elements 
	•	excessive parallax 
	•	spinning cars 
	•	giant text animations 
	•	bouncing buttons 
	•	animated backgrounds everywhere 
	•	excessive 3D 
	•	animation on every scroll event 
Motion should communicate hierarchy and interaction, not demonstrate that we know how to animate CSS.

2. Colour system
This is where I would make an important refinement to the original brief.
The brief says black + gold + white, which is correct. 
But I would not use them in equal proportions.
Crownline palette
Primary — Deep Black
Used for:
	•	header 
	•	footer 
	•	hero sections 
	•	major CTA areas 
	•	dark information sections 
Secondary — Warm White
Used for:
	•	main page background 
	•	catalogue 
	•	vehicle details 
	•	forms 
	•	content sections 
Accent — Champagne/Metallic Gold
Used sparingly for:
	•	Crownline branding 
	•	active navigation state 
	•	small separators 
	•	selected states 
	•	important accents 
	•	occasional CTA 
	•	icons/highlights 
Supporting neutrals
We should have several sophisticated neutral shades:
	•	charcoal 
	•	dark grey 
	•	medium grey 
	•	soft grey 
	•	light grey 
This prevents the site from becoming a three-colour cartoon.
Approximate visual ratio
I'd aim around:
65% white/light neutral25% black/dark surfaces10% gold + other accents
And even that 10% gold should be used carefully.
The gold should communicate:
Crownline
not:
LOOK, WE HAVE GOLD.

3. Typography
This needs to be extremely disciplined.
I recommend:
Headings
A sophisticated modern sans-serif with strong geometric proportions.
Potential direction:
Manrope / Inter / Geist / similar
rather than an ornamental luxury font.
Body
Highly readable modern sans-serif.
Inter is perfectly acceptable.
The important thing is that we establish:
Display → H1 → H2 → H3 → body → small text → metadata
and don't let Claude randomly choose font sizes throughout the site.
Typography principle
Large headings.
Short paragraphs.
Strong hierarchy.
Plenty of breathing room.
For example:
QUALITY CARS.GLOBAL STANDARDS.
then a short supporting statement.
Not:
Welcome to Crownline Motors, your trusted premium automotive dealership and international vehicle importing partner...
That sort of copy immediately makes the website feel generic.

4. Header
This should borrow heavily from Clip Logistics + Al-Malik + Porsche.
Desktop:

┌──────────────────────────────────────────────────────────────┐
│ CROWNLINE     Home Cars Spare Parts How It Works ...         │
│                                              GET A QUOTE     │
└──────────────────────────────────────────────────────────────┘

I would make the header:
	•	relatively compact 
	•	clean 
	•	sticky 
	•	slightly translucent/solid depending on section 
	•	strong typography 
	•	minimal icons 
	•	one prominent CTA 
Header behaviour
On the hero:
transparent/dark variant
As the user scrolls:
solid/light or solid-dark variant
with a subtle transition.
No giant header.

5. Mobile navigation
Your requirement here is correct.
Use a proper:
☰ hamburger
On mobile:

CROWNLINE                         ☰

Tap:

┌──────────────────────────┐
│ CROWNLINE                X│
│                          │
│ HOME                     │
│ CARS                     │
│ SPARE PARTS              │
│ HOW IT WORKS             │
│ TRACK MY ORDER           │
│ GET A QUOTE               │
│ ABOUT US                 │
│ CONTACT                  │
│                          │
│ ───────────────────────  │
│ WHATSAPP US              │
└──────────────────────────┘

The menu should slide/fade elegantly, not simply appear as an ugly browser-like dropdown.
This is particularly important because the brief identifies mobile browsing, filtering, WhatsApp, quoting and tracking as priority workflows. 

6. Homepage
This should be very visual.
I would use something closer to:

FULL-WIDTH HERO IMAGE / VIDEO

             CROWNLINE MOTORS

       QUALITY CARS.
       GLOBAL STANDARDS.

Quality vehicles sourced from Japan and Korea
and delivered to South Sudan.

[ VIEW CARS ]    [ TRACK MY ORDER ]

Then transition naturally into:
Featured Vehicles
Large, clean vehicle cards.
Then:
Why Crownline
Three or four trust propositions.
Then:
How It Works
A beautiful visual journey:
Choose → Reserve → Inspect → Export → Ship → Clear → Deliver
Then:
Request a Vehicle
For customers who don't find what they want.
Then:
About Crownline / Trust
Then:
Contact / WhatsApp
Then footer.
This is much more coherent than stuffing every business feature onto the homepage.

7. Vehicle cards
This is where your Clip Logistics criticism should become an explicit design rule.
Clip's current inventory exposes a lot of information directly on cards—year, mileage, engine, transmission, fuel, drive, location, multiple pricing figures and deposit information. 
That is useful commercially but visually noisy.
Crownline card
I would keep it approximately:

┌───────────────────────────────┐
│                               │
│          VEHICLE IMAGE        │
│                               │
│                         ●     │
├───────────────────────────────┤
│ Toyota Harrier                │
│ 2021                          │
│                               │
│ 42,000 km    Automatic        │
│ Petrol       2.0L             │
│                               │
│ $22,500                       │
│                               │
│ VIEW DETAILS        →         │
└───────────────────────────────┘

That's enough.
Not 15 specifications.
The card's job is:
Make me interested enough to open the vehicle.
The vehicle page's job is:
Give me everything I need to make a decision.

8. Card hover
Exactly as you requested.
No complicated animation.
Desktop:
Image gently scales ~1.03–1.1
Card rises 2–4px
Shadow subtly increases
CTA/arrow shifts slightly
Maybe a very subtle dark overlay.
That's it.
Something like:

Normal
     ↓
hover
     ↓
image +3% scale
card +2px elevation
arrow → moves slightly

Duration:
~250–350ms
That aligns nicely with the type of purposeful interaction Porsche recommends. 

9. Vehicle detail page
This should be one of the strongest pages on the entire website.
I would take inspiration from Porsche/Lexus for the visual presentation, but adapt it to a used/imported vehicle.
Top:

Toyota Harrier
2021

[ LARGE IMAGE GALLERY ]

$22,500

Available
CLM-2026-00125

[ REQUEST THIS VEHICLE ]
[ WHATSAPP ]

Then:
Key specifications
Clean grid:
Year
Mileage
2021
42,000 km
Engine
Transmission
2.0L
Automatic
etc.
Then:
Vehicle description
Then:
Gallery
Then:
Pricing / import estimate
Then:
How the import works
Then:
Request this vehicle
This page should feel almost editorial.

10. Buttons
SAMI's button positioning is a good reference, but Crownline should establish its own hierarchy.
Primary
Gold or black filled button
Example:
VIEW CARS
Secondary
White/outlined or dark outlined:
GET A QUOTE
Tertiary
Text + arrow:
EXPLORE VEHICLE →
WhatsApp
Use the recognizable WhatsApp treatment where appropriate, but don't turn every page into a green WhatsApp interface.
The CTA hierarchy should always be obvious.

11. Page transitions
This is one area where Al-Malik's approach is useful.
We should have a coherent transition language.
For example:
Page navigation:
old page fades out → new page enters smoothly
Section:
content slightly translates upward + fades in
Image:
slight scale/reveal
But the transitions should be fast enough that the website never feels slower than it actually is.
distinct pages for different actions
Later on when the user presses a the cars sections, its a distinct page that shows up a opens a car catalog, same for other sections in that sense.

12. How It Works
This could become one of Crownline's signature pages.
Al-Malik does a good job making the import process explicit; its current site explains the journey from Japan through Mombasa and onward to local delivery. 
Crownline should take that concept further:

01
CHOOSE
     ↓
02
RESERVE
     ↓
03
INSPECT
     ↓
04
EXPORT
     ↓
05
SHIP
     ↓
06
CLEAR
     ↓
07
TRANSPORT
     ↓
08
DELIVER

Large photography.
Short text.
Animated progress line.
Map/location cues where useful.
This is particularly valuable because trust is one of the central problems Crownline's website needs to solve.

13. Trust design
This is where Crownline should differ from simply making a pretty website.
A customer potentially sending thousands of dollars to import a vehicle needs evidence of legitimacy.
So design should deliberately communicate:
Transparency
Process
Documentation
Real vehicles
Real people
Real contact information
Tracking
Payment records
Clear pricing
Professional company information
The brief already gives us the infrastructure to support this: orders, payments, documents, tracking, customer accounts and audit trails. 
The website should visually expose enough of that infrastructure to create confidence without overwhelming customers.

14. Photography standard
This should be a formal rule.
Vehicle photography
Every vehicle should have:
	•	consistent aspect ratio 
	•	high resolution 
	•	clean cropping 
	•	consistent visual treatment 
	•	optimized file sizes 
No random mixture of:
	•	portrait image 
	•	landscape image 
	•	blurry auction screenshot 
	•	tiny WhatsApp photo 
	•	giant uncompressed image 
The CMS should help enforce this.
And the homepage should use real Crownline vehicle imagery once available, not generic AI-generated cars.
That will make a major difference to whether the website feels authentic.

OTHER ISSUES TO ALSO ADDRESS
Color Palette & Metallic Gold Tuning
	•	Define a Metallic Gold Palette: Replace default amber or dull yellow color tokens with a calibrated champagne gold scheme that maintains high contrast against dark backgrounds.
	•	Establish Dark Surface Hierarchy: Set up three distinct dark neutral shades—a pure deep black for main section backgrounds, a slightly lighter surface black for section blocks, and an elevated dark neutral for cards and containers.
	•	Add Subtle Radial Lighting: Apply soft, low-opacity gold ambient lighting glows behind high-priority Call-to-Action (CTA) blocks to bring warm highlights to dark areas without adding visual noise.
2. Button Affordance & Card Separation
	•	Enforce Button Geometry: Apply distinct rounded corners (6px to 8px border radius) specifically to buttons so their shapes contrast sharply against rectangular vehicle cards.
	•	Differentiate Primary CTAs: Style primary buttons with solid, vibrant gold fills, bold dark text, and subtle drop shadows, ensuring they instantly register as clickable elements rather than static information badges.
	•	Establish Header Hierarchy: Reserve solid gold fills in the navigation bar exclusively for the single highest-priority button ("GET A QUOTE"). Render secondary actions ("TRACK MY ORDER") as ghost buttons with thin, subtle borders.
3. Card Hover & Micro-Interaction Calibration
	•	Build Multi-Layered Elevation: Program vehicle cards to rise slightly (2px to 4px), deepen their shadow, and brighten their border outline over a fast, smooth 300-millisecond transition when hovered.
	•	Implement Internal Image Zoom: Wrap vehicle photos in cropped containers so that hovering over a card scales the image up by 3% to 5% internally without shifting surrounding layout elements.
	•	Add Subtle Arrow Motion: Link CTA text and directional arrows inside cards to shift slightly rightward on hover, giving clear visual feedback that the card is interactive.
4. Persistent Scroll Animation Architecture
	•	Lock Reveal States: Configure all scroll-triggered entrance animations to execute exactly once per session when the user scrolls an element into view.
	•	Prevent Mid-Scroll Fading: Ensure elements lock at 100% opacity once revealed so content never fades back out, disappears, or re-animates when users scroll back up or down.
	•	Standardize Motion Timing: Restrict overall transition durations to 0.25 seconds for micro-interactions and 0.4 seconds for section reveals to keep the experience feeling fast and deliberate.
5. Media & Real Vehicle Photography
	•	Eliminate Vector Line Art: Replace all line-art placeholders and vector icons in car slots with real, high-resolution automotive photos.
	•	Enforce Fixed Aspect Ratios: Lock all card image containers to a strict 16:9 ratio to keep photo alignment uniform across desktop, tablet, and mobile grid layouts.
	•	Implement Responsive Loading Stages: Configure image components to serve scaled-down web formats for lower-bandwidth mobile networks, showing lightweight blurred placeholders until full-resolution photos render.


15. Performance
This must be designed in from day one.
The website should feel:
heavy visually, light technically.
Meaning:
Large images visually
but:
optimized WebP/AVIF, responsive sizes, lazy loading, correct sizes, minimal JS.
The existing Crownline brief already calls for Next.js image optimization, lazy loading, responsive images, pagination and efficient Prisma queries. 
Animation must also respect performance.
Especially on:
	•	lower-end Android 
	•	mobile data 
	•	slower connections 
If an animation causes a noticeable delay, remove the animation.

16. The "AI-generated website" test
I would make this an explicit acceptance criterion.
Before a page is approved, ask:
Does it have...
	•	predictable generic hero? 
	•	generic stock/AI imagery? 
	•	inconsistent spacing? 
	•	buttons everywhere? 
	•	generic shadcn appearance? 
If yes → redesign.
Instead:
	•	strong composition 
	•	restrained colour 
	•	intentional whitespace 
	•	excellent imagery 
	•	clear hierarchy 
	•	consistent spacing 
	•	subtle motion 
	•	useful information 
	•	obvious navigation 
	•	real business content 
	•	modern, professional and most importantly trust worthy
	•	production ready features
That is what will make it feel designed, rather than generated.

17. Design system we should actually build
So Stage 3 should produce a formal system roughly like:
Brand
	•	Crownline logo 
	•	black 
	•	warm white 
	•	champagne gold 
	•	neutral palette 
Typography
	•	display 
	•	H1 
	•	H2 
	•	H3 
	•	body 
	•	small 
	•	metadata 
Layout
	•	max-width container 
	•	page gutters 
	•	section spacing 
	•	grid system 
	•	responsive breakpoints 
Components
	•	Header 
	•	Mobile menu 
	•	Buttons 
	•	Links 
	•	Vehicle cards 
	•	Image galleries 
	•	Badges 
	•	Inputs 
	•	Selects 
	•	Search 
	•	Filters 
	•	Dialogs 
	•	Sheets 
	•	Tables 
	•	Breadcrumbs 
	•	Alerts 
	•	Toasts 
	•	Skeletons 
	•	Empty states 
	•	Error states 
Motion
	•	hover 
	•	page transition 
	•	section reveal 
	•	image reveal 
	•	menu 
	•	modal 
	•	gallery 
	•	loading 
Responsive rules
	•	desktop 
	•	tablet 
	•	mobile 

18. The implementation sequence I recommend
I would not tell Claude:
"Build Stage 3 and Stage 4."
That's too broad.
Instead:
Design pass 1
Build the Crownline design system only.
No actual business pages.
Validate:
	•	typography 
	•	colours 
	•	spacing 
	•	buttons 
	•	cards 
	•	inputs 
	•	navigation 
	•	motion 
↓
Design pass 2
Build:
Header + homepage shell + footer
↓
Design pass 3
Build:
How it works page with proper contents, 
Tracking my order page,
Get a quote page with all contents
About us page with random data that I will replace later,
Contact page.

↓
Design pass 4
Build:
Cars catalog section but should be empty now, just the page.
↓
Design pass 5
Build:
Spare parts page but empty for now
↓
Design pass 5
Build:
Mobile versions
↓
Review
Build 
↓
Lock design system
Only then proceed 

The final design formula
I would now lock this in as the Crownline design brief:
Porsche → photography, visual restraint, purposeful motionSAMI Motors → spacing, CTA positioning, dealership usabilityAl-Malik Group → page composition, transitions, vehicle presentation, responsive structureClip Logistics → header, import-focused CTA structure, photography and motionCrownline → combine these into a distinctive, restrained black/white/champagne-gold automotive identity
And there is one particularly important lesson from the four dealership sites:
Do not copy their information density.
SAMI emphasizes a relatively straightforward vehicle collection and dealership journey. Al-Malik combines inventory with import/clearing services. Clip goes considerably further into pricing, deposits, sourcing markets, import costs and logistics. 
Crownline has more underlying functionality than all of them need to expose on the front end because our platform includes orders, payments, documents, tracking, customer accounts and eventually spare parts. 




## DATABASE STRUCTURE

# Crownline Motors — Database Schema Documentation

**Wave A (Business Phase 1 — Vehicle Dealership)**
**Stack:** PostgreSQL (Supabase) · Prisma 7 with `@prisma/adapter-pg`
**Status:** Live — migrated to Supabase

---

## 1. Purpose and Scope

This document describes the production database schema for Crownline Motors' vehicle-import platform. It is written for any developer who needs to write queries, server actions, or migrations against this schema without re-deriving the business rules from scratch.

The schema covers **Wave A only** — the vehicle dealership business. It is deliberately structured so that **Wave B** (spare parts, customer accounts, documents, notifications) can extend it additively, without rebuilding any Wave A table. Anywhere this matters, it's called out explicitly below.

**Non-negotiable rules that apply across the entire schema:**

- All money fields are `Decimal(12, 2)`. Never `Float` — floating-point rounding errors are unacceptable for financial data.
- Nothing in this system is truly "deleted" if it has ever touched money, an order, or a customer. Deletion is handled by status transitions, soft-delete flags, or void mechanisms — never a hard `DELETE` from the admin UI.
- Every reference number (vehicle listings, quotes, orders, tracking numbers) is generated through an atomic counter table, never `COUNT(*) + 1`, to avoid race conditions when two admins act concurrently.
- Aggregated financial totals (amount paid, balance) are **calculated live from the payment ledger**, never stored as a field that could drift out of sync with reality.

---

## 2. Entity Overview

```
AdminProfile ──┬── AuditLog
               ├── Payment (verifiedByAdminId)
               └── TrackingEvent (createdByAdminId / voidedByAdminId)

Vehicle ──┬── VehiclePhoto
          ├── Quote (linkedVehicleId, optional)
          ├── OrderItem (vehicleId)
          └── Shipment (vehicleId)

Customer ──┬── Quote
           └── Order

Quote ── Order (1:1, created only when a Quote is accepted)

Order ──┬── OrderItem
        ├── PaymentMilestone ──── Payment
        └── Shipment ──── TrackingEvent

BusinessSettings (singleton — configurable defaults)
ReferenceSequence (atomic counters, one row per sequence key)
```

---

## 3. Reference Number Strategy

Four independent sequences, each backed by the `ReferenceSequence` counter table, reset per calendar year:

| Entity | Format | Example |
|---|---|---|
| Vehicle listing | `CLM-V-YYYY-######` | `CLM-V-2026-000123` |
| Quote | `CLM-Q-YYYY-######` | `CLM-Q-2026-000045` |
| Order | `CLM-O-YYYY-######` | `CLM-O-2026-000012` |
| Shipment tracking | `CLM-YYYY-######` | `CLM-2026-000125` |

**Why separate sequences:** a vehicle can be listed long before it's ordered, and one listing could theoretically be relisted — coupling listing and order numbers would create ambiguity. The tracking number intentionally has no letter after `CLM-` because it's the one number a customer types into "Track My Order" and should match the brief's literal example format exactly.

**Why a counter table, not `COUNT(*) + 1`:**

```prisma
model ReferenceSequence {
  id          Int    @id @default(autoincrement())
  sequenceKey String @unique // e.g. "VEHICLE-2026", "ORDER-2026", "QUOTE-2026", "TRACKING-2026"
  lastValue   Int    @default(0)
}
```

Generation must be a single atomic `UPDATE ... SET "lastValue" = "lastValue" + 1 WHERE "sequenceKey" = $1 RETURNING "lastValue"`, run inside a transaction alongside the row creation it's generating a number for. Never read-then-write in two steps — that reintroduces the race condition this table exists to prevent.

---

## 4. Admin & Audit Layer

### `AdminProfile`

Mirrors a Supabase `auth.users` row by primary key (the Supabase UID), but lives in our own schema so we can attach real foreign keys to it — Prisma cannot model Supabase's `auth` schema directly.

| Field | Notes |
|---|---|
| `id` | Supabase auth UID. No `@default` — set explicitly on first login. |
| `email` | Unique. |
| `displayName` | For UI display ("Verified by John"). |
| `role` | Enum: `SUPER_ADMIN`, `MANAGER`, `STAFF`. RBAC enforcement is application logic; this column just carries the data. |
| `isActive` | **Admins are deactivated, never deleted.** All FKs to this table use `Restrict` for this reason. |

### `AuditLog`

General-purpose forensic trail for administrative actions that don't have a dedicated "who did this" column of their own (e.g. vehicle price changes, order cancellations).

| Field | Notes |
|---|---|
| `actorId` | FK to `AdminProfile`, `Restrict`. |
| `action` | Free-text action code, e.g. `"PAYMENT_CONFIRMED"`, `"VEHICLE_PUBLISHED"`. |
| `entityType` / `entityId` | What was acted on. No FK — deliberately polymorphic since this table spans every entity type. |
| `metadata` | `Json?` — e.g. `{ "previousStatus": "...", "newStatus": "..." }`. |

This is **not redundant** with `Payment.verifiedByAdminId` or `TrackingEvent.createdByAdminId` — those are structural fields on records that specifically need a "verified/created by" without a join. `AuditLog` covers everything else.

---

## 5. Vehicle Domain

### `Vehicle`

The core inventory record. Concrete and vehicle-only — no polymorphism here, since spare parts (Wave B) will be their own table entirely, not a subtype of Vehicle.

Key fields: `referenceNumber` (unique), `slug` (unique, SEO URL), `make`, `model`, `year`, `price` (`Decimal(12,2)`), `mileageKm`, `fuelType`, `transmission`, `engineSize`, `driveType`, `exteriorColor`, `interiorColor`, `countryOfOrigin`, `currentLocation`, `description`, `status`, `isFeatured`.

**`status`** (`VehicleStatus`): `DRAFT → PUBLISHED → RESERVED → SOLD` or `→ ARCHIVED`. This *is* the vehicle's soft-delete mechanism — there is no separate `deletedAt` on Vehicle. A vehicle that has ever been ordered cannot be hard-deleted (`OrderItem.vehicleId` and `Shipment.vehicleId` are both `Restrict`); it can only move to `ARCHIVED`.

**Estimate fields** (`shippingEstimate`, `clearingEstimate`, `otherChargesEst`) are **live, editable figures shown on the public listing** — they are explicitly *not* the same numbers that get locked into an `Order` once a quote is accepted. See §7 for why that distinction matters.

Indexes: `[status, isFeatured]` (marketplace default view), `[make, model]`, `[year]`, `[price]` (filter/sort support).

### `VehiclePhoto`

One-to-many with Vehicle, `onDelete: Cascade` (photos have no independent meaning outside their vehicle).

Has its own soft delete: `deletedAt DateTime?`. An admin's "delete photo" action sets this rather than issuing a real `DELETE` — protects against accidental loss of sourced/auction photography, which can be expensive or impossible to re-obtain.

A gallery is **one main photograph plus its supporting images**, and that is the only distinction the schema carries:

- `isPrimary` — the image shown on the vehicle card, in search results, and first in the gallery. A vehicle with at least one live photograph has **exactly one** primary; the invariant is maintained at write time by `reconcilePrimary()` in `src/lib/storage/vehicle-photo-service.ts`, never derived on read.
- `displayOrder` — the supporting images, in the order they were added.
- `altText` — nullable and **not written by the dashboard**. Reserved for the public gallery / SEO work (Stages 11, 34); until then the gallery generates a truthful description from the vehicle and the photograph's position.

The former `category` column (`VehiclePhotoCategory`: `FRONT`, `REAR`, `SIDE`, …) was dropped in migration `20260829090000_remove_vehicle_photo_category`. It was a taxonomy an operator had to maintain on every upload and that nothing downstream read — no query, no public surface, no order or shipment depended on it.

---

## 6. Customer & Quote Domain

### `Customer`

Deliberately thin in Wave A — no auth fields. Full customer accounts (Supabase Auth-backed) are a Wave B feature.

**`phone` is indexed but NOT unique.** This is intentional, not an oversight: there's no auth layer yet to reliably dedupe by phone, and enforcing uniqueness would incorrectly block legitimate second enquiries from a shared household phone.

⚠️ **Developer responsibility:** because `phone` isn't unique, every server action that creates a `Customer` from a guest form submission (quote request, etc.) **must** perform a manual dedup lookup before inserting, in this priority order:

1. Match on `email` (if provided — it *is* unique, so this is a safe exact lookup).
2. Fall back to exact match on **normalized** `phone` (strip spaces/dashes, normalize country-code format — do this in application code before the lookup, not as a query-time transform, since Postgres won't cheaply index a computed expression through Prisma).
3. Otherwise, create a new `Customer` row.

Skipping this check will accumulate duplicate customer rows over time.

`deletedAt DateTime?` — soft delete for right-to-be-forgotten style requests. On deletion, PII fields should be scrubbed in application code while the row itself persists (so `Order`/`Payment`/`Quote` foreign keys never dangle).

### `Quote`

Represents a vehicle enquiry — always the entry point before any commercial commitment exists. **An `Order` is only ever created when a `Quote` is explicitly accepted; there is no path that skips this**, including "Request This Vehicle" from a listing page.

| Field | Notes |
|---|---|
| `type` | Enum, currently only `VEHICLE`. Wave B adds `SPARE_PART` additively — this discriminator exists now specifically so Wave B's spare-parts quotes can reuse this table instead of a parallel one. |
| `linkedVehicleId` | Nullable FK to `Vehicle`, `onDelete: SetNull`. Populated when the quote came from "Request This Vehicle" on a specific listing; null for a blank "Get a Quote" enquiry. `SetNull` (not `Restrict`) because a Quote is a soft enquiry — it should survive even if the referenced listing is later removed. |
| `status` | `NEW → CONTACTED → ACCEPTED / REJECTED / EXPIRED`. Accepting a quote is the trigger that creates the corresponding `Order` (see §7). |
| `order` | Optional 1:1 back-relation — null until acceptance. |

`customerId` is `Restrict` — once a customer has any quote, they cannot be hard-deleted at the DB level.

---

## 7. Order Domain — the Extensibility-Critical Layer

This is the part of the schema built specifically so **Wave B can add spare parts without rebuilding Order, Payment, Shipment, or Tracking.**

### `Order`

Created exactly once, at the moment a `Quote` is accepted (`quoteId` is `@unique` — enforces the 1:1 relationship at the DB level).

| Field | Notes |
|---|---|
| `customerId` | Denormalized from `quote.customerId` on purpose — lets admin/customer-dashboard queries filter orders by customer directly without joining through `Quote` every time. Set once at creation, never changes. |
| `shippingCost`, `clearingCost`, `otherCharges`, `totalAmount` | **Locked-in snapshots taken at the moment the quote is accepted.** These are deliberately independent from `Vehicle`'s live estimate fields — if the vehicle listing's shipping estimate changes later (e.g. freight rates move), it must never silently change what a customer already committed to and is paying against. |
| `status` | `PENDING_DEPOSIT → DEPOSIT_CONFIRMED → AWAITING_MOMBASA_PAYMENT → PROCESSING → AWAITING_FINAL_PAYMENT → COMPLETED` or `→ CANCELLED`. Coarse, list-view-friendly status — the authoritative stage-by-stage detail lives in `PaymentMilestone` (§8). |

**No `amountPaid` or `balance` field exists on `Order`.** These must always be calculated live:

```
amountPaid = SUM(Payment.amount WHERE Payment.orderId = X AND Payment.status = 'CONFIRMED')
balance    = Order.totalAmount - amountPaid
```

This is the most safety-critical number in the system — storing it redundantly invites drift the moment any code path forgets to update it in lockstep. Always derive it at read time (a `getOrderBalance()` query helper, not a stored column).

Orders are never hard-deleted from the admin UI — cancellation is a status transition (`CANCELLED`), not a `DELETE`.

### `OrderItem`

Represents what was ordered. In Wave A, always a vehicle.

```prisma
model OrderItem {
  vehicleId String?
  vehicle   Vehicle? @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
  // sparePartId String?  <- Wave B adds this as a sibling nullable FK — no migration surgery needed on this table
  description String   // snapshot, e.g. "2021 Toyota Harrier — CLM-V-2026-000123"
  unitPrice   Decimal  @db.Decimal(12, 2)
  quantity    Int      @default(1)
  lineTotal   Decimal  @db.Decimal(12, 2)
}
```

**Design decision — concrete nullable FK per product type, not a polymorphic `productId + productType` pair.** With exactly two product types ever expected (vehicles, spare parts), real foreign keys preserve referential integrity, cascade behavior, and type-safe Prisma `include`s. A polymorphic string-based pair would lose all of that. In Wave A, `vehicleId` is populated on every row; the DB doesn't enforce this (the column must stay nullable for Wave B), so **Zod validation is responsible for requiring `vehicleId` until `sparePartId` exists.**

`description`, `unitPrice`, and `lineTotal` are **point-in-time snapshots**, not live references — an order's line items must never change if the underlying vehicle record is later edited.

`vehicleId` is `Restrict`: a vehicle that has ever been ordered can never be hard-deleted, only archived.

---

## 8. Payment & Milestone Domain

### `BusinessSettings` (singleton)

```prisma
model BusinessSettings {
  id                       Int     @id @default(1) // always exactly one row — enforced by app logic
  whatsappNumber           String
  defaultInitialPercentage Decimal @db.Decimal(5, 2) @default(50.00)
  defaultMombasaPercentage Decimal @db.Decimal(5, 2) @default(25.00)
  defaultFinalPercentage   Decimal @db.Decimal(5, 2) @default(25.00)
  updatedAt                DateTime @updatedAt
}
```

Admin-configurable defaults for the deposit structure and the central WhatsApp number (so it's never hard-coded into individual pages/components). Percentages are **defaults only** — the source of truth for what a given order actually owes is `PaymentMilestone`, not this table.

⚠️ **The three percentages summing to 100 is validated in the Zod schema for the settings admin form, not enforced by a DB `CHECK` constraint** — Prisma's schema DSL doesn't express arbitrary cross-column checks.

### `PaymentMilestone`

The payment structure is **50% Initial → 25% Mombasa → 25% Final** by default, but fully admin-configurable per the business requirement. Rather than a single `requiredDepositAmount` field (which the schema originally had and has since been removed as superseded), each order gets **three explicit milestone rows**, created at the moment the `Order` itself is created (i.e., at quote acceptance).

```prisma
model PaymentMilestone {
  orderId       String
  sequence      Int              // 1, 2, 3 — display/processing order
  label         String           // "Initial Payment (50%)", "Mombasa Payment (25%)", "Final Payment (25%)"
  percentage    Decimal @db.Decimal(5, 2)   // locked in from BusinessSettings at creation time
  amountDue     Decimal @db.Decimal(12, 2)  // locked in = percentage% of Order.totalAmount at creation time
  status        MilestoneStatus  @default(PENDING) // PENDING | DUE | PARTIALLY_PAID | PAID
  triggerStatus TrackingStatus?  // e.g. ARRIVED_AT_MOMBASA — informational, does not auto-fire
  becameDueAt   DateTime?
  completedAt   DateTime?

  @@unique([orderId, sequence])
}
```

**Why milestones are locked-in snapshots, not live percentage lookups:** identical reasoning to `Order.totalAmount` vs. `Vehicle`'s live estimates — if `BusinessSettings` defaults change later, it must never retroactively alter what an existing order's customer already agreed to and may have already partially paid against.

**Milestone math (all derived, none stored redundantly):**

```
milestone.amountPaid = SUM(Payment.amount WHERE Payment.milestoneId = X AND Payment.status = 'CONFIRMED')
milestone.balance    = milestone.amountDue - milestone.amountPaid
currentlyDue         = the PaymentMilestone row with status = 'DUE'
                        (fallback: lowest-sequence row where status != 'PAID')
```

`status` on each milestone **is** a maintained column (unlike the derived amounts above) — it must be updated transactionally, in the same `$transaction` block as any `Payment` confirmation that completes it, exactly like `Shipment.currentStatus` (§9). This keeps a write-time guarantee instead of relying on every reader to recompute which milestone is "current."

### `Payment`

The append-only financial ledger. One `Order` can and will have many `Payment` rows over its lifetime (partial payments, multiple milestones, corrections).

| Field | Notes |
|---|---|
| `milestoneId` | Nullable FK to `PaymentMilestone`, `Restrict`. Nullable because an admin recording a payment doesn't strictly require milestone attribution at entry time — but the admin UI should default to attributing it to whichever milestone currently has `status = DUE`. |
| `status` | `PENDING → SUBMITTED → UNDER_VERIFICATION → CONFIRMED`, or `→ REJECTED` / `→ REFUNDED` / `→ FAILED`. Only `CONFIRMED` payments count toward any balance calculation anywhere in the system. |
| `verifiedByAdminId` | FK to `AdminProfile`, `Restrict` — this is the audit-trail requirement for financial actions, satisfied structurally rather than only through `AuditLog`. |
| `receiptStoragePath` | Path into Supabase Storage — never a raw public URL for anything payment-related. |

`orderId` is `Restrict` — payments are the literal money record and must be functionally undeletable regardless of what happens to the parent order.

---

## 9. Shipment & Tracking Domain

### `Shipment`

```prisma
model Shipment {
  trackingNumber  String @unique // CLM-2026-000125 — what the customer types into Track My Order
  orderId         String
  vehicleId       String?
  shipmentType    ShipmentType   @default(VEHICLE) // Wave B appends SPARE_PART
  currentStatus   TrackingStatus @default(PURCHASED)
  currentLocation String?
}
```

**A `Shipment` is not created at the same time as its `Order`.** Per the business requirement, tracking only activates once an order reaches the appropriate stage — an order can legitimately sit in `PENDING_DEPOSIT` with zero shipments. The relation is optional specifically so the public tracking page can distinguish "invalid tracking number" from "valid order, tracking not yet activated" and message the customer accordingly.

`Order.shipments` is modeled as one-to-many even though Wave A only ever creates exactly one per order — this is intentional future-proofing for Wave B, where an order containing both a vehicle and spare parts might need separate shipments per product line. The Wave A server action simply always creates one.

`shipmentType` is the field that lets "Track My Order" identify which timeline/UI to render from the tracking number alone, without the customer ever needing to know there's an internal distinction between vehicle and parts logistics.

`currentStatus` **is a maintained column, not derived-on-read** — the opposite treatment from money fields, and deliberately so: it's read on every tracking-page lookup and admin list view, and updating it costs nothing extra at write time. `updateTrackingStatus()` must update this field and insert the new `TrackingEvent` inside a single `$transaction`, so the two can never drift apart.

### `TrackingEvent`

```prisma
model TrackingEvent {
  shipmentId       String
  status           TrackingStatus
  location         String?
  notes            String?  @db.Text
  eventDate        DateTime @default(now())  // business-meaningful date — editable, backdatable
  createdByAdminId String
  isVoided         Boolean  @default(false)
  voidedAt         DateTime?
  voidedByAdminId  String?
  voidReason       String?
  createdAt        DateTime @default(now())  // system-truth insert timestamp — never editable
}
```

Two date fields, two different jobs — **do not conflate them:**

- **`eventDate`** — when the event actually happened in the real world. `@default(now())` only supplies a value when the caller omits it; **the admin form must expose this as an editable field** so an admin can backdate an event that occurred offline the previous day. This is a UI/server-action requirement, not something the schema blocks.
- **`createdAt`** — when the database row was actually inserted. Never editable, never backdated. This is what makes the audit trail trustworthy.

**Corrections use a void mechanism, not deletion.** If an admin creates an erroneous tracking event, the fix is: set `isVoided = true`, `voidedAt`, `voidedByAdminId`, `voidReason`, then insert a *new* correct `TrackingEvent`. The mistake is annotated, never erased — required for the audit-trail guarantee. Any query building the customer-facing timeline **must filter `WHERE isVoided = false`.**

`TrackingStatus` enum currently covers only vehicle logistics (`PURCHASED` through `DELIVERED`). Wave B appends `ORDER_CONFIRMED`, `PROCESSING`, `PACKED`, `DISPATCHED`, `OUT_FOR_DELIVERY` for spare-parts shipments — this is a safe additive `ALTER TYPE ... ADD VALUE` in Postgres and requires no changes to existing rows. `IN_TRANSIT` and `DELIVERED` are intentionally shared vocabulary across both product types.

---

## 10. Deletion & Soft-Delete Rules — Quick Reference

| Entity | Deletion mechanism |
|---|---|
| `Vehicle` | Status transition to `ARCHIVED`. Never hard-deleted once ordered (`Restrict` from `OrderItem`, `Shipment`). |
| `VehiclePhoto` | Soft delete via `deletedAt`. |
| `Customer` | Soft delete via `deletedAt` + PII scrub in application code. Never hard-deleted (`Restrict` from `Quote`, `Order`). |
| `Quote` | Status transition (`REJECTED` / `EXPIRED`). No `deletedAt` — status already covers it. |
| `Order` | Status transition to `CANCELLED`. Never hard-deleted. |
| `OrderItem` | Cascades with parent `Order` only (has no independent meaning). |
| `Payment` | Never deleted under any circumstance — status transitions (`REJECTED`/`REFUNDED`/`FAILED`) only. This is the literal money ledger. |
| `PaymentMilestone` | Never deleted — cascades only if the entire parent `Order` is removed (which itself never happens in practice). |
| `Shipment` | Never deleted — status reflects lifecycle. |
| `TrackingEvent` | Never deleted — corrected via the void mechanism (§9). |
| `AdminProfile` | Deactivated via `isActive = false`. Never deleted (`Restrict` everywhere it's referenced). |
| `AuditLog` | Never deleted under any circumstance — it is the audit trail. |

**Rule of thumb:** if an entity has ever touched money, a customer, or an administrative action, it does not get a real `DELETE`. Everything else (photos aside) either has no soft-delete because a status enum already covers the "is this still valid" question, or cascades because it's a pure dependent of something else that itself is never deleted.

---

## 11. Indexing Summary

| Table | Indexes | Purpose |
|---|---|---|
| `Vehicle` | `[status, isFeatured]`, `[make, model]`, `[year]`, `[price]` | Marketplace filter/sort |
| `VehiclePhoto` | `[vehicleId]`, `[deletedAt]` | Gallery load, soft-delete filtering |
| `Customer` | `[phone]`, `[deletedAt]` | Dedup lookup, soft-delete filtering |
| `Quote` | `[status]`, `[customerId]`, `[createdAt]` | Admin quote queue |
| `Order` | `[status]`, `[customerId]`, `[createdAt]` | Admin order list |
| `OrderItem` | `[orderId]`, `[vehicleId]` | Join performance |
| `Payment` | `[orderId]`, `[status]`, `[paymentDate]` | Ledger queries, pending-verification queue |
| `PaymentMilestone` | `[orderId]`, `[status]` | "Currently due" lookups |
| `Shipment` | `[orderId]`, `[currentStatus]` | Admin tracking list |
| `TrackingEvent` | `[shipmentId, eventDate]`, `[isVoided]` | Timeline rendering |
| `AuditLog` | `[entityType, entityId]`, `[actorId]`, `[createdAt]` | Forensic lookup |
| `AdminProfile` | `[isActive]` | Active-admin filtering |

---

## 12. Connection Configuration (Prisma 7 specifics)

Prisma 7 does not allow connection URLs inside `schema.prisma` — the `datasource` block is provider-only:

```prisma
datasource db {
  provider = "postgresql"
}
```

Connection strings live in two separate places, using two separate Supabase connection types:

- **`prisma.config.ts`** (used by the CLI — `migrate`, `studio`) → `DIRECT_URL`, Supabase's **session pooler / direct** connection, port `5432`. DDL (migrations) does not work reliably through transaction-mode pooling.
- **`src/lib/prisma.ts`** (used by the running app, via `@prisma/adapter-pg`) → `DATABASE_URL`, Supabase's **transaction pooler**, port `6543`, `?pgbouncer=true`.

`prisma.config.ts` loads `.env.local` conditionally (`if (existsSync('.env.local'))`) so the same config file works both locally and in GitHub Codespaces, where `DATABASE_URL`/`DIRECT_URL` are injected directly as environment variables via Codespaces secrets rather than written to a file on disk.

---

## 13. What Is Deliberately Out of Scope for This Schema

- **Row Level Security (RLS):** not used on these Postgres tables. All access goes through Prisma via server actions, so the authorization boundary is the server action checking `AdminProfile`/session state, not RLS policies. RLS becomes relevant separately for Supabase **Storage** bucket policies (vehicle photos, payment receipts).
- **Amount-positivity / overpayment checks** (`price > 0`, blocking a payment that would exceed a milestone's `amountDue`): these are Zod/server-action validation concerns, not schema-level constraints.
- **Spare parts, customer accounts, documents, notifications:** Wave B. The schema above is shaped to accept these additively (nullable sibling FKs on `OrderItem`/`Shipment`, additive enum values on `QuoteType`/`ShipmentType`/`TrackingStatus`) without altering any Wave A table's existing columns.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

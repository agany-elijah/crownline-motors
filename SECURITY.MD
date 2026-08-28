# Crownline Motors — Production Security Specification

**Document Type:** Production Security Specification
**Project:** Crownline Motors
**Purpose:** Authoritative security requirements for development, testing, deployment, and maintenance
**Status:** Mandatory
**Applies To:** Frontend, backend, APIs, database, authentication, administration, customer accounts, vehicle inventory, orders, quotations, tracking, file storage, integrations, infrastructure, CI/CD, and third-party services

---

# 1. Security Objective

Crownline Motors is intended to operate as a production vehicle dealership and international vehicle-import platform.

The application must therefore be designed under the assumption that:

* users may deliberately attempt to abuse the system;
* users may manipulate requests sent by the browser;
* attackers may discover undocumented endpoints;
* attackers may inspect frontend JavaScript;
* attackers may alter URL parameters;
* attackers may submit malicious input;
* authenticated users may attempt to access other users' data;
* compromised accounts may be used to attack the application;
* third-party services may fail or return malicious/unexpected data;
* dependencies may contain vulnerabilities;
* configuration mistakes may expose sensitive information.

Security must not depend on users behaving honestly.

The fundamental principle is:

> **Anything controlled by the client must be considered untrusted until independently verified by the server or an authoritative backend system.**

Security must never be weakened to make a feature easier to implement.

---

# 2. Security Principles

All development must follow these principles.

## 2.1 Least Privilege

Every user, process, service, API endpoint, database operation, and administrative function must have only the permissions necessary to perform its intended task.

## 2.2 Defense in Depth

Critical security controls must not rely on a single protection.

For example, an administrative operation should not depend solely on hiding an admin button. Appropriate authentication, authorization, server-side validation, database permissions, and auditing should be considered together.

## 2.3 Secure by Default

New functionality must default to the more restrictive secure state.

Examples:

* private data should be private by default;
* new administrative functionality should require explicit authorization;
* new storage objects should not automatically become public;
* new endpoints should not automatically be unauthenticated.

## 2.4 Fail Securely

When a security check fails, the system must deny the operation rather than silently allowing it.

## 2.5 Never Trust Client-Side Security

Frontend restrictions are usability controls, not security controls.

The browser must never be considered authoritative for:

* user roles;
* permissions;
* prices;
* discounts;
* order totals;
* payment status;
* ownership;
* order status;
* inventory state;
* administrative privileges.

---

# 3. Threat Model

The application should be designed against at least the following threats.

## 3.1 External Unauthenticated Attacker

An attacker with no account attempts to:

* discover private endpoints;
* access customer information;
* manipulate quotes;
* abuse forms;
* upload malicious files;
* perform automated requests;
* exploit application vulnerabilities;
* discover secrets;
* attack authentication mechanisms.

## 3.2 Authenticated Malicious Customer

A legitimate customer attempts to:

* access another customer's order;
* modify another customer's information;
* manipulate vehicle prices;
* modify an order;
* bypass restrictions;
* access administrative endpoints;
* enumerate customer records;
* abuse quote or tracking systems.

## 3.3 Compromised Customer Account

An attacker obtains a customer's credentials and attempts to use the account to:

* retrieve private information;
* modify account information;
* access orders;
* abuse application functionality;
* escalate privileges.

## 3.4 Malicious or Compromised Staff Account

A staff account may have greater privileges and therefore requires stronger controls.

The system must limit the damage possible from:

* stolen staff credentials;
* excessive permissions;
* compromised sessions;
* malicious internal activity.

## 3.5 Malicious Administrator

The system should not assume that every administrator will always behave correctly.

High-impact administrative operations should be auditable.

## 3.6 Automated Bots

The application should anticipate:

* credential stuffing;
* brute-force attempts;
* endpoint enumeration;
* form spam;
* scraping;
* excessive requests;
* automated account creation.

---

# 4. Security Architecture

The application must maintain clear security boundaries between:

1. Public browser interface
2. Authenticated customer interface
3. Staff interface
4. Administrative interface
5. Server-side application logic
6. API endpoints
7. Database
8. File/object storage
9. Payment services
10. Authentication provider
11. External integrations
12. Deployment infrastructure

Sensitive operations should occur on trusted server-side infrastructure.

The browser must never be treated as a trusted execution environment.

---

# 5. Authentication

## 5.1 Authentication Requirements

All protected functionality must require proper authentication.

Authentication must be handled through the project's approved authentication system rather than through custom password-handling logic unless there is a compelling architectural reason.

## 5.2 Password Security

If passwords are handled by the application or authentication provider:

* passwords must never be stored in plaintext;
* passwords must never be logged;
* passwords must never be returned through APIs;
* password reset tokens must be protected;
* password-reset processes must expire appropriately;
* password-reset tokens must not be reusable.

## 5.3 Session Security

Authenticated sessions must:

* expire according to appropriate security policies;
* be invalidated when necessary;
* use secure cookie configuration where cookies are used;
* avoid exposing authentication tokens unnecessarily;
* not be placed in URLs;
* not be logged.

## 5.4 Account Enumeration

Authentication and recovery endpoints should avoid unnecessarily revealing whether a particular email address or account exists.

## 5.5 Brute Force Protection

Authentication endpoints must have appropriate protection against:

* brute force;
* credential stuffing;
* automated login attempts.

Rate limiting, progressive delays, CAPTCHA or equivalent controls may be used where appropriate.

---

# 6. Authorization

Authentication answers:

> Who are you?

Authorization answers:

> What are you allowed to do?

The application must enforce both independently.

## 6.1 Role-Based Access Control

The system must maintain explicit roles where required.

Potential roles may include:

* CUSTOMER
* STAFF
* ADMIN
* SUPER_ADMIN

Actual roles must follow the approved Crownline Motors architecture.

## 6.2 Server-Side Authorization

Every sensitive operation must verify authorization on the server.

Never rely solely on:

```text
Hidden button
Hidden page
Disabled input
Frontend route protection
Frontend role check
```

## 6.3 Object-Level Authorization

Every request involving a specific resource must verify ownership or permission.

Example:

```text
/api/orders/123
```

must not automatically expose order `123` merely because the requester knows its ID.

The server must verify that the requester is authorized to access that particular order.

This applies to:

* orders;
* quotes;
* customer profiles;
* invoices;
* payment records;
* documents;
* uploaded files;
* private messages;
* administrative records.

---

# 7. Privilege Escalation Prevention

Users must not be able to elevate their privileges by modifying:

* request bodies;
* URL parameters;
* cookies;
* local storage;
* frontend state;
* hidden form fields;
* JWT claims controlled by the client;
* role fields;
* database IDs.

A customer must never be able to turn themselves into an administrator by sending:

```text
role=ADMIN
```

or an equivalent manipulated request.

Role assignment must be controlled by trusted server-side mechanisms.

---

# 8. Database Security

The database is a critical security boundary.

## 8.1 Credentials

Database credentials must never be exposed to the browser.

## 8.2 Service-Level Credentials

Privileged database or Supabase service credentials must remain exclusively server-side.

They must never be:

* included in client bundles;
* prefixed as public environment variables;
* sent to browsers;
* committed to Git;
* displayed in logs.

## 8.3 Row-Level Security

Where Supabase/PostgreSQL Row Level Security is part of the architecture, RLS policies must be deliberately designed and tested.

Do not disable RLS simply because it causes an application error.

## 8.4 Database Authorization

Application authorization and database authorization should complement one another.

A successful frontend request must not automatically imply database access.

## 8.5 Production Data Protection

Claude must never execute destructive operations against production without explicit authorization.

Forbidden without explicit approval:

* `DROP DATABASE`
* destructive table drops;
* truncation;
* uncontrolled mass deletion;
* database reset;
* destructive migrations;
* deletion of production records.

## 8.6 Database Migrations

Schema changes must be:

* deliberate;
* version-controlled;
* reversible where practical;
* tested before production deployment.

---

# 9. Input Validation

All external input must be treated as untrusted.

Validation must occur at trusted server boundaries.

Inputs include:

* forms;
* query parameters;
* URL parameters;
* JSON bodies;
* headers;
* cookies;
* uploaded files;
* third-party API responses;
* webhooks.

Validation should establish:

* type;
* required/optional status;
* length;
* format;
* range;
* allowed values;
* business constraints.

---

# 10. Injection Prevention

The application must protect against injection vulnerabilities.

This includes:

* SQL injection;
* NoSQL injection where applicable;
* command injection;
* shell injection;
* template injection;
* LDAP injection where applicable;
* header injection;
* path traversal;
* expression injection.

User-controlled strings must never be blindly passed into executable contexts.

---

# 11. Cross-Site Scripting (XSS)

The application must prevent malicious scripts from being executed through user-controlled content.

Potentially unsafe content includes:

* customer names;
* messages;
* vehicle descriptions;
* reviews;
* inquiries;
* uploaded metadata;
* administrative content.

Avoid rendering arbitrary HTML unless there is a justified and carefully controlled requirement.

If HTML rendering is required, use appropriate sanitization.

---

# 12. Cross-Site Request Forgery

State-changing requests must be appropriately protected against CSRF where the authentication architecture makes CSRF relevant.

Sensitive operations include:

* changing account information;
* changing passwords;
* creating orders;
* modifying orders;
* changing vehicle information;
* administrative actions;
* changing permissions.

---

# 13. API Security

Every API endpoint must be classified as one of:

* Public
* Authenticated
* Staff-only
* Admin-only
* System/internal

This classification must be intentional.

## 13.1 Public Endpoints

Public endpoints must expose only information intended for public consumption.

## 13.2 Protected Endpoints

Protected endpoints must verify:

1. Authentication
2. Authorization
3. Input validity
4. Resource ownership where applicable
5. Business rules

## 13.3 HTTP Methods

Endpoints should use appropriate HTTP methods and must not permit unintended operations through alternative methods.

## 13.4 Response Minimization

APIs must return only the data required by the requesting client.

Do not return entire database records merely because they are convenient.

---

# 14. Business Logic Security

Security is not limited to technical vulnerabilities.

Critical business logic must be enforced server-side.

The server must independently determine or verify:

* vehicle prices;
* deposit requirements;
* order totals;
* discounts;
* availability;
* order status;
* payment status;
* shipping status;
* user ownership;
* staff permissions.

Never trust a client-provided value merely because the UI normally prevents users from changing it.

---

# 15. Vehicle Inventory Security

Vehicle inventory operations require authorization.

Only authorized staff should be able to:

* create vehicles;
* modify vehicle details;
* change prices;
* mark vehicles as sold;
* change inventory status;
* remove vehicles;
* modify vehicle availability.

Critical inventory changes should be auditable.

---

# 16. Order Security

Orders contain commercially and potentially personally sensitive information.

Customers must only access their own authorized orders.

Order state transitions must be controlled.

For example, a customer must not be able to change:

```text
PENDING
```

to:

```text
PAID
```

merely by manipulating a request.

Order status should be changed through trusted server-side business logic.

---

# 17. Payment Security

Payment functionality must follow the security model of the selected payment provider.

The application should avoid storing sensitive payment credentials unnecessarily.

Never store:

* raw card numbers;
* CVV/security codes;
* payment passwords;
* provider authentication secrets

unless there is an explicitly justified and compliant architecture.

Payment status must not be determined solely from client-side information.

Where webhooks are used, webhook authenticity must be verified before processing the event.

---

# 18. Quote Security

Quote requests should be validated and protected against automated abuse.

Client-provided values must not be blindly treated as authoritative pricing.

The server should calculate or verify important financial values.

---

# 19. Vehicle Tracking Security

Vehicle tracking functionality requires careful consideration because tracking information may be sensitive.

A tracking identifier alone should not automatically expose sensitive customer information.

Where appropriate, tracking should require:

* authenticated access;
* a secure tracking token;
* additional verification;
* or another approved mechanism.

Do not expose unnecessary:

* customer information;
* financial information;
* internal logistics data;
* supplier information;
* private notes.

---

# 20. Personal Data Protection

Customer information must be treated as sensitive.

Potentially sensitive information includes:

* names;
* email addresses;
* phone numbers;
* addresses;
* order information;
* payment information;
* identification documents;
* communications;
* shipping information.

Collect only information necessary for the application's legitimate functionality.

Do not expose personal information through:

* public APIs;
* frontend bundles;
* URLs;
* logs;
* error messages;
* public storage;
* search-engine-indexable pages.

---

# 21. File Upload Security

Any file upload must be treated as hostile input.

The system must validate:

* file size;
* MIME type;
* actual file format where practical;
* filename;
* extension;
* storage location;
* access permissions.

Do not rely solely on the filename extension.

Uploaded files should not automatically become executable content.

---

# 22. Private File Storage

Private customer or administrative documents must use private storage mechanisms.

Access should be granted through controlled authorization mechanisms.

Do not expose permanent public URLs for private documents where protected access is required.

---

# 23. Image Security

Vehicle images should be processed and stored safely.

The application should consider:

* maximum file dimensions;
* maximum file size;
* supported formats;
* metadata stripping where appropriate;
* malicious image payloads;
* storage permissions;
* transformation services.

---

# 24. Content Security Policy

The production application should implement an appropriate Content Security Policy where compatible with the application's architecture.

The policy should restrict unnecessary:

* scripts;
* frames;
* object resources;
* external connections;
* inline execution.

Do not blindly copy a CSP that breaks legitimate application functionality.

---

# 25. Security Headers

Production deployment should use appropriate security headers, including where applicable:

* Strict-Transport-Security;
* Content-Security-Policy;
* X-Content-Type-Options;
* Referrer-Policy;
* appropriate frame protections;
* appropriate permissions policy.

Headers must be configured according to the actual deployment architecture.

---

# 26. HTTPS and Transport Security

Production traffic must use HTTPS.

Sensitive information must never be transmitted over insecure HTTP.

Authentication credentials, session information, personal data, and payment-related information must be protected in transit.

HTTP-to-HTTPS redirection should be configured appropriately.

---

# 27. Cookie Security

Authentication cookies should use appropriate security attributes, including where applicable:

* `Secure`
* `HttpOnly`
* appropriate `SameSite`

Cookie scope should be as restrictive as practical.

Do not store sensitive credentials in insecure client-accessible storage unnecessarily.

---

# 28. Environment Variables

Environment variables must be classified into:

* public configuration;
* private server-side secrets.

Only genuinely public configuration may be exposed to the browser.

Never expose:

* database passwords;
* service-role keys;
* private API keys;
* webhook secrets;
* authentication secrets.

---

# 29. Git and Repository Security

The repository must not contain secrets.

Before committing code, verify that sensitive files are excluded appropriately.

Potentially sensitive files include:

```text
.env
.env.local
.env.production
credentials files
private certificates
service-account keys
database dumps
private customer exports
```

`.gitignore` must be configured appropriately.

If a secret is accidentally committed, merely deleting it in a later commit is insufficient. The secret must be considered compromised and rotated.

---

# 30. Dependency Security

Dependencies must be introduced deliberately.

Before adding a package, determine whether:

* the existing framework already provides the functionality;
* an existing dependency already solves the problem;
* the package is reputable;
* it is maintained;
* it introduces unnecessary attack surface.

Dependencies should be kept reasonably current.

Known vulnerable dependencies must be investigated and remediated.

---

# 31. Supply-Chain Security

Third-party packages, APIs, SDKs, fonts, scripts, analytics systems, and external assets can introduce security risks.

Do not load unnecessary third-party JavaScript.

Third-party services must be evaluated according to:

* necessity;
* trustworthiness;
* data access;
* security implications;
* availability;
* privacy implications.

---

# 32. External API Security

API keys must remain server-side unless a provider explicitly requires a public client key.

External API responses must not automatically be considered trusted.

Validate important external data before using it in security-sensitive or business-critical operations.

---

# 33. Webhook Security

Incoming webhooks must be authenticated or cryptographically verified where the provider supports it.

The application must not trust a webhook merely because it originates from a URL.

Webhook handlers should:

* verify authenticity;
* validate payloads;
* prevent replay where applicable;
* process idempotently where appropriate;
* avoid exposing secrets.

---

# 34. Rate Limiting

Rate limiting should be implemented for sensitive or abuse-prone functionality.

Priority areas include:

* login;
* registration;
* password recovery;
* verification;
* quote requests;
* contact forms;
* tracking requests;
* public search;
* expensive API operations;
* administrative endpoints.

Rate limits should be designed according to legitimate usage rather than arbitrarily blocking users.

---

# 35. Anti-Automation and Abuse Prevention

Public functionality should be evaluated for abuse.

Controls may include:

* rate limiting;
* request throttling;
* CAPTCHA or equivalent mechanisms;
* IP reputation controls;
* account verification;
* request quotas.

Do not introduce intrusive controls unnecessarily.

---

# 36. Enumeration Prevention

The application should prevent easy enumeration of:

* users;
* orders;
* vehicles;
* quotes;
* invoices;
* internal IDs;
* administrative resources.

Sequential IDs may be acceptable internally, but authorization must never depend on an ID being difficult to guess.

---

# 37. Error Handling

Production errors must not expose:

* stack traces;
* database queries;
* credentials;
* internal filesystem paths;
* secret values;
* infrastructure details;
* private customer data.

Users should receive appropriate human-readable errors.

Detailed diagnostics should remain in controlled server-side logging.

---

# 38. Logging

Security-relevant events should be logged where appropriate.

Examples:

* authentication failures;
* successful administrative login;
* permission changes;
* role changes;
* vehicle price changes;
* inventory changes;
* order status changes;
* payment events;
* suspicious activity;
* security failures.

Logs must not contain unnecessary sensitive information.

Never log:

* passwords;
* authentication tokens;
* API secrets;
* payment security codes;
* private credentials.

---

# 39. Auditability

High-impact administrative actions should be attributable to a specific authenticated user where practical.

Audit records should capture appropriate information such as:

* actor;
* action;
* affected resource;
* timestamp;
* relevant before/after state where appropriate.

Audit logs should themselves be protected against unauthorized modification.

---

# 40. Administrative Security

The administration system represents a high-value attack target.

Administrative routes must have:

* strong authentication;
* strict authorization;
* server-side enforcement;
* appropriate session controls;
* auditing;
* rate limiting where appropriate.

Administrative functionality must never rely solely on an obscure URL.

---

# 41. High-Privilege Accounts

High-privilege accounts should receive stronger protection.

Where supported and appropriate:

* multi-factor authentication should be enabled;
* privileged actions should require stronger verification;
* sessions should be shorter or more tightly controlled;
* administrative activity should be audited.

---

# 42. Session Management

The application must protect against session-related attacks.

Consider:

* session expiration;
* session invalidation after sensitive account changes;
* secure cookies;
* token rotation where applicable;
* protection against token leakage;
* logout behavior.

Do not expose authentication tokens unnecessarily.

---

# 43. Account Recovery

Password and account recovery must be designed as carefully as login.

Recovery mechanisms must not become an alternative route for account takeover.

Reset links/tokens should:

* expire;
* be single-use where appropriate;
* be unpredictable;
* not appear unnecessarily in logs;
* not disclose account information.

---

# 44. Email Security

Emails sent by the application must not expose unnecessary personal or sensitive information.

Email links involving sensitive actions should use secure, expiring tokens.

Production email infrastructure should be configured appropriately for domain authentication and deliverability.

---

# 45. Search Security

Search functionality must not become an unintended database-extraction mechanism.

Search endpoints should:

* validate queries;
* limit result sizes;
* prevent injection;
* avoid returning unauthorized fields;
* use pagination;
* implement appropriate rate limiting where necessary.

---

# 46. SEO Security

Only intentionally public content should be indexable.

Private pages such as:

* customer dashboards;
* orders;
* invoices;
* account pages;
* administrative pages

must not be exposed to search engines.

`robots.txt` is not an authorization mechanism.

Actual access restrictions must be enforced server-side.

---

# 47. Caching Security

Private user-specific data must not accidentally be served from shared caches.

Caching strategies must distinguish between:

* public content;
* authenticated content;
* personalized content;
* administrative content.

Sensitive responses must not be cached publicly.

---

# 48. Next.js / Server-Client Boundary

Where Next.js is used, Claude must carefully distinguish between:

* server-side code;
* client-side code;
* server actions;
* route handlers;
* API endpoints;
* browser-accessible environment variables.

Sensitive operations and credentials must remain on the server.

A secret imported into code that reaches a client component can become exposed.

---

# 49. Frontend Security

Frontend code must never be considered a trusted security boundary.

The frontend should still provide:

* appropriate validation;
* clear user feedback;
* safe rendering;
* secure state management.

However, every security-sensitive rule must ultimately be enforced server-side.

---

# 50. Administrative UI Security

Admin interfaces should avoid displaying unnecessary sensitive information.

Administrative pages should:

* request only necessary data;
* use secure APIs;
* enforce authorization;
* avoid embedding secrets;
* protect destructive actions against accidental execution.

Destructive operations should use appropriate confirmation mechanisms.

---

# 51. Data Minimization

Do not collect or store information simply because it might become useful someday.

For every sensitive field, there should be a legitimate business purpose.

Reduce unnecessary exposure by:

* selecting only required database columns;
* limiting API responses;
* restricting administrative visibility;
* avoiding unnecessary duplication of personal data.

---

# 52. Data Retention

Data should not be retained indefinitely without justification.

Retention requirements should eventually be established for:

* customer accounts;
* orders;
* quotes;
* communications;
* uploaded documents;
* audit records;
* logs.

Deletion must respect legitimate legal, accounting, operational, and audit requirements.

---

# 53. Backup Security

Production backups must be:

* protected;
* access-controlled;
* encrypted where appropriate;
* monitored;
* tested for restoration.

A backup containing customer information is itself sensitive data.

---

# 54. Disaster Recovery

The system should have a recovery strategy for:

* database failure;
* accidental deletion;
* compromised credentials;
* application corruption;
* infrastructure failure;
* third-party service outages.

Backups should not merely exist; restoration should be periodically tested.

---

# 55. Production Configuration

Production configuration must not use development shortcuts.

Never deploy production with:

* debug mode enabled unnecessarily;
* development credentials;
* test accounts with elevated privileges;
* unrestricted CORS;
* weak authentication;
* exposed debugging endpoints;
* test secrets;
* sample data containing real personal information.

---

# 56. CORS

Cross-Origin Resource Sharing must be explicitly configured.

Do not use unrestricted configurations such as allowing every origin unless there is a specific architectural reason.

Credentials and cross-origin access must be handled deliberately.

---

# 57. Content Upload and Storage Access

Storage permissions must follow the same authorization model as the application.

A customer should not be able to manipulate a storage path and access another customer's files.

Storage object identifiers must never substitute for authorization.

---

# 58. Third-Party Integrations

Every external integration must be evaluated for:

* credentials;
* permissions;
* data shared;
* failure behavior;
* security model;
* webhook validation;
* rate limits;
* privacy implications.

Integrations should receive only the permissions they require.

---

# 59. Monitoring

Production systems should have mechanisms for detecting:

* repeated authentication failures;
* unusual administrative activity;
* sudden API traffic increases;
* repeated authorization failures;
* abnormal database activity;
* unexpected application errors;
* suspicious file uploads.

---

# 60. Incident Response

The project should eventually maintain an incident-response procedure.

If a security incident occurs:

1. Identify the affected system.
2. Contain the incident.
3. Revoke or rotate compromised credentials.
4. Preserve relevant evidence and logs.
5. Determine the scope of the incident.
6. Restore secure operation.
7. Correct the vulnerability.
8. Verify that the vulnerability is closed.
9. Review how the incident occurred.
10. Implement measures to prevent recurrence.

Do not simply patch the visible symptom.

---

# 61. Secret Rotation

If a credential is exposed, assume it is compromised.

Immediately rotate the affected credential.

This applies to:

* API keys;
* database passwords;
* service-role keys;
* webhook secrets;
* OAuth secrets;
* signing keys;
* deployment credentials.

Deleting the exposed credential from Git history does not make it safe again.

---

# 62. Security Testing

Security must be tested rather than assumed.

Testing should include:

## Authentication testing

Verify that:

* unauthenticated users cannot access protected resources;
* invalid credentials are rejected;
* sessions behave correctly;
* password recovery is secure.

## Authorization testing

Verify that:

* customers cannot access other customers' resources;
* customers cannot access staff functionality;
* staff cannot access unauthorized administrative functions;
* unauthorized API calls are rejected.

## Input testing

Test:

* malformed input;
* oversized input;
* unexpected types;
* malicious strings;
* invalid identifiers;
* boundary values.

## API testing

Test:

* missing authentication;
* incorrect roles;
* altered IDs;
* manipulated request bodies;
* unauthorized HTTP methods;
* excessive requests.

## File testing

Test:

* invalid extensions;
* oversized files;
* malicious filenames;
* unsupported formats;
* unauthorized file access.

---

# 63. Negative Security Testing

Do not test only the legitimate workflow.

For every important feature, test:

> "What happens if a malicious user deliberately manipulates this?"

Examples:

* Change another customer's order ID.
* Modify a vehicle price in the request.
* Send an admin API request as a customer.
* Change `role` in the request body.
* Access private storage using another user's identifier.
* Submit an invalid payment status.
* Modify an order-state value.
* Send unexpected JSON fields.
* Attempt excessive requests.

The system should reject these attempts safely.

---

# 64. Security During Development

Claude must never disable a security mechanism merely to make development easier.

Forbidden shortcuts include:

```text
Disable authentication
Disable authorization
Disable RLS
Expose service-role keys
Make private storage public
Allow all origins
Ignore validation
Hard-code credentials
Suppress security errors
Delete database records to fix migrations
```

If a security control is preventing functionality from working, Claude must diagnose the underlying issue.

---

# 65. Code Review Requirements

Before substantial code is considered complete, inspect:

* authentication;
* authorization;
* input validation;
* database queries;
* data exposure;
* error handling;
* secrets;
* file handling;
* API behavior;
* business logic;
* dependencies.

Security-sensitive code should receive additional scrutiny.

---

# 66. Security and Refactoring

Refactoring must preserve security controls.

Claude must not accidentally remove:

* authorization checks;
* validation;
* RLS policies;
* middleware;
* security headers;
* session checks;
* rate limiting;
* audit logging.

A cleaner architecture is not an acceptable justification for weakening security.

---

# 67. Security and Performance

Performance optimizations must not compromise authorization or data isolation.

Examples of dangerous shortcuts include:

* caching private responses publicly;
* returning more data to reduce API calls;
* bypassing authorization for performance;
* disabling validation;
* exposing database queries directly.

Security remains mandatory even when optimizing performance.

---

# 68. Security and User Experience

Security mechanisms should be designed to be robust without creating unnecessary friction.

However:

> **Convenience must never override a necessary security control.**

Where a security measure affects UX, the implementation should improve the UX around the security requirement rather than removing the requirement.

---

# 69. Security Documentation

Important security architecture must be documented.

Documentation should explain:

* authentication architecture;
* authorization model;
* roles;
* database security;
* storage security;
* sensitive environment variables;
* external integrations;
* webhook verification;
* deployment security;
* backup strategy;
* incident-response procedures.

---

# 70. Claude Code Operating Rules

Claude Code must follow these security rules on every implementation.

1. Never assume that frontend restrictions are security controls.
2. Never trust client-supplied security-sensitive values.
3. Never expose secrets.
4. Never commit secrets.
5. Never disable authentication to solve an implementation problem.
6. Never disable authorization to solve an implementation problem.
7. Never disable database security policies merely to make code work.
8. Never expose private customer data unnecessarily.
9. Never assume that knowing a resource ID grants access to that resource.
10. Never trust uploaded files.
11. Never trust third-party input blindly.
12. Never expose internal errors to users.
13. Never perform destructive production database operations without explicit approval.
14. Never introduce unnecessary security-sensitive dependencies.
15. Never silently change authentication or authorization architecture.
16. Never modify critical financial or order logic without understanding the existing business rules.
17. Always inspect existing security controls before changing related code.
18. Always test unauthorized access paths for security-sensitive functionality.
19. Always preserve security controls during refactoring.
20. If a proposed implementation creates a meaningful security risk, stop and explain the risk before implementing it.

---

# 71. Definition of Security Completion

A feature must not be considered production-ready merely because:

* it renders correctly;
* the build passes;
* TypeScript compiles;
* the happy path works.

A security-sensitive feature is complete only when:

* authentication is correct;
* authorization is correct;
* ownership checks are correct;
* input validation is implemented;
* sensitive data exposure has been considered;
* error handling is safe;
* database access is secure;
* relevant abuse scenarios have been considered;
* relevant negative tests have passed;
* secrets are protected;
* production configuration has been considered.

---

# 72. Final Security Directive

Crownline Motors must be developed as a real production application rather than a demonstration application.

Claude must prioritize:

**Security → Correctness → Data integrity → Authorization → Maintainability → Performance → Convenience**

The application must never sacrifice security, authorization, data integrity, or privacy merely to:

* make development faster;
* eliminate an error quickly;
* simplify implementation;
* make a demo work;
* pass a build;
* satisfy a visual requirement;
* avoid refactoring;
* reduce development effort.

When uncertain about a security-sensitive decision, Claude must **stop, identify the risk, explain the alternatives, and obtain approval before making a consequential change**.

The absence of an obvious vulnerability is not proof of security.

Security must be continuously considered throughout development, testing, deployment, and maintenance.

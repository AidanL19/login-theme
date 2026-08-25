# Backend Integration Guide: Cognito Registration Metadata to DynamoDB and Kit

## Purpose

This section extends the Static Website Cognito Registration Attribution Integration Guide through the AWS backend and Kit synchronization layers.

The complete working architecture is:

```text
Static registration page
        |
        | email
        | campaign_code
        | UTM values
        | referrer
        | registration URL
        | country
        | consent
        | optional site-specific metadata
        v
auth-forms.js
        |
        | registrationContext
        v
auth.js
        |
        | Cognito ClientMetadata
        v
Amazon Cognito SignUp
        |
        | metadata saved in sessionStorage
        v
User enters email OTP
        |
        v
Amazon Cognito ConfirmSignUp
        |
        | same ClientMetadata again
        v
Cognito Post Confirmation Lambda
        |
        | event.request.clientMetadata
        v
Registration/Profile Sync Lambda
        |
        +------> DynamoDB profile
        |
        +------> Kit subscriber
                     |
                     +--> Campaign Code
                     +--> Country
                     +--> Country Source
                     +--> Registration URL
                     +--> Registration Referrer
                     +--> UTM Source
                     +--> UTM Medium
                     +--> UTM Campaign
                     +--> UTM Term
                     +--> UTM Content
                     +--> Browser Locale
                     +--> Browser Timezone
                     +--> Personality
                     +--> site-specific fields
                     +--> new-signup tag
```

The important architectural principle is:

```text
Browser collects context.
Cognito transports context.
Lambda interprets context.
DynamoDB optionally preserves context.
Kit receives marketing fields.
```

Do not put Kit business logic or Kit credentials in the browser.

---

# 46. Updated Kit Strategy

The original integration design attempted to map:

```text
referrer
utm_source
utm_medium
utm_campaign
utm_term
utm_content
```

into Kit's built-in:

```text
How they first found you

Referrer
UTM Source
UTM Medium
UTM Campaign
UTM Term
UTM Content
```

Do not rely on this mechanism for Cognito/API registrations.

In the tested implementation, Kit subscribers created through the API successfully received custom fields such as:

```text
Campaign Code
Country
Registration URL
```

while Kit's built-in attribution area continued to display:

```text
Referrer       unknown
UTM Source     unknown
UTM Medium     unknown
UTM Campaign   unknown
UTM Term       unknown
UTM Content    unknown
```

The integration should therefore use ordinary Kit custom fields for all registration attribution.

The recommended mapping is now:

| Cognito ClientMetadata | Internal Lambda property | Kit custom field      |
| ---------------------- | ------------------------ | --------------------- |
| `campaign_code`        | `campaignCode`           | Campaign Code         |
| `country`              | `country`                | Country               |
| `country_source`       | `countrySource`          | Country Source        |
| `registration_url`     | `registrationUrl`        | Registration URL      |
| `referrer`             | `referrer`               | Registration Referrer |
| `utm_source`           | `utmSource`              | UTM Source            |
| `utm_medium`           | `utmMedium`              | UTM Medium            |
| `utm_campaign`         | `utmCampaign`            | UTM Campaign          |
| `utm_term`             | `utmTerm`                | UTM Term              |
| `utm_content`          | `utmContent`             | UTM Content           |
| `browser_locale`       | `browserLocale`          | Browser Locale        |
| `browser_timezone`     | `browserTimezone`        | Browser Timezone      |
| `personality`          | `personality`            | Personality           |

`marketing_consent` is not primarily a display field. It controls whether the registration should be synchronized to Kit as an active marketing subscriber.

---

# 47. Two Backend Lambda Roles

Some websites may have one Lambda performing all post-registration work.

Others may use two Lambdas.

The working DashAway pattern uses two logical stages.

## Stage 1: Application Post Confirmation Lambda

This Lambda is attached directly to the Cognito User Pool as the Post Confirmation trigger.

Its responsibilities may include application-specific initialization such as:

```text
Create application user
Create account summary
Create welcome credits
Create initial ledger entries
Initialize application-specific records
```

It should process only:

```text
PostConfirmation_ConfirmSignUp
```

It must not perform registration initialization for password-reset or unrelated Cognito trigger events.

A typical check is:

```javascript
if (
    event.triggerSource !==
    "PostConfirmation_ConfirmSignUp"
) {
    return event;
}
```

This Lambda receives the registration metadata at:

```javascript
event.request.clientMetadata
```

If another Lambda is responsible for profile and Kit synchronization, forward the entire Cognito event.

Preferred pattern:

```javascript
const downstreamEvent = {
    ...event,

    applicationRegistration: true
};
```

Then invoke the registration-sync Lambda asynchronously.

Do not manually reconstruct only part of the Cognito event.

Using:

```javascript
...event
```

preserves:

```text
event.request.userAttributes
event.request.clientMetadata
event.triggerSource
event.userPoolId
event.userName
```

and any other Cognito event information that may later be useful.

---

# 48. Why the Original Event Should Be Preserved

An LLM modifying this architecture must understand that `ClientMetadata` is nested inside the Cognito event.

The important structure is approximately:

```javascript
{
    triggerSource:
        "PostConfirmation_ConfirmSignUp",

    userPoolId:
        "...",

    userName:
        "...",

    request: {

        userAttributes: {
            sub:
                "...",

            email:
                "person@example.com",

            email_verified:
                "true"
        },

        clientMetadata: {

            campaign_code:
                "CLAUDE30",

            referrer:
                "https://example.com/article/",

            registration_url:
                "https://example.com/auth/register.html",

            utm_source:
                "linkedin",

            utm_medium:
                "social",

            utm_campaign:
                "claude-launch",

            marketing_consent:
                "true",

            browser_locale:
                "en-CA",

            browser_timezone:
                "America/Toronto",

            country:
                "CA",

            country_source:
                "browser_locale"
        }
    }
}
```

If an intermediate Lambda constructs a new event manually and forgets:

```javascript
request.clientMetadata
```

all registration attribution will be lost.

An implementation LLM should therefore preserve the entire event whenever possible.

---

# 49. Registration/Profile Sync Lambda

The second Lambda is responsible for durable registration/profile processing and Kit synchronization.

Despite any legacy function name such as:

```text
ceg-create-stripe-user
```

this Lambda should not create a Stripe customer during registration.

Stripe customer creation belongs in:

```text
checkout
purchase
subscription creation
payment flow
```

not registration.

A more accurate conceptual name is:

```text
registration-profile-kit-sync
```

or:

```text
cognito-registration-profile-kit-sync
```

Its responsibilities are:

```text
Read confirmed Cognito identity
Read ClientMetadata
Normalize attribution
Write/update DynamoDB profile
Optionally write profile snapshot
Honor marketing consent
Create/update Kit subscriber
Set Kit custom fields
Apply registration tags
Apply application-specific Kit fields
```

It should contain no Stripe customer creation logic.

---

# 50. Reading ClientMetadata

The registration-sync Lambda should read:

```javascript
const clientMetadata =
    normalizeClientMetadata(
        event?.request?.clientMetadata || {}
    );
```

Then convert the wire-format field names into normal JavaScript property names.

For example:

```javascript
const registrationAttribution =
    buildRegistrationAttribution(
        clientMetadata
    );
```

The browser/Cognito contract should remain snake_case:

```text
campaign_code
registration_url
utm_source
utm_medium
utm_campaign
utm_term
utm_content
browser_locale
browser_timezone
country_source
marketing_consent
```

The Lambda may internally use camelCase:

```text
campaignCode
registrationUrl
utmSource
utmMedium
utmCampaign
utmTerm
utmContent
browserLocale
browserTimezone
countrySource
marketingConsent
```

Do not change the external field names differently on each site.

---

# 51. ClientMetadata Normalization

Treat ClientMetadata as untrusted input.

Normalize it before use.

A suitable normalization rule is:

```text
Must be an object
Ignore arrays
Convert values to strings
Trim whitespace
Drop empty keys
Drop empty values
Return a plain object
```

Conceptually:

```javascript
function normalizeClientMetadata(metadata) {

    if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
    ) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(metadata)

            .map(([key, value]) => [
                String(key || "").trim(),
                String(value ?? "").trim()
            ])

            .filter(([key, value]) =>
                Boolean(key && value)
            )
    );
}
```

Marketing metadata must never be trusted for authorization or financial decisions.

---

# 52. Registration Attribution Object

The backend should construct one canonical object.

Example:

```javascript
{
    campaignCode:
        "CLAUDE30",

    referrer:
        "https://example.com/article/",

    registrationUrl:
        "https://example.com/auth/register.html",

    utmSource:
        "linkedin",

    utmMedium:
        "social",

    utmCampaign:
        "claude-launch",

    utmTerm:
        "architect",

    utmContent:
        "hero-button",

    marketingConsent:
        true,

    browserLocale:
        "en-CA",

    browserTimezone:
        "America/Toronto",

    country:
        "CA",

    countrySource:
        "browser_locale",

    personality:
        "scrumtuous"
}
```

Only populated properties should normally be included.

The exception is:

```text
marketingConsent=false
```

because false is meaningful and must not be discarded.

---

# 53. Marketing Consent Behavior

Authentication and marketing consent are separate concerns.

A user who declines marketing must still be allowed to:

```text
Create their Cognito account
Verify their email
Sign in
Receive application access
Receive application records
Use purchased products
```

Marketing consent should affect only marketing synchronization.

Recommended behavior:

```text
marketing_consent=true
        |
        v
Synchronize subscriber to Kit
```

```text
marketing_consent=false
        |
        v
Do NOT create/activate marketing subscriber in Kit
```

For backward compatibility, an older site that sends no `marketing_consent` value may preserve the application's previous behavior.

An implementation LLM must not reinterpret:

```text
marketing_consent=false
```

as a failed registration.

---

# 54. DynamoDB Attribution Storage

The registration-sync Lambda may store the attribution with the user's stable profile.

Recommended property:

```javascript
registrationAttribution
```

Example DynamoDB profile:

```javascript
{
    pk:
        "USER#abc123",

    sk:
        "PROFILE",

    entityType:
        "user_profile",

    email:
        "person@example.com",

    registeredAt:
        "2026-08-09T20:00:00.000Z",

    registrationAttribution: {

        campaignCode:
            "CLAUDE30",

        registrationUrl:
            "https://example.com/auth/register.html",

        utmSource:
            "linkedin",

        utmCampaign:
            "claude-launch",

        country:
            "CA",

        marketingConsent:
            true
    }
}
```

The preferred update behavior is:

```javascript
registrationAttribution =
    if_not_exists(
        registrationAttribution,
        :registrationAttribution
    )
```

This preserves the original registration source if Cognito retries the Lambda or the same user is processed again.

Registration attribution describes:

```text
how this account originally registered
```

not:

```text
the user's most recent visit
```

Those are different concepts.

---

# 55. Optional Profile Snapshots

If the existing application writes immutable profile snapshots, include the same registration attribution in the snapshot.

Example:

```javascript
snapshot.registrationAttribution =
    registrationAttribution;
```

Do not add snapshot functionality merely for attribution if the application does not already use snapshots.

---

# 56. Kit Subscriber Creation

After the DynamoDB profile has been successfully written, the Lambda may create or update the Kit subscriber.

Typical Kit subscriber body:

```javascript
{
    email_address:
        email,

    state:
        "active",

    first_name:
        firstName
}
```

Only perform this operation when:

```text
Kit synchronization is enabled
Kit API key exists
Email exists
Email is verified
Marketing consent has not been explicitly declined
```

Kit failure should generally not undo successful Cognito registration.

---

# 57. Kit Custom Fields

Use ordinary Kit custom fields for registration attribution.

The proven field labels are:

```text
Campaign Code
Country
Country Source
Registration URL
Registration Referrer
UTM Source
UTM Medium
UTM Campaign
UTM Term
UTM Content
Browser Locale
Browser Timezone
Personality
```

These labels should be centralized in one obvious section of the Lambda.

Example:

```javascript
const KIT_FIELD_LABELS =
    Object.freeze({

        campaignCode:
            "Campaign Code",

        country:
            "Country",

        countrySource:
            "Country Source",

        registrationUrl:
            "Registration URL",

        referrer:
            "Registration Referrer",

        utmSource:
            "UTM Source",

        utmMedium:
            "UTM Medium",

        utmCampaign:
            "UTM Campaign",

        utmTerm:
            "UTM Term",

        utmContent:
            "UTM Content",

        browserLocale:
            "Browser Locale",

        browserTimezone:
            "Browser Timezone",

        personality:
            "Personality"
    });
```

Do not require environment variables merely to name these fields unless the application has a specific need for runtime configuration.

This makes the integration easier for humans and coding agents to understand.

---

# 58. Creating Missing Kit Custom Fields

The Lambda should not assume that every custom field already exists.

Recommended behavior:

```text
Need custom field
      |
      v
Check in-memory Lambda cache
      |
      v
Search Kit custom fields
      |
      +--> found -> use existing key
      |
      +--> missing -> create field
                        |
                        v
                    cache key
```

This lets a newly integrated site begin using fields without requiring a separate manual setup step in Kit.

Cache custom field keys in module-level memory so warm Lambda invocations do not repeatedly search Kit.

Example conceptual cache:

```javascript
const kitCustomFieldKeyCache =
    new Map();
```

---

# 59. Mapping Attribution Into Kit

The Lambda should build a single `fields` object.

Conceptually:

```javascript
{
    campaign_code_key:
        registrationAttribution.campaignCode,

    country_key:
        registrationAttribution.country,

    registration_url_key:
        registrationAttribution.registrationUrl,

    registration_referrer_key:
        registrationAttribution.referrer,

    utm_source_key:
        registrationAttribution.utmSource,

    utm_medium_key:
        registrationAttribution.utmMedium,

    utm_campaign_key:
        registrationAttribution.utmCampaign,

    utm_term_key:
        registrationAttribution.utmTerm,

    utm_content_key:
        registrationAttribution.utmContent
}
```

Only add fields whose values exist.

Do not send meaningless blank strings.

Then update the subscriber with:

```text
PUT /subscribers/{subscriberId}
```

using:

```javascript
{
    fields
}
```

---

# 60. Do Not Depend on Kit Built-In Attribution

For this architecture, do not treat the Kit section:

```text
How they first found you
```

as the authoritative registration attribution source.

It may continue to show:

```text
Referrer       unknown
UTM Source     unknown
UTM Medium     unknown
UTM Campaign   unknown
UTM Term       unknown
UTM Content    unknown
```

even though the registration correctly supplied all values through Cognito.

The authoritative values for this integration are the custom fields:

```text
Registration Referrer
UTM Source
UTM Medium
UTM Campaign
UTM Term
UTM Content
```

An LLM should not attempt to "fix" the integration by repeatedly adding the subscriber to artificial Kit forms unless explicitly instructed to experiment with Kit-native attribution.

The tested custom-field pipeline is simpler and reliable.

---

# 61. Existing Kit Application Markers

Some applications may have additional Kit fields.

For example:

```text
dash-away-registration=true
```

Keep these separate from generic attribution.

Generic registration metadata:

```text
Campaign Code
Country
UTM Source
...
```

Application marker:

```text
dash-away-registration=true
```

This allows one registration-sync Lambda to support multiple applications while preserving application-specific behavior.

---

# 62. Registration Tags

A generic signup tag such as:

```text
new-signup
```

may also be applied after the subscriber has been created.

The Lambda should:

```text
Find existing tag by name
or
Create tag if missing
then
Apply tag to subscriber
```

Like custom field IDs, tag IDs may be cached across warm Lambda invocations.

---

# 63. Adding New Arbitrary Metadata

The registration system is intentionally extensible.

Suppose a site wants to add:

```html
<input
    type="hidden"
    data-register-personality
    value="scrumtuous"
>
```

Adding the HTML control alone is not sufficient.

The property must be explicitly supported through every layer.

The integration path is:

```text
register.html
        |
        v
auth-forms.js
        |
        v
ClientMetadata
        |
        v
auth.js
        |
        v
ConfirmSignUp
        |
        v
Post Confirmation
        |
        v
registration-sync Lambda
        |
        v
Kit custom field
```

For `personality`, the required changes are:

### HTML

```html
<input
    type="hidden"
    data-register-personality
    value="scrumtuous"
>
```

### auth-forms.js

Read:

```javascript
const personality =
    emailForm
        .querySelector(
            "[data-register-personality]"
        )
        ?.value
        ?.trim() || "";
```

Add to registration context:

```javascript
if (personality) {
    context.personality =
        personality;
}
```

### Cognito

No special change is required once `auth.js` already sends the whole normalized registration context as `ClientMetadata`.

### Lambda mapping

Add:

```javascript
[
    "personality",
    "personality"
]
```

to the registration-attribution mapping.

### Kit

Add:

```javascript
personality:
    "Personality"
```

to the Kit custom-field labels.

This pattern applies to future fields such as:

```text
site_code
product
exam
course
landing_page
content_category
affiliate_code
registration_variant
```

---

# 64. Recommended Multi-Site Extension

When the same backend supports several static websites, add:

```text
site_code
```

as a separate field.

Do not overload `campaign_code` to represent the website.

Example:

```html
<input
    type="hidden"
    data-register-site-code
    value="theserverside"
>
```

and:

```html
<input
    type="hidden"
    data-register-campaign-code
    value="CLAUDE30"
>
```

These represent different information:

```text
site_code
    Where did registration happen?

campaign_code
    Which campaign generated it?
```

Example metadata:

```javascript
{
    site_code:
        "theserverside",

    campaign_code:
        "CLAUDE30",

    utm_source:
        "linkedin",

    utm_campaign:
        "claude-course"
}
```

A corresponding Kit custom field could be:

```text
Registration Site
```

This makes one backend reusable across many websites.

---

# 65. What Should Be Shared Across Sites

For maximum reuse, keep these files structurally consistent across websites:

```text
auth.js
auth-forms.js
register.html data-* contract
```

Values that should remain standardized include:

```text
campaign_code
site_code
referrer
registration_url
utm_source
utm_medium
utm_campaign
utm_term
utm_content
marketing_consent
browser_locale
browser_timezone
country
country_source
personality
```

A site may omit fields it does not use.

Do not create different names such as:

```text
campaignCode
campaign-code
campaignName
campaign_identifier
```

on different sites.

The frontend wire contract should stay snake_case.

---

# 66. What May Differ Per Site

The following may legitimately differ:

```text
Cognito User Pool
Cognito App Client ID
authentication paths
post-login redirect
site_code
default campaign_code
application-specific hidden fields
application-specific Post Confirmation Lambda
application-specific DynamoDB initialization
application-specific Kit marker fields
```

The attribution transport mechanism should remain the same.

---

# 67. Minimal New-Site Integration Checklist

When an LLM is asked to add this system to another static site, perform the following in order.

## Step 1: Inspect Existing Authentication

Identify:

```text
register.html
login.html
auth.js
auth-forms.js
auth-config.js
Cognito User Pool
Cognito App Client
SignUp function
ConfirmSignUp function
pending-registration storage
Post Confirmation Lambda
downstream registration/profile Lambda
```

Do not write code until these are understood.

## Step 2: Add HTML Configuration

At minimum:

```html
<input
    type="hidden"
    data-register-campaign-code
    value=""
>

<input
    type="hidden"
    data-register-utm-source
    value=""
>

<input
    type="hidden"
    data-register-utm-medium
    value=""
>

<input
    type="hidden"
    data-register-utm-campaign
    value=""
>

<input
    type="hidden"
    data-register-utm-term
    value=""
>

<input
    type="hidden"
    data-register-utm-content
    value=""
>

<input
    type="hidden"
    data-register-country
    value=""
>
```

Optional site identity:

```html
<input
    type="hidden"
    data-register-site-code
    value="example-site"
>
```

## Step 3: Confirm auth-forms.js Builds Context

It should collect:

```text
campaign
UTMs
referrer
registration URL
consent
locale
timezone
country
optional extra fields
```

## Step 4: Confirm auth.js Sends ClientMetadata

Both:

```text
SignUp
ConfirmSignUp
```

must contain the same metadata.

## Step 5: Inspect Post Confirmation Lambda

Confirm it receives:

```javascript
event.request.clientMetadata
```

If it invokes another Lambda, confirm the original event is forwarded.

## Step 6: Update Registration Sync

Confirm it:

```text
normalizes ClientMetadata
builds registrationAttribution
stores original attribution
honors marketing consent
syncs to Kit
sets custom fields
applies tags
```

## Step 7: Test End to End

Use a brand-new email address.

Verify:

```text
Cognito user created
email verification succeeds
application profile created
registrationAttribution stored
Kit subscriber created
Campaign Code appears
Country appears
Registration URL appears
Registration Referrer appears when available
UTM Source appears
UTM Medium appears
UTM Campaign appears
UTM Term appears
UTM Content appears
Browser Locale appears
Browser Timezone appears
application marker appears
new-signup tag appears
```

Do not use Kit's built-in attribution panel as the acceptance criterion.

---

# 68. Recommended Test Registration

For an integration test, configure:

```html
<input
    type="hidden"
    data-register-campaign-code
    value="integration-test"
>

<input
    type="hidden"
    data-register-utm-source
    value="test-source"
>

<input
    type="hidden"
    data-register-utm-medium
    value="test-medium"
>

<input
    type="hidden"
    data-register-utm-campaign
    value="test-campaign"
>

<input
    type="hidden"
    data-register-utm-term
    value="test-term"
>

<input
    type="hidden"
    data-register-utm-content
    value="test-content"
>

<input
    type="hidden"
    data-register-country
    value="CA"
>
```

Use a fresh email.

Expected Kit custom fields:

```text
Campaign Code
integration-test

Country
CA

UTM Source
test-source

UTM Medium
test-medium

UTM Campaign
test-campaign

UTM Term
test-term

UTM Content
test-content
```

Also expect:

```text
Registration URL
<actual registration page>

Browser Locale
<browser locale>

Browser Timezone
<browser timezone>
```

`Registration Referrer` may legitimately be absent when the registration page was opened directly.

---

# 69. Debugging Order

When data is missing, debug in this order.

## Layer 1: HTML

Verify the hidden field exists and contains the expected value.

Example:

```html
<input
    type="hidden"
    data-register-utm-source
    value="linkedin"
>
```

## Layer 2: auth-forms.js

Log or inspect the generated registration context.

Expected:

```javascript
{
    utm_source:
        "linkedin"
}
```

## Layer 3: Cognito SignUp

Browser Developer Tools:

```text
Network
AWSCognitoIdentityProviderService.SignUp
```

Verify:

```javascript
ClientMetadata.utm_source
```

## Layer 4: Cognito ConfirmSignUp

Verify:

```javascript
ClientMetadata.utm_source
```

again.

This is critical.

## Layer 5: Post Confirmation Lambda

Temporarily log safe metadata:

```javascript
console.log({
    campaignCode:
        event?.request
            ?.clientMetadata
            ?.campaign_code,

    utmSource:
        event?.request
            ?.clientMetadata
            ?.utm_source
});
```

Do not dump sensitive URLs or tokens unnecessarily.

## Layer 6: Registration Sync Lambda

Verify its log shows:

```text
campaignCode
utmSource
utmCampaign
country
```

## Layer 7: Kit

Check the custom fields, not the native attribution panel.

This layered debugging process makes it easy to locate exactly where a value disappeared.

---

# 70. Critical LLM Instructions

When giving this integration to a coding LLM, include the following instructions.

```text
This system already has a working architecture.

Do not redesign authentication.

Do not replace Cognito.

Do not introduce OAuth or the Cognito Hosted UI unless specifically requested.

Do not introduce React, Vue, Angular, jQuery, or another frontend framework.

Do not introduce a registration API just to transport marketing metadata.

Registration attribution travels through Cognito ClientMetadata.

The same ClientMetadata must be sent with both SignUp and ConfirmSignUp.

Post Confirmation receives the metadata at event.request.clientMetadata.

If a Post Confirmation Lambda forwards registration to another Lambda, preserve the original Cognito event so clientMetadata is not lost.

The registration/profile sync Lambda owns DynamoDB persistence and Kit synchronization.

Do not create a Stripe customer during registration. Stripe customer creation belongs to checkout or purchase workflows.

Kit's built-in "How they first found you" Referrer and UTM panel is not the authoritative source for API registrations in this architecture.

Store Referrer and UTM values as ordinary Kit custom fields.

Use the hard-coded Kit field labels already established by the application.

Create missing Kit custom fields automatically when practical.

Respect marketing_consent=false by allowing the Cognito/application registration to succeed while skipping marketing synchronization.

Treat ClientMetadata as untrusted input. Never use campaign codes, UTM values, referrer, country, or similar frontend-supplied metadata to grant entitlements, credits, refunds, permissions, or paid access.

Preserve existing Cognito username strategy, login flow, logout flow, token handling, redirects, styling, DynamoDB structure, and application behavior unless a change is specifically required for this integration.

When adding a new metadata field, trace it through every layer:

register.html
-> auth-forms.js
-> registrationContext
-> auth.js
-> Cognito ClientMetadata
-> pending registration state
-> ConfirmSignUp
-> Post Confirmation event
-> downstream Lambda
-> registrationAttribution
-> DynamoDB if appropriate
-> Kit custom field if appropriate

Do not assume that adding an HTML hidden field automatically sends it. Every new field must be explicitly collected by auth-forms.js unless the implementation has been deliberately generalized to support arbitrary fields.

After making changes, test with a brand-new email and verify both Cognito API requests and the final Kit custom fields.
```

---

# 71. Concise Implementation Prompt for Another LLM

Use this prompt when integrating the already-working system into another static website:

```text
Integrate the existing Cognito registration attribution and Kit synchronization pattern into this static website.

First inspect the site's existing registration form, auth-forms.js, auth.js, auth-config.js, Cognito SignUp flow, ConfirmSignUp flow, pending registration storage, Cognito Post Confirmation Lambda, and any downstream registration/profile Lambda.

Preserve the existing authentication architecture.

The frontend must collect optional registration attribution and send it through Cognito ClientMetadata.

Support the standard fields:

site_code
campaign_code
referrer
registration_url
utm_source
utm_medium
utm_campaign
utm_term
utm_content
marketing_consent
browser_locale
browser_timezone
country
country_source
personality

A site does not need to use every field.

HTML hidden fields provide easy-to-edit defaults. Query-string campaign and UTM values should override HTML defaults where the established implementation already supports that behavior.

auth-forms.js owns browser/DOM collection.

auth.js owns Cognito communication.

Auth.register.start() must accept the registration context and include normalized ClientMetadata with Cognito SignUp.

Store the metadata with pending registration state.

Send the exact same metadata again with Cognito ConfirmSignUp.

The Cognito Post Confirmation Lambda receives the values at event.request.clientMetadata.

If that Lambda invokes another registration/profile Lambda, preserve the entire original Cognito event using the existing forwarding pattern rather than reconstructing only selected fields.

The registration/profile Lambda should normalize the ClientMetadata, construct a registrationAttribution object, optionally preserve the original attribution in DynamoDB, and synchronize consented verified subscribers to Kit.

Do not create Stripe customers during registration.

For Kit, use ordinary custom fields rather than Kit's built-in "How they first found you" attribution panel.

The standard Kit custom field labels are:

Registration Site
Campaign Code
Country
Country Source
Registration URL
Registration Referrer
UTM Source
UTM Medium
UTM Campaign
UTM Term
UTM Content
Browser Locale
Browser Timezone
Personality

Only populate values that actually exist.

Respect marketing_consent=false by skipping Kit marketing synchronization without affecting Cognito registration or application access.

Treat all ClientMetadata as untrusted marketing context.

Do not use it for authorization, entitlements, paid access, credits, refunds, discounts, or permissions.

Do not redesign unrelated authentication, application, UI, DynamoDB, payment, or checkout behavior.

After implementation, test with a new email address and verify:

1. SignUp contains ClientMetadata.
2. ConfirmSignUp contains the same ClientMetadata.
3. Post Confirmation receives event.request.clientMetadata.
4. Any downstream Lambda receives the metadata.
5. DynamoDB registrationAttribution is correct if enabled.
6. Kit custom fields contain the expected campaign, UTM, referrer, country, URL, locale, timezone, and optional site-specific values.
7. Existing registration, login, logout, token refresh, redirects, and checkout behavior continue to work.
```

---

# 72. Mental Model for Future Maintainers

The simplest way to understand the system is:

```text
REGISTER.HTML
"What context should accompany this registration?"

        ↓

AUTH-FORMS.JS
"Collect context from HTML, URL and browser."

        ↓

AUTH.JS
"Transport context through Cognito."

        ↓

COGNITO
"Verify identity and carry the metadata."

        ↓

POST CONFIRMATION
"The email has now been verified."

        ↓

REGISTRATION PROFILE LAMBDA
"Turn the raw registration event into durable business data."

        ↓

DYNAMODB
"Remember original account-registration context."

        ↓

KIT
"Store marketing context as subscriber custom fields."
```

Each layer has one clear responsibility.

That separation is intentional and should be preserved when integrating the pattern into other sites.

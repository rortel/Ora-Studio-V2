# Quickstart

> Get started with the Zernio API - authenticate, connect accounts, and schedule your first post in minutes.

Source: Zernio API Documentation (https://docs.zernio.com)
API Base URL: https://zernio.com/api/v1

---

# Quickstart

Get started with the Zernio API - authenticate, connect accounts, and schedule your first post in minutes.

import { Tab, Tabs } from 'fumadocs-ui/components/tabs';

Zernio is a social media scheduling platform that lets you manage and publish content across all major platforms from a single API. Whether you're building a social media tool, automating your content workflow, or managing multiple brands, Zernio's API gives you complete control.

**Base URL:** `https://zernio.com/api/v1`

---

## Install the SDK

<Tabs items={['Node.js', 'Python', 'Go', 'Ruby', 'Java', 'PHP', '.NET', 'Rust']}>
<Tab value="Node.js">
```bash
npm install @zernio/node
```
</Tab>
<Tab value="Python">
```bash
pip install zernio-sdk
```
</Tab>
<Tab value="Go">
```bash
go get github.com/zernio-dev/zernio-go
```
</Tab>
<Tab value="Ruby">
```bash
gem install zernio-sdk
```
</Tab>
<Tab value="Java">
```xml
<dependency>
  <groupId>com.zernio</groupId>
  <artifactId>zernio-sdk</artifactId>
  <version>1.0.1</version>
</dependency>
```
</Tab>
<Tab value="PHP">
```bash
composer require zernio-dev/zernio-php
```
</Tab>
<Tab value=".NET">
```bash
dotnet add package Zernio
```
</Tab>
<Tab value="Rust">
```bash
cargo add zernio
```
</Tab>
</Tabs>

## Authentication

All API requests require an API key. The SDKs read from the `ZERNIO_API_KEY` environment variable by default.

### Getting Your API Key

1. Log in to your Zernio account at [zernio.com](https://zernio.com)
2. Go to **Settings → API Keys**
3. Click **Create API Key**
4. Copy the key immediately - you won't be able to see it again

### Set Up the Client

<Tabs items={['Node.js', 'Python', 'curl']}>
<Tab value="Node.js">
```typescript
import Zernio from '@zernio/node';

const zernio = new Zernio(); // uses ZERNIO_API_KEY env var
```
</Tab>
<Tab value="Python">
```python
from zernio import Zernio

client = Zernio() # uses ZERNIO_API_KEY env var
```
</Tab>
<Tab value="curl">
```bash
# Set your API key as an environment variable
export ZERNIO_API_KEY="sk_..."

# All requests use the Authorization header
curl https://zernio.com/api/v1/posts \
  -H "Authorization: Bearer $ZERNIO_API_KEY"
```
</Tab>
</Tabs>

**Key format:** `sk_` prefix + 64 hex characters (67 total). Keys are stored as SHA-256 hashes - they're only shown once at creation.

**Security tips:** Use environment variables, create separate keys per app, and rotate periodically. You can also [manage keys via the API](/api-keys/list-api-keys).

---

## Key Concepts

- **Profiles** - Containers that group social accounts together (think "brands" or "projects")
- **Accounts** - Your connected social media accounts, belonging to profiles
- **Posts** - Content to publish, schedulable to multiple accounts across platforms simultaneously
- **Queue** - Optional recurring time slots for auto-scheduling posts

---

## Step 1: Create a Profile

Profiles group your social accounts together. For example, you might have a "Personal Brand" profile with your Twitter and LinkedIn, and a "Company" profile with your business accounts.

<Tabs items={['Node.js', 'Python', 'curl']}>
<Tab value="Node.js">
```typescript
const { profile } = await zernio.profiles.createProfile({
  name: 'My First Profile',
  description: 'Testing the Zernio API'
});

console.log('Profile created:', profile._id);
```
</Tab>
<Tab value="Python">
```python
result = client.profiles.create(
    name="My First Profile",
    description="Testing the Zernio API"
)

print(f"Profile created: {result.profile['_id']}")
```
</Tab>
<Tab value="curl">
```bash
curl -X POST https://zernio.com/api/v1/profiles \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Profile",
    "description": "Testing the Zernio API"
  }'
```
</Tab>
</Tabs>

Save the `_id` value - you'll need it for the next steps.

## Step 2: Connect a Social Account

Now connect a social media account to your profile. This uses OAuth, so it will redirect to the platform for authorization.

<Tabs items={['Node.js', 'Python', 'curl']}>
<Tab value="Node.js">
```typescript
const { authUrl } = await zernio.connect.getConnectUrl({
  platform: 'twitter',
  profileId: 'prof_abc123'
});

// Redirect user to this URL to authorize
console.log('Open this URL:', authUrl);
```
</Tab>
<Tab value="Python">
```python
result = client.connect.get_connect_url(
    platform="twitter",
    profile_id="prof_abc123"
)

print(f"Open this URL: {result.auth_url}")
```
</Tab>
<Tab value="curl">
```bash
curl "https://zernio.com/api/v1/connect/twitter?profileId=prof_abc123" \
  -H "Authorization: Bearer $ZERNIO_API_KEY"
```
</Tab>
</Tabs>

Open the URL in a browser to authorize Zernio to access your Twitter account. After authorization, you'll be redirected back and the account will be connected.

### Available Platforms

Replace `twitter` with any of these:

| Platform | API Value | Guide |
|----------|-----------|-------|
| Twitter/X | `twitter` | [Twitter Guide](/platforms/twitter) |
| Instagram | `instagram` | [Instagram Guide](/platforms/instagram) |
| Facebook Pages | `facebook` | [Facebook Guide](/platforms/facebook) |
| LinkedIn | `linkedin` | [LinkedIn Guide](/platforms/linkedin) |
| TikTok | `tiktok` | [TikTok Guide](/platforms/tiktok) |
| YouTube | `youtube` | [YouTube Guide](/platforms/youtube) |
| Pinterest | `pinterest` | [Pinterest Guide](/platforms/pinterest) |
| Reddit | `reddit` | [Reddit Guide](/platforms/reddit) |
| Bluesky | `bluesky` | [Bluesky Guide](/platforms/bluesky) |
| Threads | `threads` | [Threads Guide](/platforms/threads) |
| Google Business | `googlebusiness` | [Google Business Guide](/platforms/google-business) |
| Telegram | `telegram` | [Telegram Guide](/platforms/telegram) |
| Snapchat | `snapchat` | [Snapchat Guide](/platforms/snapchat) |

## Step 3: Get Your Connected Accounts

After connecting, list your accounts to get the account ID:

<Tabs items={['Node.js', 'Python', 'curl']}>
<Tab value="Node.js">
```typescript
const { accounts } = await zernio.accounts.listAccounts();

for (const account of accounts) {
  console.log(`${account.platform}: ${account._id}`);
}
```
</Tab>
<Tab value="Python">
```python
result = client.accounts.list()

for account in result.accounts:
    print(f"{account['platform']}: {account['_id']}")
```
</Tab>
<Tab value="curl">
```bash
curl "https://zernio.com/api/v1/accounts" \
  -H "Authorization: Bearer $ZERNIO_API_KEY"
```
</Tab>
</Tabs>

Save the account `_id` - you need it to create posts.

## Step 4: Schedule Your First Post

Now you can schedule a post! Here's how to schedule a tweet for tomorrow at noon:

<Tabs items={['Node.js', 'Python', 'curl']}>
<Tab value="Node.js">
```typescript
const { post } = await zernio.posts.createPost({
  content: 'Hello world! This is my first post from the Zernio API',
  scheduledFor: '2024-01-16T12:00:00',
  timezone: 'America/New_York',
  platforms: [
    { platform: 'twitter', accountId: 'acc_xyz789' }
  ]
});

console.log('Post scheduled:', post._id);
```
</Tab>
<Tab value="Python">
```python
result = client.posts.create(
    content="Hello world! This is my first post from the Zernio API",
    scheduled_for="2024-01-16T12:00:00",
    timezone="America/New_York",
    platforms=[
        {"platform": "twitter", "accountId": "acc_xyz789"}
    ]
)

print(f"Post scheduled: {result.post['_id']}")
```
</Tab>
<Tab value="curl">
```bash
curl -X POST https://zernio.com/api/v1/posts \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello world! This is my first post from the Zernio API",
    "scheduledFor": "2024-01-16T12:00:00",
    "timezone": "America/New_York",
    "platforms": [
      {"platform": "twitter", "accountId": "acc_xyz789"}
    ]
  }'
```
</Tab>
</Tabs>

Your post is now scheduled and will publish automatically at the specified time.

## Posting to Multiple Platforms

You can post to multiple platforms at once. Just add more entries to the `platforms` array:

<Tabs items={['Node.js', 'Python', 'curl']}>
<Tab value="Node.js">
```typescript
const { post } = await zernio.posts.createPost({
  content: 'Cross-posting to all my accounts!',
  scheduledFor: '2024-01-16T12:00:00',
  timezone: 'America/New_York',
  platforms: [
    { platform: 'twitter', accountId: 'acc_twitter123' },
    { platform: 'linkedin', accountId: 'acc_linkedin456' },
    { platform: 'bluesky', accountId: 'acc_bluesky789' }
  ]
});
```
</Tab>
<Tab value="Python">
```python
result = client.posts.create(
    content="Cross-posting to all my accounts!",
    scheduled_for="2024-01-16T12:00:00",
    timezone="America/New_York",
    platforms=[
        {"platform": "twitter", "accountId": "acc_twitter123"},
        {"platform": "linkedin", "accountId": "acc_linkedin456"},
        {"platform": "bluesky", "accountId": "acc_bluesky789"}
    ]
)
```
</Tab>
<Tab value="curl">
```bash
curl -X POST https://zernio.com/api/v1/posts \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Cross-posting to all my accounts!",
    "scheduledFor": "2024-01-16T12:00:00",
    "timezone": "America/New_York",
    "platforms": [
      {"platform": "twitter", "accountId": "acc_twitter123"},
      {"platform": "linkedin", "accountId": "acc_linkedin456"},
      {"platform": "bluesky", "accountId": "acc_bluesky789"}
    ]
  }'
```
</Tab>
</Tabs>

## Publishing Immediately

To publish right now instead of scheduling, use `publishNow: true`:

<Tabs items={['Node.js', 'Python', 'curl']}>
<Tab value="Node.js">
```typescript
const { post } = await zernio.posts.createPost({
  content: 'This posts immediately!',
  publishNow: true,
  platforms: [
    { platform: 'twitter', accountId: 'acc_xyz789' }
  ]
});
```
</Tab>
<Tab value="Python">
```python
result = client.posts.create(
    content="This posts immediately!",
    publish_now=True,
    platforms=[
        {"platform": "twitter", "accountId": "acc_xyz789"}
    ]
)
```
</Tab>
<Tab value="curl">
```bash
curl -X POST https://zernio.com/api/v1/posts \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This posts immediately!",
    "publishNow": true,
    "platforms": [
      {"platform": "twitter", "accountId": "acc_xyz789"}
    ]
  }'
```
</Tab>
</Tabs>

## Creating a Draft

To save a post without publishing or scheduling, omit both `scheduledFor` and `publishNow`:

<Tabs items={['Node.js', 'Python', 'curl']}>
<Tab value="Node.js">
```typescript
const { post } = await zernio.posts.createPost({
  content: 'I will finish this later...',
  platforms: [
    { platform: 'twitter', accountId: 'acc_xyz789' }
  ]
});
```
</Tab>
<Tab value="Python">
```python
result = client.posts.create(
    content="I will finish this later...",
    platforms=[
        {"platform": "twitter", "accountId": "acc_xyz789"}
    ]
)
```
</Tab>
<Tab value="curl">
```bash
curl -X POST https://zernio.com/api/v1/posts \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I will finish this later...",
    "platforms": [
      {"platform": "twitter", "accountId": "acc_xyz789"}
    ]
  }'
```
</Tab>
</Tabs>

## What's Next?

- **[Platform Guides](/platforms)** - Learn platform-specific features and requirements
- **[Upload media](/guides/media-uploads)** - Add images and videos to your posts
- **[Set up a queue](/queue/list-queue-slots)** - Create recurring posting schedules
- **[View analytics](/analytics/get-analytics)** - Track how your posts perform
- **[Invite team members](/invites/create-invite-token)** - Collaborate with your team
- **[CLI](/resources/cli)** - Manage posts from the terminal
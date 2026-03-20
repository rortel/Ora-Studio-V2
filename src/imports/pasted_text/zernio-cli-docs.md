# CLI

> Schedule and manage social media posts across 14 platforms from the terminal. Built for developers and AI agents.

Source: Zernio API Documentation (https://docs.zernio.com)
API Base URL: https://zernio.com/api/v1

---

# CLI

Schedule and manage social media posts across 14 platforms from the terminal. Built for developers and AI agents.

import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';
import { Step, Steps } from 'fumadocs-ui/components/steps';

Schedule and manage social media posts across 14 platforms from the terminal. Built for developers and AI agents. Outputs JSON by default.

## Setup

<Steps>

<Step>
### Install the CLI

```bash
npm install -g zernio
```
</Step>

<Step>
### Authenticate

<Tabs items={['Browser Login (Recommended)', 'Manual API Key']}>

<Tab value="Browser Login (Recommended)">

```bash
zernio auth:login
```

This opens your browser where you can authorize the CLI. An API key is created automatically and saved to `~/.zernio/config.json`.

You can optionally set a custom device name:

```bash
zernio auth:login --device-name "my-server"
```

Running `auth:login` again from the same device replaces the existing key (no duplicates).

</Tab>

<Tab value="Manual API Key">

```bash
zernio auth:set --key "sk_your-api-key"
```

Get your API key from [zernio.com/dashboard/api-keys](https://zernio.com/dashboard/api-keys).

</Tab>

</Tabs>

</Step>

<Step>
### Verify Setup

```bash
zernio auth:check
```

This should confirm your API key is valid and display your account info.
</Step>

</Steps>

## Quick Example

```bash
# Schedule a post for tomorrow at 9am
zernio posts:create \
  --text "Hello from the Zernio CLI!" \
  --accounts <accountId1>,<accountId2> \
  --scheduledAt "2025-06-01T09:00:00Z"
```

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `zernioauth:login` | Log in via browser (creates API key automatically) |
| `zernioauth:set --key <key>` | Save API key manually |
| `zernioauth:check` | Verify API key works |

### Profiles

| Command | Description |
|---------|-------------|
| `zernioprofiles:list` | List all profiles |
| `zernioprofiles:get <id>` | Get profile details |
| `zernioprofiles:create --name <name>` | Create a new profile |
| `zernioprofiles:update <id>` | Update a profile |
| `zernioprofiles:delete <id>` | Delete a profile |

### Accounts

| Command | Description |
|---------|-------------|
| `zernioaccounts:list` | List connected social accounts |
| `zernioaccounts:get <id>` | Get account details |
| `zernioaccounts:health` | Check account health status |

### Posts

| Command | Description |
|---------|-------------|
| `zernioposts:create` | Create a new post |
| `zernioposts:list` | List posts |
| `zernioposts:get <id>` | Get post details |
| `zernioposts:delete <id>` | Delete a post |
| `zernioposts:retry <id>` | Retry a failed post |

### Analytics

| Command | Description |
|---------|-------------|
| `zernioanalytics:posts` | Get post performance metrics |
| `zernioanalytics:daily` | Get daily engagement stats |
| `zernioanalytics:best-time` | Get best times to post |

### Media

| Command | Description |
|---------|-------------|
| `zerniomedia:upload <file>` | Upload a media file |

## Configuration

The CLI stores settings in `~/.zernio/config.json`. You can also use environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `ZERNIO_API_KEY` | Your API key | Yes |
| `ZERNIO_API_URL` | Custom API endpoint | No |

Environment variables override the config file.

## Supported Platforms

Instagram, TikTok, X (Twitter), LinkedIn, Facebook, Threads, YouTube, Bluesky, Pinterest, Reddit, Snapchat, Telegram, and Google Business Profile.

## Links

- [GitHub Repository](https://github.com/zernio-dev/zernio-cli)
- [ClawHub Repository](https://clawhub.ai/mikipalet/zernio-cli)
- [npm Package](https://www.npmjs.com/package/zernio)
- [SDKs](/resources/sdks)
- [Zernio Dashboard](https://zernio.com)
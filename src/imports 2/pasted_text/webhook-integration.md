> ## Documentation Index
> Fetch the complete documentation index at: https://docs.higgsfield.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Webhook Integration

> Guide to using webhooks with the Higgsfield API

## Overview

Webhooks allow you to receive automatic notifications when your generation requests reach a final status. Instead of polling the status endpoint, the Higgsfield API will send an HTTP POST request to your specified webhook URL.

## Configuration

To enable webhook notifications, include the `hf_webhook` query parameter in your generation request with your webhook endpoint URL.

### Example Request

```bash  theme={null}
curl -X POST 'https://platform.higgsfield.ai/higgsfield-ai/soul/standard?hf_webhook=https://webhook.url/example' \
  --header 'Authorization: Key {your_api_key}:{your_api_key_secret}' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --data '{
    "prompt": "your prompt here",
    "aspect_ratio": "16:9",
    "resolution": "720p"
  }'
```

## Webhook Notifications

Your webhook endpoint will receive an HTTP POST request when the generation reaches a final status: `completed`, `failed`, or `nsfw`.

### Completed Status

#### Image Generation

```json  theme={null}
{
  "status": "completed",
  "request_id": "9417a243-e457-4075-895b-b68f3cda5303",
  "status_url": "https://platform.higgsfield.ai/requests/9417a243-e457-4075-895b-b68f3cda5303/status",
  "cancel_url": "https://platform.higgsfield.ai/requests/9417a243-e457-4075-895b-b68f3cda5303/cancel",
  "images": [
    {
      "url": "https://images.url/example"
    }
  ]
}
```

#### Video Generation

```json  theme={null}
{
  "status": "completed",
  "request_id": "9417a243-e457-4075-895b-b68f3cda5303",
  "status_url": "https://platform.higgsfield.ai/requests/9417a243-e457-4075-895b-b68f3cda5303/status",
  "cancel_url": "https://platform.higgsfield.ai/requests/9417a243-e457-4075-895b-b68f3cda5303/cancel",
  "video": {
    "url": "https://video.url/example"
  }
}
```

### Failed Status

```json  theme={null}
{
  "status": "failed",
  "request_id": "9417a243-e457-4075-895b-b68f3cda5303",
  "error": "Generation fail message"
}
```

### NSFW Status

```json  theme={null}
{
  "status": "nsfw",
  "request_id": "9417a243-e457-4075-895b-b68f3cda5303"
}
```

## Retry Logic

The Higgsfield API implements automatic retry logic to ensure reliable webhook delivery:

* Webhooks will be retried for up to **2 hours** after the initial delivery attempt
* Retries continue until your endpoint returns a successful response (HTTP `2xx` status code)
* If your endpoint remains unavailable or continues to return error responses after 2 hours, retry attempts will cease
* You can still retrieve the generation results by polling the `status_url` if webhook delivery fails

### Handling Retries

To minimize unnecessary retries:

* Ensure your webhook endpoint is highly available
* Return a `2xx` status code promptly upon successful receipt
* Implement idempotency using the `request_id` to handle duplicate notifications
* Log received webhooks to track delivery patterns

## Webhook Requirements

* Your webhook endpoint must accept HTTP POST requests
* Your endpoint should respond with a `2xx` status code to acknowledge receipt
* The webhook payload will be sent as JSON in the request body
* Ensure your endpoint is publicly accessible and can handle the expected request volume

## Best Practices

* Implement proper error handling for webhook deliveries
* Validate the `request_id` to ensure the notification matches your records
* Store webhook payloads for audit and debugging purposes
* Use HTTPS endpoints for secure data transmission
* Respond quickly to webhook requests (under 10 seconds) to avoid timeouts
* Implement idempotency checks to safely handle duplicate webhook deliveries during retries


Built with [Mintlify](https://mintlify.com).
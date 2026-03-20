> ## Documentation Index
> Fetch the complete documentation index at: https://docs.higgsfield.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Client Libraries

> Official SDKs and client libraries for seamless integration with Higgsfield API

Higgsfield provides official client libraries to simplify integration with our API. These libraries handle authentication, request management, and provide a developer-friendly interface for all platform features.

## Supported Languages

We currently support the following languages:

<CardGroup cols={2}>
  <Card title="Python" icon="python" href="https://pypi.org/project/higgsfield-client/">
    Full-featured SDK with sync and async support
  </Card>

  <Card title="JavaScript/TypeScript" icon="js" iconType="duotone">
    Coming soon
  </Card>
</CardGroup>

Have a specific language in mind? Let us know in our community channels, and we'll consider adding support for it in future releases.

## Python SDK

The official Python SDK for [Higgsfield AI](https://cloud.higgsfield.ai). Supports both synchronous and asynchronous usage.

### Installation

Install the Higgsfield Python client using pip:

```bash  theme={null}
pip install higgsfield-client
```

### Authentication

Before using the client, set your API credentials as environment variables. You can use either a single key or separate API key and secret:

**Option 1: Single Key**

```bash  theme={null}
export HF_KEY="your-api-key:your-api-secret"
```

**Option 2: API Key + Secret**

```bash  theme={null}
export HF_API_KEY="your-api-key"
export HF_API_SECRET="your-api-secret"
```

Get your credentials from the [Higgsfield Cloud](https://cloud.higgsfield.ai/).

### Quick Start

<CodeGroup>
  ```python sync icon="python" theme={null}
  import higgsfield_client

  # Submit and wait for result
  result = higgsfield_client.subscribe(
      'bytedance/seedream/v4/text-to-image',
      arguments={
          'prompt': 'A serene lake at sunset with mountains',
          'resolution': '2K',
          'aspect_ratio': '16:9',
          'camera_fixed': False
      }
  )

  print(result['images'][0]['url'])
  ```

  ```python async icon="python" theme={null}
  import asyncio
  import higgsfield_client

  async def main():
      # Submit and wait for result
      result = await higgsfield_client.subscribe_async(
          'bytedance/seedream/v4/text-to-image',
          arguments={
              'prompt': 'A serene lake at sunset with mountains',
              'resolution': '2K',
              'aspect_ratio': '16:9',
              'camera_fixed': False
          }
      )

      print(result['images'][0]['url'])

  asyncio.run(main())
  ```
</CodeGroup>

## Usage Patterns

### Pattern 1: Simple Submit and Wait

Submit a request and wait for the result.

<CodeGroup>
  ```python sync icon="python" theme={null}
  import higgsfield_client

  result = higgsfield_client.subscribe(
      'bytedance/seedream/v4/text-to-image',
      arguments={
          'prompt': 'A serene lake at sunset with mountains',
          'resolution': '2K',
          'aspect_ratio': '16:9',
          'camera_fixed': False
      }
  )

  print(result['images'][0]['url'])
  ```

  ```python async icon="python" theme={null}
  import asyncio
  import higgsfield_client

  async def main():
      result = await higgsfield_client.subscribe_async(
          'bytedance/seedream/v4/text-to-image',
          arguments={
              'prompt': 'A serene lake at sunset with mountains',
              'resolution': '2K',
              'aspect_ratio': '16:9',
              'camera_fixed': False
          }
      )
      
      print(result['images'][0]['url'])

  asyncio.run(main())
  ```
</CodeGroup>

### Pattern 2: Submit and Track Progress

Submit a request and monitor its status in real-time.

<CodeGroup>
  ```python sync icon="python" theme={null}
  import higgsfield_client

  request_controller = higgsfield_client.submit(
      'bytedance/seedream/v4/text-to-image',
      arguments={
          'prompt': 'Football ball',
          'resolution': '2K',
          'aspect_ratio': '16:9',
          'camera_fixed': False
      },
      webhook_url='https://example.com/webhook'  # Optional webhook
  )

  for status in request_controller.poll_request_status():
      if isinstance(status, higgsfield_client.Queued):
          print('Queued')
      elif isinstance(status, higgsfield_client.InProgress):
          print('In progress')
      elif isinstance(status, higgsfield_client.Completed):
          print('Completed')
      elif isinstance(status, (higgsfield_client.Failed, higgsfield_client.NSFW, higgsfield_client.Cancelled)):
          print('Oops!')

  result = request_controller.get()
  print(result['images'][0]['url'])
  ```

  ```python async icon="python" theme={null}
  import asyncio
  import higgsfield_client

  async def main():
      request_controller = await higgsfield_client.submit_async(
          'bytedance/seedream/v4/text-to-image',
          arguments={
              'prompt': 'Football ball',
              'resolution': '2K',
              'aspect_ratio': '16:9',
              'camera_fixed': False
          },
          webhook_url='https://example.com/webhook'
      )

      async for status in request_controller.poll_request_status():
          if isinstance(status, higgsfield_client.Queued):
              print('Queued')
          elif isinstance(status, higgsfield_client.InProgress):
              print('In progress')
          elif isinstance(status, higgsfield_client.Completed):
              print('Completed')
          elif isinstance(status, (higgsfield_client.Failed, higgsfield_client.NSFW, higgsfield_client.Cancelled)):
              print('Oops!')

      result = await request_controller.get()
      print(result['images'][0]['url'])

  asyncio.run(main())
  ```
</CodeGroup>

### Pattern 3: Submit with Callbacks

Use callbacks to handle status updates.

<CodeGroup>
  ```python sync icon="python" theme={null}
  import higgsfield_client

  def on_enqueue(request_id):
      print(f'Request {request_id} was enqueued')

  def on_status_update(status):
      print(f'Status: {status}')

  result = higgsfield_client.subscribe(
      'bytedance/seedream/v4/text-to-image',
      arguments={
          'prompt': 'A serene lake at sunset with mountains',
          'resolution': '2K',
          'aspect_ratio': '16:9',
          'camera_fixed': False
      },
      on_enqueue=on_enqueue,
      on_queue_update=on_status_update
  )
  ```

  ```python async icon="python" theme={null}
  import asyncio
  import higgsfield_client

  def on_enqueue(request_id):
      print(f'Request {request_id} was enqueued')

  def on_status_update(status):
      print(f'Status: {status}')

  async def main():
      await higgsfield_client.subscribe_async(
          'bytedance/seedream/v4/text-to-image',
          arguments={
              'prompt': 'A serene lake at sunset with mountains',
              'resolution': '2K',
              'aspect_ratio': '16:9',
              'camera_fixed': False
          },
          on_enqueue=on_enqueue,
          on_queue_update=on_status_update
      )

  asyncio.run(main())
  ```
</CodeGroup>

### Pattern 4: Manage Existing Requests

Work with request controllers to manage requests.

<CodeGroup>
  ```python sync icon="python" theme={null}
  import higgsfield_client

  request_controller = higgsfield_client.submit(
      'bytedance/seedream/v4/text-to-image',
      arguments={
          'prompt': 'A serene lake at sunset with mountains',
          'resolution': '2K',
          'aspect_ratio': '16:9',
          'camera_fixed': False
      },
      webhook_url='https://example.com/webhook'
  )

  # Check status
  status = request_controller.status()

  # Wait for completion and get result
  result = request_controller.get()

  # Cancel a queued request
  request_controller.cancel()
  ```

  ```python async icon="python" theme={null}
  import asyncio
  import higgsfield_client

  async def main():
      request_controller = await higgsfield_client.submit_async(
          'bytedance/seedream/v4/text-to-image',
          arguments={
              'prompt': 'A serene lake at sunset with mountains',
              'resolution': '2K',
              'aspect_ratio': '16:9',
              'camera_fixed': False
          },
          webhook_url='https://example.com/webhook'
      )

      # Check status
      status = await request_controller.status()

      # Wait for completion and get result
      result = await request_controller.get()

      # Cancel a queued request
      await request_controller.cancel()

  asyncio.run(main())
  ```
</CodeGroup>

## File Uploads

Upload files to use in your requests.

### Upload Bytes

<CodeGroup>
  ```python sync icon="python" theme={null}
  import higgsfield_client

  image_path = 'path/to/example.jpeg'
  content_type = 'image/jpeg'

  with open(image_path, 'rb') as f:
      data = f.read()

  url = higgsfield_client.upload(data, content_type)

  # Upload path
  image_path = 'path/to/example.jpeg'

  url = higgsfield_client.upload_file(image_path)


  # Upload PIL image

  from PIL import Image
  import higgsfield_client

  image = Image.open('example.jpeg')
  url = higgsfield_client.upload_image(image, format='jpeg')
  ```

  ```python async icon="python" theme={null}
  import higgsfield_client

  # Async raw data upload
  url = await higgsfield_client.upload_async(data, content_type='image/jpeg')

  # Async file upload
  url = await higgsfield_client.upload_file_async('path/to/example.jpeg')

  # Async image upload
  url = await higgsfield_client.upload_image_async(image, format='jpeg')
  ```
</CodeGroup>

## Requirements

* Python >= 3.8

## Resources

* **GitHub Repository**: [higgsfield-ai/higgsfield-client](https://github.com/higgsfield-ai/higgsfield-client)
* **Homepage**: [cloud.higgsfield.ai](https://cloud.higgsfield.ai)
* **Package**: [PyPI](https://pypi.org/project/higgsfield-client/)

## JavaScript/TypeScript SDK

**Coming Soon** - Our JavaScript/TypeScript SDK is currently in development and will be available soon.

The upcoming SDK will feature:

* Full TypeScript support with type definitions
* Promise-based async API
* Support for Node.js and browser environments
* Webhook utilities
* Built-in retry logic

In the meantime, you can use the [REST API directly](/how-to/introduction).

## Support

If you encounter any issues or have questions:

* Check our [API Documentation](/api-reference)
* Review the [GitHub Repository](https://github.com/higgsfield-ai/higgsfield-client)
* Contact support at [support@higgsfield.ai](mailto:support@higgsfield.ai)


Built with [Mintlify](https://mintlify.com).
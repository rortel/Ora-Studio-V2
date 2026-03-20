APIPod
APIPod

Overview
API Reference
Quick Start
Text
LLM API
Universal Chat Interface
Image
Seedream
Nano Banana
Video
Search
⌘
K
Home
Models
Dashboard





Quick Start
This guide will help you integrate APIPod's powerful AI capabilities into your applications in minutes.

Base URL

All API requests should be made to: https://api.apipod.ai/v1

OpenAI Compatible
APIPod provides OpenAI-compatible and Anthropic-compatible interfaces. If you're already using OpenAI SDK, simply change the base_url to start using APIPod immediately.
Authentication

APIPod uses Bearer Token authentication. Include your API key in the Authorization header for all requests:


Authorization: Bearer sk-your-api-key
Sign in to APIPod Console and navigate to API Keys to create your first key.

Security Best Practice
Never expose your API key in client-side code. Always make API calls from your server or use environment variables.

# Set as environment variable
export APIPOD_API_KEY="sk-your-api-key"
Quick Start

Get started with your first API call in under 60 seconds:

Python
Node.js
cURL

from openai import OpenAI
client = OpenAI(
    base_url="https://api.apipod.ai/v1",
    api_key="sk-your-api-key"
)
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ]
)
print(response.choices[0].message.content)
Available APIs

APIPod provides unified APIs for multiple AI modalities:

Chat Completions
Text generation with LLMs. Compatible with OpenAI Chat API format. Supports GPT-4o, Claude, Gemini, and 100+ models.
Image Generation
Generate images with DALL-E, Midjourney, Stable Diffusion, and more. Unified interface across all providers.
Video Generation
Create videos with Runway, Luma, Veo, and other video models. Async task-based API with status tracking.
Audio Generation
Music and audio generation with Suno, ElevenLabs, and more. Coming soon.
Common Response Format

All successful responses follow a consistent JSON structure:


{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1699876543,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  }
}
Error Handling

APIPod returns standard HTTP status codes and detailed error messages:

Error Response Format
Common Error Codes
Handling Errors in Code

Python
Node.js

from openai import OpenAI, APIError, RateLimitError
client = OpenAI(
    base_url="https://api.apipod.ai/v1",
    api_key="sk-your-api-key"
)
try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello!"}]
    )
except RateLimitError as e:
    print(f"Rate limited. Retry after: {e.response.headers.get('Retry-After')}")
except APIError as e:
    print(f"API error: {e.message}")
Streaming

For real-time responses, enable streaming with stream: true:

Python
Node.js
cURL

stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
SDK Support

APIPod is compatible with official SDKs:

Python
pip install openai
Node.js
npm install openai
Go
go get github.com/sashabaranov/go-openai
Next Steps

Chat Completions API
Detailed documentation for text generation with 100+ LLM models.
Supported Models
Browse all available models with pricing and capabilities.
Playground
Test APIs interactively in your browser.
Usage Dashboard
Monitor your API usage and costs in real-time.
On this page
Base URL
Authentication
Quick Start
Available APIs
Common Response Format
Error Handling
Handling Errors in Code
Streaming
SDK Support
Next Steps

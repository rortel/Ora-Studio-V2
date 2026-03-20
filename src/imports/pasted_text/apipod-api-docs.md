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





Universal Chat Interface
List of mainstream AI models supported by APIPod, compatible with OpenAI standard API.

Unified chat API interface supporting all text generation models
Select different AI models via the model parameter; seamlessly switch between GPT-5, Claude 3.5, Gemini 1.5, and dozens of other top-tier models just by changing the model parameter
Compatible with OpenAI Chat Completions API format
Interface Definition

POST
https://api.apipod.ai
/v1/chat/completions

Try it
cURL
Python
JavaScript
Go
Java

curl --request POST \
  --url https://api.apipod.ai/v1/chat/completions \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ]
  }'
Authentication

All API calls require a Bearer Token in the Header.

Security Tip
Do not expose your API Key directly in browser frontend code. It is recommended to use it only on the server side.

Authorization: Bearer sk-xxxxxxxxxxxxxxxx
Request Parameters

Core Parameters

Parameter	Type	Required	Default	Description
model	string	✅	gpt-5	Model ID, e.g., gpt-4o, claude-4-5-sonnet, etc.
messages	array	✅	-	List of conversation messages, containing context information.
stream	boolean	-	false	Whether to enable streaming (SSE).
Advanced Control

Expand to view advanced parameters (Temperature, Tokens, etc.)
Messages Structure Detail

Each object in the messages array represents a conversation record.

Role

Specifies the sender of the message:

system: System prompt, used to set the AI's persona.
user: Message sent by the user.
assistant: Message returned by the AI (used for multi-turn conversation context).
Content

Specific text content. For models supporting vision (like GPT-4V), this can include image URLs.

Example Payload:


{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are an AI assistant provided by APIPod." },
    { "role": "user", "content": "Hello, how is the weather today?" }
  ]
}
Response Structure

The API returns a standard JSON object.

Field	Type	Description
id	string	Unique request ID.
object	string	Fixed as chat.completion.
created	integer	Unix timestamp.
choices	array	List of generated results.
usage	object	Token usage statistics.
Response Example (JSON)
Supported Models

APIPod supports all mainstream models, specified via the model parameter.

OpenAI
gpt-5
gpt-5.1-codex
gpt-5.1
Anthropic
claude-4-5-sonnet
claude-4-5-opus
claude-4-5-haiku
Google
gemini-2.5-pro
gemini-3-pro-preview
Other
deepseek-v3.2
doubao-pro
...
More Models
Please visit the Model List to view more supported models; we are continuously adding more.
On this page
Interface Definition
Authentication
Request Parameters
Core Parameters
Advanced Control
Messages Structure Detail
Response Structure
Supported Models

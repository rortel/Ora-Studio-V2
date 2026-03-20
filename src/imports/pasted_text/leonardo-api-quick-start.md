Jump to Content
Leonardo.Ai
v1.0
Guides
Recipes
API Reference

Search
⌘K
🏁 QUICK START

Quick Start Guide
Commonly Used Models
📝 GUIDES

Image Generation

Video Generation

Blueprint Generation

Best Practices

Usage and Cost

Legacy Generation

❓TECHNICAL SUPPORT & QUESTIONS

Frequently Asked Questions

API Error Messages
Special Topics

Need More Support?
MCP SERVER

⚙️
Connect to Leonardo.Ai with the MCP Server
Powered by 

Quick Start Guide
Welcome! This guide helps you get started with the Leonardo.Ai API, from creating an API key to generating your first images.
Prerequisites

Before you begin:

Sign up or log in to the Leonardo.Ai web app.
Purchase API Credits. API access is separate from free or web app subscriptions.
Step 1: Subscribe & Get Your API Key

To call the API, you must first generate a key.

Visit API Access
Log into the Leonardo web app.
From the left menu, select API Access, then Buy Credit.
Create an API Key
On the API Access page, click Create New Key.
Give your key a name (for example, myapp-prod or backend-service).
Optionally configure a webhook callback URL to receive real-time generation results instead of polling.
Note: API plans are distinct from the Leonardo web app plans. API plans unlock access to the API. Keep your API key secure. Do not embed it in client-side code.


Step 2: Generate Your First Images

Now that your key is ready, you can generate an image.

Example cURL Request


curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <YOUR_API_KEY>' \
     --header 'content-type: application/json' \
     --data '
{
  "alchemy": false,
  "height": 1080,
  "modelId": "7b592283-e8a7-4c5a-9ba6-d18c31f258b9",
  "contrast": 3.5,
  "num_images": 4,
  "styleUUID": "111dc692-d470-4eec-b791-3475abac4c46",
  "prompt": "A serene watercolor painting of a mountain lake at sunrise",
  "width": 1920,
  "ultra": false
}
'
After you send the request, you will receive a response containing a generationId that you can use with to fetch the generated images.

You may also use our Get API Code feature, which lets you instantly export your Leonardo web app image or video generations as ready-to-use API code.


Tips & Next Steps

Improve Workflow

Webhooks: set up event callbacks to get notified when image jobs finish.
Rate Limits: be aware of concurrency limits and usage caps.
Billing Transparency: usage is billed in dollars. Check the API Access page to view remaining credit.
Updated about 1 month ago

Commonly Used Models
Did this page help you?
TABLE OF CONTENTS
Prerequisites
Step 1: Subscribe & Get Your API Key
Step 2: Generate Your First Images
Example cURL Request
Tips & Next Steps
Improve Workflow

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
Seedream v4.5 Text to Image
Seedream v4.5 Image to Image
Nano Banana
Video
Search
⌘
K
Home
Models
Dashboard





Seedream v4.5 Text to Image
Seedream v4.5 Text to Image API documentation, supporting high-quality image generation with multiple aspect ratios and resolutions.

Seedream v4.5 is a high-quality AI image generation model launched by ByteDance, featuring excellent Chinese and English understanding capabilities and outstanding image generation quality.

Supports Chinese and English Prompts
Multiple aspect ratio options: 1:1, 2:3, 3:2, 3:4, 4:3, 16:9, 9:16, 21:9
High-resolution output: Supports 2K and 4K resolutions
Asynchronous task mode: Submit request and poll for results
Interface Definition

POST
https://api.apipod.ai
/v1/images/generations

Try it
Asynchronous Task Mode
This API operates asynchronously. After submitting a request, you will receive a task ID, and you need to poll the status interface to get the result.

Steps: 1. Submit task to get task_id → 2. Poll status interface until completion
cURL
Python
JavaScript
Go
Java

# Step 1: Submit image generation task
curl --request POST \
  --url https://api.apipod.ai/v1/images/generations \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "seedream-v4.5",
    "prompt": "A vibrant close-up editorial portrait, model with intense gaze, wearing a sculptural hat, rich color blocking, sharp eye focus, shallow depth of field, Vogue magazine cover aesthetic",
    "aspect_ratio": "3:4",
    "quality": "2K"
  }'
# Response example:
# {"code": 0, "message": "success", "data": {"task_id": "task_abc123xyz"}}
# Step 2: Poll task status
curl --request GET \
  --url https://api.apipod.ai/v1/images/status/task_abc123xyz \
  --header 'Authorization: Bearer <token>'
Authentication

All API calls require a Bearer Token in the Header.

Security Notice
Do not expose your API Key directly in browser frontend code. It is recommended to use it only on the server side.

Authorization: Bearer sk-xxxxxxxxxxxxxxxx
Request Parameters

Core Parameters

Parameter	Type	Required	Default	Description
model	string	✅	seedream-v4.5	Model identifier
prompt	string	✅	-	Description of the image to generate, max 4000 chars
aspect_ratio	string	-	1:1	Aspect ratio of the generated image
quality	string	-	2K	Output image resolution
Prompt Writing Tips

Describe Subject

Clearly describe the main subject of the image, including people, objects, or scenes.


A young woman wearing a white dress, standing under cherry blossom trees
Add Details

Supplement with lighting, colors, style, and other details.


Soft natural light, pink tones, Japanese fresh style
Specify Style

Clearly specify the artistic or photography style.


Cinematic, shallow depth of field, medium format shot, 35mm film texture
Complete Prompt Example:


A vibrant close-up editorial portrait, model with intense gaze, wearing a sculptural hat (with an APIPod.ai LOGO on the hat),
rich color blocking, sharp eye focus, shallow depth of field, Vogue magazine cover aesthetic, medium format shot, intense studio lighting.
Aspect Ratio Options

Value	Ratio	Use Case
1:1	Square	Avatars, social media posts
2:3	Portrait	Portrait photography
3:2	Landscape	Landscape photography
3:4	Portrait	Magazine covers, posters
4:3	Landscape	Traditional photos
16:9	Widescreen	Video thumbnails, Banners
9:16	Vertical	Phone wallpapers, short video covers
21:9	Ultra-wide	Cinematic frames, website Hero images
Resolution Options

Value	Description
2K	Standard resolution, faster generation
4K	High resolution, suitable for printing and large displays
Response Structure

Task Submission Response

After submitting an image generation request, the API returns a task ID:

Field	Type	Description
code	integer	Response status code, 0 indicates success
message	string	Response message
data.task_id	string	Unique identifier for the generation task

{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "task_abc123xyz"
  }
}
Status Query Interface

GET
https://api.apipod.ai
/v1/images/status/{task_id}

Try it
Path Parameter	Type	Required	Description
task_id	string	✅	Image generation task ID
Status Response Fields

Field	Type	Description
code	integer	Response status code, 0 indicates success
message	string	Response message
data.task_id	string	Task ID
data.error_message	string	Error message
data.status	string	Task status: pending / processing / completed / failed
data.completed_at	integer	Completion timestamp (Unix timestamp)
data.result	array	List of generated image URLs
Response Examples (JSON)
Task Status Description

Status	Description	Recommended Action
pending	Task submitted, waiting for processing	Continue polling, recommended interval 2 seconds
processing	Task is being processed	Continue polling, recommended interval 2 seconds
completed	Task completed, image generated	Get image URLs from result
failed	Task failed	Check error message, resubmit task
Polling Recommendation
It is recommended to poll the task status every 2-3 seconds. Image generation usually takes 10-30 seconds. Do not poll too frequently to avoid triggering rate limits.
Error Handling

Status Code	Description
400	Request parameter error (e.g., prompt too long, invalid aspect_ratio)
401	Authentication failed, API Key invalid or missing
403	Insufficient balance or insufficient permissions
404	Task does not exist (when querying status)
429	Request too frequent, triggered rate limit
500	Internal server error

{
  "error": {
    "message": "Invalid aspect_ratio value",
    "type": "invalid_request_error",
    "code": "invalid_parameter"
  }
}
Best Practices

Set Reasonable Polling Interval

It is recommended to poll every 2-3 seconds and set a maximum number of polls (e.g., 60 times) to avoid infinite waiting.

Handle Timeout Situations

If the task is not completed after 2 minutes, suggests prompting the user to try again later.

Cache Generated Images

Image URLs have a limited validity period. It is recommended to download and store them on your own server or CDN.

Related Links

Seedream v4.5 Image to Image
Style transfer or image editing based on reference images.
Model List
Browse all available image generation models.
Online Playground
Test Seedream image generation in the browser.
On this page
Interface Definition
Authentication
Request Parameters
Core Parameters
Prompt Writing Tips
Aspect Ratio Options
Resolution Options
Response Structure
Task Submission Response
Status Query Interface
Status Response Fields
Task Status Description
Error Handling
Best Practices
Related Links

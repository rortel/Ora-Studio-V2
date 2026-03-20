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





Seedream v4.5 Image to Image
Seedream v4.5 Image to Image API documentation, edit and transform images based on source images and text prompts.

Seedream v4.5 Image Edit API allows you to transform and edit existing images based on text prompts and reference images.

Supports 1-14 source images as reference
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

Steps: 1. Submit task with source images to get task_id → 2. Poll status interface until completion
cURL
Python
JavaScript
Go
Java

# Step 1: Submit image edit task
curl --request POST \
  --url https://api.apipod.ai/v1/images/edits \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "seedream-v4.5-edit",
    "prompt": "Transform this portrait into an oil painting style, keeping the original composition but adding vibrant brush strokes and rich textures",
    "image_urls": [
      "https://example.com/images/source.jpg"
    ],
    "aspect_ratio": "3:4",
    "quality": "2K"
  }'
# Response example:
# {"code": 0, "message": "success", "data": {"task_id": "task_edit_abc123xyz"}}
# Step 2: Poll task status
curl --request GET \
  --url https://api.apipod.ai/v1/images/status/task_edit_abc123xyz \
  --header 'Authorization: Bearer <token>'
Authentication

All API calls require a Bearer Token in the Header.

Security Notice
Do not expose your API Key directly in browser frontend code. It is recommended to use it only on the server side.

Authorization: Bearer sk-xxxxxxxxxxxxxxxx
Request Parameters

Core Parameters

Parameter	Type	Required	Default	Description
model	string	Yes	seedream-v4.5-edit	Model identifier
prompt	string	Yes	-	Description of how to edit the image, max 4000 chars
image_urls	array	Yes	-	List of source image URLs (1-14 images required)
aspect_ratio	string	-	1:1	Aspect ratio of the output image
quality	string	-	2K	Output image resolution
Source Images

Image Requirements
Minimum: 1 image required
Maximum: Up to 14 images supported
Format: JPEG, PNG, WebP
Accessibility: Images must be publicly accessible URLs
Use Cases for Multiple Images:

Image Count	Use Case
1 image	Single image style transfer or editing
2-3 images	Style blending from multiple references
4+ images	Complex scene composition or multi-reference editing
Prompt Writing Tips for Image Editing

Describe the Transformation

Clearly describe how you want to transform the source image.


Transform this photo into a watercolor painting style
Specify Style Details

Add specific style characteristics you want to apply.


with soft edges, pastel colors, and visible brush strokes
Preserve or Modify Elements

Specify what to keep and what to change from the original.


keep the original composition but change the background to a sunset scene
Complete Prompt Example:


Transform this portrait into an oil painting style, keeping the original composition and facial features,
but adding vibrant brush strokes, rich textures, and warm golden lighting reminiscent of Renaissance portraits.
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

After submitting an image edit request, the API returns a task ID:

Field	Type	Description
code	integer	Response status code, 0 indicates success
message	string	Response message
data.task_id	string	Unique identifier for the edit task

{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "task_edit_abc123xyz"
  }
}
Status Query Interface

GET
https://api.apipod.ai
/v1/images/status/{task_id}

Try it
Path Parameter	Type	Required	Description
task_id	string	Yes	Image edit task ID
Status Response Fields

Field	Type	Description
code	integer	Response status code, 0 indicates success
message	string	Response message
data.task_id	string	Task ID
data.error_message	string	Error message
data.status	string	Task status: pending / processing / completed / failed
data.completed_at	integer	Completion timestamp (Unix timestamp)
data.result	array	List of edited image URLs
Response Examples (JSON)
Task Status Description

Status	Description	Recommended Action
pending	Task submitted, waiting for processing	Continue polling, recommended interval 2 seconds
processing	Task is being processed	Continue polling, recommended interval 2 seconds
completed	Task completed, image edited	Get image URLs from result
failed	Task failed	Check error message, resubmit task
Polling Recommendation
It is recommended to poll the task status every 2-3 seconds. Image editing usually takes 15-45 seconds depending on the number of source images. Do not poll too frequently to avoid triggering rate limits.
Error Handling

Status Code	Description
400	Request parameter error (e.g., invalid image_urls, too many images)
401	Authentication failed, API Key invalid or missing
403	Insufficient balance or insufficient permissions
404	Task does not exist (when querying status)
429	Request too frequent, triggered rate limit
500	Internal server error

{
  "error": {
    "message": "image_urls must contain between 1 and 14 images",
    "type": "invalid_request_error",
    "code": "invalid_parameter"
  }
}
Best Practices

Ensure Image Accessibility

Make sure all source image URLs are publicly accessible and return valid image content.

Optimize Source Images

Use high-quality source images for better results. Recommended minimum resolution is 512x512.

Set Reasonable Polling Interval

It is recommended to poll every 2-3 seconds and set a maximum number of polls (e.g., 90 times) to avoid infinite waiting.

Cache Edited Images

Image URLs have a limited validity period. It is recommended to download and store them on your own server or CDN.

Related Links

Seedream v4.5 Text to Image
Generate images from text descriptions only.
Model List
Browse all available image generation models.
Online Playground
Test Seedream image editing in the browser.
On this page
Interface Definition
Authentication
Request Parameters
Core Parameters
Source Images
Prompt Writing Tips for Image Editing
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

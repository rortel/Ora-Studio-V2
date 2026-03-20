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

Kling 2.1 Pro
Kling 2.5 Turbo
Kling 2.6
Kling 3.0
Kling O1
Kling O3
Seedance 1.0 Lite
Seedance 1.0 Pro
Veo 3.0
Veo 3.1
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

Kling 2.5 Turbo
This guide shows how to generate images using Kling 2.5 Turbo model via the Leonardo.AI REST API.
This guide shows how to generate images using Kling 2.5 Turbo model via the Leonardo.AI REST API.

Sample Request


curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video\
     --header 'accept: application/json' \
     --header 'authorization: Bearer `<YOUR_API_KEY>`' \
     --header 'content-type: application/json' \
     --data'
{
    "prompt":"A dreamlike sea of flowers reminiscent of a movie scene, with a gentle breeze caressing the golden hour light and shadow. The most beautiful place in the world, captured in stunningly dynamic cinematography.",
    "imageId" : `<YOUR_INIT_IMAGE_ID>`,
    "imageType": "UPLOADED",
    "resolution": "RESOLUTION_1080",
    "height": 1080,
    "width": 1920,
    "duration": 5,
    "model": "Kling2_5",
    "isPublic": false
}
'
Recipe

Generate with Kling 2.5 Turbo Using Text Prompts
Open Recipe
Generate with Kling 2.5 Turbo Using Start Frame
Open Recipe
API Request Endpoint, Headers, Parameters

Endpoint

cURL

https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video
Headers

cURL

--header "accept: application/json" \
--header "authorization: Bearer <YOUR_API_KEY>" \
--header "content-type: application/json"
Body Parameters

Parameter	Type	Definition
duration	number	Specifies the length of the generated video in seconds. Set to 5 or 10.
endFrameImage	object	Defines the ending frame for start-and-end-frame video generation. Must include an image id and type. Only applicable when generating videos using both start and end frames. Requires specifying start frame (imageId, imageType).
height	number	Sets the height of the output video in pixels. Set to 1080, 1440, or 1920.
imageId	string	Identifier of the image used as the starting frame for image-to-video generation. The image must exist as an uploaded or previously generated asset.
imageType	string	Specifies the source type of the start frame image. Set to UPLOADED or GENERATED.
isPublic	boolean	Controls whether the generated video is public or private. Set to true to make the generation public, or false to keep it private.
model	string	Selects the Veo model used for generation. Set to Kling2_5.
prompt	string	Text description that guides the content, style, and motion of the generated video.
resolution	string	Defines the output resolution preset. Set to RESOLUTION_1080.
width	number	Sets the width of the output video in pixels. Set to 1080, 1440, or 1920.
Default height and width

When specifying resolution, please note the following defaults.

Kling 2.5 Turbo generates at an aspect ratio of 16:9 at dimensions 1920x1080.

Kling 2.5 Turbo generates at an aspect ratio of 9:16 at dimensions 1080x1920.

Kling 2.5 Turbo generates at an aspect ratio of 1:1 at dimensions 1440x1440

height and width dimensions specified outside of this will not be accepted.
Updated about 2 months ago

Kling 2.1 Pro
Kling 2.6
Did this page help you?
TABLE OF CONTENTS
Sample Request
Recipe
API Request Endpoint, Headers, Parameters
Endpoint
Headers
Body Parameters
Default height and width

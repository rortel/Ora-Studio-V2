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

Kling 2.1 Pro
This guide shows how to generate images using Kling 2.1 Pro model via the Leonardo.AI REST API.
This guide shows how to generate images using Kling 2.1 Pro model via the Leonardo.AI REST API.

Sample Request

cURL

curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video\
     --header 'accept: application/json' \
     --header 'authorization: Bearer `<YOUR_API_KEY>`' \
     --header 'content-type: application/json' \
     --data'{
       "prompt":"woman walks forward, camera follows her, timelapse with clouds",
       "imageId" : <YOUR_IMAGE_ID>,
       "imageType": "GENERATED",
       "endFrameImage":{
           "id" : <YOUR_IMAGE_ID>,
           "type": "GENERATED"
       },
       "resolution": "RESOLUTION_1080",
       "duration":10,
       "height":1080,
       "width":1920,
       "model": "KLING2_1"
     }'
Recipe

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
height	number	Sets the height of the output video in pixels. Set to 1080 or 1920.
imageId	string	Identifier of the image used as the starting frame for image-to-video generation. The image must exist as an uploaded or previously generated asset. Kling 2.1 Pro must have a start frame in the request.
imageType	string	Specifies the source type of the start frame image. Set to UPLOADED or GENERATED. Kling 2.1 Pro must have a start frame in the request.
isPublic	boolean	Controls whether the generated video is public or private. Set to true to make the generation public, or false to keep it private.
model	string	Selects the Veo model used for generation. Set to VEO3 or KLING2_1.
prompt	string	Text description that guides the content, style, and motion of the generated video.
resolution	string	Defines the output resolution preset. Set to RESOLUTION_1080.
width	number	Sets the width of the output video in pixels. Set to 1080 or 1920.
Default Height and Width

When specifying resolution, please note the following defaults.

Kling 2.1 Pro generates at an aspect ratio of 16:9 at dimensions 1920x1080.

Kling 2.1 Pro generates at an aspect ratio of 9:16 at dimensions 1080x1920.

height and width dimensions specified outside of this will not be accepted.


Updated about 2 months ago

Seedream 4.5
Kling 2.5 Turbo
Did this page help you?
TABLE OF CONTENTS
Sample Request
Recipe
API Request Endpoint, Headers, Parameters
Endpoint
Headers
Body Parameters
Default Height and Width

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

FLUX Dev
FLUX Schnell
FLUX.1 Kontext [pro]
FLUX.2 Pro
GPT Image-1.5
Ideogram 3.0
Lucid Origin
Lucid Realism
Nano Banana
Nano Banana Pro
Nano Banana 2
Phoenix
Seedream 4.0
Seedream 4.5
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

Phoenix
This guide shows how to generate images using Phoenix models via the Leonardo.AI REST API.
This guide shows how to generate images using Phoenix 1.0 and Phoenix 0.9 models via the Leonardo.AI REST API.

Sample Request

cURL

curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <YOUR_API_KEY>' \
     --header 'content-type: application/json' \
     --data '{
       "modelId": "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3", // Phoenix 1.0
       "contrast": 3.5,
       "prompt": "an orange cat standing on a blue basketball with the text PAWS",
       "num_images": 4,
       "width": 1472,
       "height": 832,
       "alchemy": true,
       "styleUUID": "111dc692-d470-4eec-b791-3475abac4c46",
       "enhancePrompt": false
     }'
Recipe

Generate Images Using Leonardo Phoenix Model in Ultra Mode
Open Recipe
Generate Images Using Leonardo Phoenix Model in Quality Mode
Open Recipe
API Request Endpoint, Headers, Parameters

Endpoint

cURL

https://cloud.leonardo.ai/api/rest/v1/generations
Headers

cURL

--header "accept: application/json" \
--header "authorization: Bearer <YOUR_API_KEY>" \
--header "content-type: application/json"
Body Parameters

Parameter	Type	Definition
alchemy	boolean	Optional. When true, enables Quality generation mode for Leonardo Phoenix. This parameter is not supported for Lucid Origin and Lucid Realism.
contrast	number	Required. Controls the contrast/detail level of generated images. Valid values: [3, 3.5, 4] where 3 corresponds to Low, 3.5 corresponds to Medium, and 4 corresponds to High in the web UI.
enhancePrompt	string	Optional. Enables prompt enhancement. Set to true for enhanced prompt behavior; when paired with enhancePromptInstruction it refines the prompt further.
enhancePromptInstruction	string	Optional. Provides additional instruction used alongside enhancePrompt=true.
height	integer	Optional. Height input resolution.
modelId	string	Required. UUID of the model to use. Refer to the table below for a list of UUIDs.
num_images	integer	Optional. Number of images to generate in the batch.
prompt	string	Required. Text prompt describing what image you want the model to generate.
seed	integer	Optional. Apply a fixed seed to maintain consistency across generation sets.
styleUUID	string	Optional. UUID of a preset style that affects the aesthetic output. Refer to the table below for a list of UUIDs.
ultra	boolean	Optional. When true, enables Ultra generation mode.
width	integer	Optional. Width input resolution.
List of Model IDs

Preset	Model	modelId
Phoenix 1.0	Phoenix 1.0	de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3
Phoenix 0.9	Phoenix 0.9	6b645e3a-d64f-4341-a6d8-7a3690fbf042
List of Style UUIDs

Image Guidance

Sample Request

cURL

curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <YOUR_API_KEY>' \
     --header 'content-type: application/json' \
     --data '{
       "height": 1024,
       "modelId": "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3", // Lucid Origin
       "prompt": "Intricately swirling nebulas dance across a vividly colored galactic map",
       "width": 1024,
       "controlnets": [
             {
                 "initImageId": "06c4d15c-0d32-42b3-bec2-4e1d685d229f",
                 "initImageType": "GENERATED",
                 "preprocessorId": 364, // Content Reference
                 "strengthType": "High"
             }   
         ]
     }'
Body Parameters

Parameter	Type	Definition
initImageId	string	Leonardo Image ID.
initImageType	string	Whether an image is generated on or uploaded to the Leonardo platform. Accepts GENERATED or UPLOADED. To upload an image, see the recipe below.
preprocessorId	integer	ID corresponding to the type of image guidance. Refer to the table below for a list of preprocessor IDs.
strengthType	string	Strength of the input image guidance. Accepts Low, Mid, or High.
List of Preprocessor IDs

Model	Style Reference	Character Reference	Content Reference
Phoenix 1.0	166	397	364
Phoenix 0.9	166	397	364
Uploading Images

Upload an Image and Print the Image ID
Open Recipe

Updated about 2 months ago

Nano Banana 2
Seedream 4.0
Did this page help you?
TABLE OF CONTENTS
Sample Request
Recipe
API Request Endpoint, Headers, Parameters
Endpoint
Headers
Body Parameters
List of Model IDs
List of Style UUIDs
Image Guidance
Sample Request
Body Parameters
Uploading Images

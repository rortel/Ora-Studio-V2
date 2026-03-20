Jump to Content
Luma APIs
Keys
Usage
Billing & Credits
Home
API
Status
Guides
API Reference
Changelog

Search
⌘K
JUMP TO
⌘/
DREAM MACHINE API

Ping

Generations

Create a generation
POST
List generations
GET
Get a generation
GET
Delete a generation
DEL
Upscale a generation
POST
Add audio to a generation
POST
Get concepts
GET
Generate an image
POST
Reframe an image
POST
Reframe a video
POST
Modify a video
POST
Credits

Powered by 

Reframe a video
POST
https://api.lumalabs.ai/dream-machine/v1/generations/video/reframe




Reframe a video by its ID
Recent Requests

Log in to see full request history
TIME	STATUS	USER AGENT	
Make a request to see history.
0 Requests This Month


Body Params
The reframe video generation request object
generation_type
string
enum
required
Defaults to reframe_video

Allowed:

reframe_video
media
object
required
The image entity object

MEDIA OBJECT
first_frame
object
The image entity object

FIRST_FRAME OBJECT
model
string
enum
required
The model used for the reframe video

Allowed:

ray-2

ray-flash-2
prompt
string
The prompt of the generation
aspect_ratio
string
enum
required
Defaults to 16:9
The aspect ratio of the generation

Allowed:

1:1

16:9

9:16

4:3

3:4

21:9

9:21
grid_position_x
integer
The x position of the image in the grid
grid_position_y
integer
The y position of the image in the grid
x_start
integer
The x start of the crop bounds
x_end
integer
The x end of the crop bounds
y_start
integer
The y start of the crop bounds
y_end
integer
The y end of the crop bounds
resized_width
integer
Resized width of source video
resized_height
integer
Resized height of source video
callback_url
uri
The callback URL of the generation, a POST request with Generation object will be sent to the callback URL when the generation is dreaming, completed, or failed

Responses


201
Video reframed



Default
Error

Updated 4 months ago

Reframe an image
Modify a video
Did this page help you?
LANGUAGE

Shell

Node

Ruby

PHP

Python
CREDENTIALS
BEARER

JWT



1
curl --request POST \
2
     --url https://api.lumalabs.ai/dream-machine/v1/generations/video/reframe \
3
     --header 'accept: application/json' \
4
     --header 'content-type: application/json'


Try It!
RESPONSE
Click Try It! to start a request and see the response here! Or choose an example:
application/json


201


Default

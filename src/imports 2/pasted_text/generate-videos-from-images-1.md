> ## Documentation Index
> Fetch the complete documentation index at: https://docs.higgsfield.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Generate Videos from Images

> Learn how to transform static images into dynamic videos with Higgsfield API

The Higgsfield API enables you to transform static images into dynamic, animated videos using state-of-the-art AI models. This powerful feature is perfect for creating engaging content for social media, marketing campaigns, presentations, and more.

## Available Models

Higgsfield offers a wide variety of image-to-video models optimized for different animation styles and use cases. Popular models include:

* `higgsfield-ai/dop/preview` - High-quality image animation
* `bytedance/seedance/v1/pro/image-to-video` - Professional-grade video generation
* `kling-video/v2.1/pro/image-to-video` - Advanced cinematic animations
* And many more...

To explore all available image-to-video models, visit our [Models Gallery](https://cloud.higgsfield.ai/explore).

## Quick Start

### Basic Video Generation

Here's a simple example to generate a video from an image:

<CodeGroup>
  ```bash DoP Standard theme={null}
  curl -X POST 'https://platform.higgsfield.ai/higgsfield-ai/dop/standard' \
    --header 'Authorization: Key {your_api_key}:{your_api_key_secret}' \
    --header 'Content-Type: application/json' \
    --header 'Accept: application/json' \
    --data '{
      "image_url": "https://example.com/your-image.jpg",
      "prompt": "A stylish woman walks down a Tokyo street filled with warm glowing neon and animated city signage",
      "duration": 5
    }'
  ```

  ```bash Kling 2.1 Pro theme={null}
  # Using Kling Video v2.1 Pro
  curl -X POST 'https://platform.higgsfield.ai/kling-video/v2.1/pro/image-to-video' \
    --header 'Authorization: Key {your_api_key}:{your_api_key_secret}' \
    --header 'Content-Type: application/json' \
    --data '{
      "image_url": "https://example.com/landscape.jpg",
      "prompt": "Camera slowly pans across the landscape as clouds drift overhead"
    }'
  ```

  ```bash Seedance 1.0 Pro theme={null}
  # Using ByteDance Seedance v1 Pro
  curl -X POST 'https://platform.higgsfield.ai/bytedance/seedance/v1/pro/image-to-video' \
    --header 'Authorization: Key {your_api_key}:{your_api_key_secret}' \
    --header 'Content-Type: application/json' \
    --data '{
      "image_url": "https://example.com/portrait.jpg",
      "prompt": "Subject turns head slightly and smiles at the camera"
    }'
  ```
</CodeGroup>

## Best Practices

### Writing Effective Motion Prompts

* **Describe the movement**: Be specific about the type of motion you want (pan, zoom, rotation, etc.)
* **Set the pace**: Use words like "slowly", "quickly", "smoothly" to control animation speed
* **Specify camera movements**: Mention camera actions like "camera pans left", "zooms in", "orbits around"
* **Add atmospheric details**: Include environmental elements like "wind blowing", "water flowing", "lights flickering"

### Example Prompts

```text  theme={null}
Good: "The camera slowly pans across the scene"

Better: "Smooth cinematic camera pan from left to right, golden hour lighting, gentle wind rustling through leaves, shallow depth of field"
```

### Image Preparation Tips

* **Use high-quality source images**: Higher resolution inputs generally produce better results
* **Consider composition**: Images with clear subjects and good composition animate more effectively
* **Avoid heavy compression**: Use PNG or high-quality JPEG formats
* **Match aspect ratio**: Ensure your source image matches your desired video aspect ratio

### Optimizing Generation

* Start with shorter durations to iterate faster
* Test different models to find the best fit for your animation style
* Use webhooks for production workflows to avoid polling
* Store the `request_id` to retrieve results later if needed

## Common Use Cases

* **Social media content**: Create engaging posts and stories from static images
* **Product demonstrations**: Animate product photos to showcase features
* **Marketing campaigns**: Transform marketing visuals into dynamic video ads
* **Creative projects**: Bring artwork and illustrations to life
* **Presentations**: Add motion to slides and visual content
* **Virtual tours**: Create animated walkthroughs from photos


Built with [Mintlify](https://mintlify.com).
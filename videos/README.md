# Video Assets

This directory should contain your transparent video files for the photo booth character overlays.

## Required Files

### Idle Animation (Looping)
- `idle.mp4` - iOS/Safari version (HEVC with alpha channel)
- `idle.webm` - Android version (VP9 with alpha channel)

### Pose Animations (1-2 seconds)
- `pose2.mp4` - iOS/Safari version (HEVC with alpha channel)
- `pose2.webm` - Android version (VP9 with alpha channel)

## Video Specifications

### Format Requirements
- **iOS (.mp4)**: H.265/HEVC codec with alpha channel for transparency
- **Android (.webm)**: VP9 codec with alpha channel for transparency
- **Duration**: Idle should loop seamlessly, poses should be 1-2 seconds
- **Dimensions**: Recommended 720x1280 or 1080x1920 (9:16 aspect ratio)

### Creating Transparent Videos

#### Using FFmpeg
```bash
# Convert to MP4 with HEVC and alpha
ffmpeg -i input.mov -c:v libx265 -pix_fmt yuva420p -crf 28 idle.mp4

# Convert to WebM with VP9 and alpha
ffmpeg -i input.mov -c:v libvpx-vp9 -pix_fmt yuva420p -crf 30 idle.webm
```

#### Using After Effects
1. Export with Animation codec and Alpha channel
2. Use Media Encoder to convert to HEVC (MP4) and VP9 (WebM)
3. Ensure "Alpha Channel" is enabled in export settings

### Testing Transparency
- Test on actual iOS and Android devices
- Verify alpha channel is preserved in both formats
- Ensure videos play smoothly and loop properly

## File Size Optimization
- Keep files under 5MB for faster loading
- Use appropriate compression settings
- Consider progressive loading for multiple poses
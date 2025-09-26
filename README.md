# 📸 Photo Booth Web App

A mobile-first Photo Booth web application optimized for real-life events and camera capture, featuring transparent video overlays and interactive character animations.

## 🧩 Core Features

- **Transparent Video Overlays**: Character animations overlaid on live camera feed
- **Cross-Platform Compatibility**: Supports both iOS (.mp4 HEVC) and Android (.webm VP9) with proper format detection
- **Interactive Pose System**: Random pose animations triggered during photo capture
- **Camera Controls**: Front/back camera switching with proper stream management
- **Mobile-Optimized**: Portrait-locked layout with 9:16 aspect ratio
- **Photo Capture**: Canvas-based compositing with download and share functionality

## 📱 Mobile UX

- Full-screen responsive design optimized for portrait orientation
- Automatic landscape detection with rotation prompt
- Support for devices with notches using `viewport-fit=cover`
- Touch-optimized controls and buttons
- iOS Safari compatibility with Web Share API integration

## 🛠️ Technical Implementation

### Video Format Support
- **iOS/Safari**: MP4 with HEVC codec and alpha channel
- **Android/Chrome**: WebM with VP9 codec and alpha channel
- **Fallback**: Static PNG overlay for unsupported browsers
- **Detection**: Automatic format detection using `video.canPlayType()`

### Camera Handling
- Uses `navigator.mediaDevices.getUserMedia()` for camera access
- Front camera (`facingMode: 'user'`) with mirror effect
- Back camera (`facingMode: 'environment'`) without mirroring
- Portrait stream constraints: 720x1280 with 9:16 aspect ratio
- Stream reinitialization for camera switching

### Capture System
- Canvas-based compositing of camera feed and overlay
- Real-time frame capture during pose animations
- Export as high-quality JPEG with 90% quality
- iOS-specific download handling with fallback instructions

## 📂 Project Structure

```
photo-booth-app/
├── index.html              # Main HTML structure
├── css/
│   └── style.css           # Mobile-first responsive CSS
├── js/
│   └── script.js           # Core JavaScript functionality
├── videos/
│   ├── idle.mp4            # Idle animation (iOS)
│   ├── idle.webm           # Idle animation (Android)
│   ├── pose2.mp4           # Pose animation (iOS)
│   └── pose2.webm          # Pose animation (Android)
├── images/
│   ├── ui-capture.svg      # Capture button icon
│   ├── ui-flip.svg         # Flip camera icon
│   └── fallback.png        # Static fallback overlay
└── README.md               # This file
```

## 🚀 Setup Instructions

1. **Add Video Assets**: Place your transparent video files in the `videos/` folder:
   - `idle.mp4` and `idle.webm` - Looping idle character animation
   - `pose2.mp4` and `pose2.webm` - Pose animation for capture

2. **Customize Overlay**: Replace `images/fallback.png` with your character image

3. **Serve Files**: Use a local HTTP server (videos require proper MIME types):
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx http-server
   
   # PHP
   php -S localhost:8000
   ```

4. **Access on Mobile**: 
   - Enable HTTPS for camera access in production
   - Test on actual mobile devices for best results
   - Generate QR codes for easy mobile access

## 📋 Requirements

### Browser Support
- **iOS**: Safari 14+, Chrome, Firefox (all use WebKit)
- **Android**: Chrome 80+, Firefox 75+
- **Desktop**: Chrome 80+, Safari 14+, Firefox 75+

### Video Format Requirements
- **MP4**: HEVC codec with alpha channel for transparency
- **WebM**: VP9 codec with alpha channel for transparency
- **Dimensions**: Recommend 720x1280 or 1080x1920 for mobile optimization

### HTTPS Requirement
Camera access requires HTTPS in production environments. Use development tools or deploy to a secure server.

## 🎯 Usage Flow

1. User scans QR code → opens app in mobile browser
2. Camera permission requested and granted
3. Live camera feed starts with character overlay animation
4. User can flip between front/back cameras
5. Tap capture button → pose animation plays → photo captured
6. Review captured photo with download/share options
7. Option to take another photo

## 🔧 Customization

### Adding New Poses
1. Create new video files: `pose2.mp4` and `pose2.webm`
2. Add to the `poseVideos` array in `script.js`:
   ```javascript
   this.poseVideos = ['pose2', 'pose3', 'pose4', 'pose5'];
   ```

### Styling Modifications
- Edit `css/style.css` for visual customizations
- Modify button styles, colors, and layout
- Adjust camera container dimensions if needed

### Feature Extensions
- Add countdown timer before capture
- Implement photo gallery/history
- Add social media sharing options
- Include photo filters or effects

## 🐛 Troubleshooting

### Common Issues
- **Camera not working**: Check HTTPS requirement and permissions
- **Videos not loading**: Verify MIME types and file paths
- **Black overlay on iOS**: Ensure using MP4 format, not WebM
- **Layout issues**: Test orientation detection and CSS viewport units

### Performance Optimization
- Compress video files for faster loading
- Use appropriate video dimensions for target devices
- Consider lazy loading for multiple pose videos
- Implement service worker for offline capability

## 📄 License

This project is open source and available under the MIT License.
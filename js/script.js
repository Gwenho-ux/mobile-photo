/**
 * Photo Booth Web App
 * Mobile-first implementation with transparent video overlays and camera capture
 */

class PhotoBoothApp {
    constructor() {
        // DOM elements
        this.elements = {
            permissionScreen: document.getElementById('permission-screen'),
            cameraScreen: document.getElementById('camera-screen'),
            resultsScreen: document.getElementById('results-screen'),
            orientationWarning: document.getElementById('orientation-warning'),
            loading: document.getElementById('loading'),
            
            startCameraBtn: document.getElementById('start-camera'),
            flipCameraBtn: document.getElementById('flip-camera'),
            debugVideoBtn: document.getElementById('debug-video'),
            captureBtn: document.getElementById('capture-button'),
            downloadBtn: document.getElementById('download-button'),
            shareBtn: document.getElementById('share-button'),
            takeAnotherBtn: document.getElementById('take-another'),
            
            cameraVideo: document.getElementById('camera-video'),
            characterOverlay: document.getElementById('character-overlay'),
            fallbackOverlay: document.getElementById('fallback-overlay'),
            logo: document.getElementById('logo'),
            qrcode: document.getElementById('qrcode'),
            captureCanvas: document.getElementById('capture-canvas'),
            capturedImage: document.getElementById('captured-image'),
            countdownOverlay: document.getElementById('countdown-overlay'),
            countdownNumber: document.querySelector('.countdown-number')
        };
        
        // App state
        this.state = {
            currentCamera: 'user', // 'user' for front, 'environment' for back
            mediaStream: null,
            isCapturing: false,
            capturedImageData: null,
            supportsTransparentVideo: false,
            currentPoseVideo: null
        };
        
        // Pose videos will be set after device detection
        this.poseVideos = [];
        
        this.init();
    }
    
    /**
     * Initialize the app
     */
    init() {
        this.bindEvents();
        this.detectVideoSupport();
        this.checkOrientation();
        
        // Check orientation on resize/rotate
        window.addEventListener('resize', () => this.checkOrientation());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.checkOrientation(), 100);
        });
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        this.elements.startCameraBtn.addEventListener('click', () => this.requestCameraPermission());
        this.elements.flipCameraBtn.addEventListener('click', () => this.flipCamera());
        this.elements.debugVideoBtn.addEventListener('click', () => this.debugVideoIssue());
        this.elements.captureBtn.addEventListener('click', () => this.capturePhoto());
        this.elements.downloadBtn.addEventListener('click', () => this.downloadPhoto());
        this.elements.shareBtn.addEventListener('click', () => this.sharePhoto());
        this.elements.takeAnotherBtn.addEventListener('click', () => this.takeAnother());
    }
    
    /**
     * Detect device type and configure video support
     */
    detectVideoSupport() {
        const video = document.createElement('video');
        
        // Test MP4 with HEVC (iOS/Safari)
        const mp4Support = video.canPlayType('video/mp4; codecs="hvc1"') !== '';
        
        // Test WebM with VP9 (Android)
        const webmSupport = video.canPlayType('video/webm; codecs="vp9"') !== '';
        
        // Mobile detection (iOS, Android, and other mobile devices)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isMobile = isIOS || isAndroid || /Mobile|webOS|BlackBerry|Opera Mini|IEMobile|Windows Phone/.test(navigator.userAgent);
        
        // Configure device-specific video settings
        console.log('🔧 DEBUG: isMobile=' + isMobile + ', isIOS=' + isIOS + ', isAndroid=' + isAndroid);
        
        if (isIOS && isMobile) {
            // iOS mobile devices use MOV files for idle and posing
            this.poseVideos = ['ios/idle', 'ios/pose1', 'ios/pose2'];  // Use available MOV files
            this.state.supportsTransparentVideo = true;  // MOV supports transparency
            console.log('📱 iOS device detected - using MOV videos from ios folder');
        } else if (isAndroid) {
            // Android uses WebM videos
            this.poseVideos = ['android /idle', 'android /pose1', 'android /pose2'];
            this.state.supportsTransparentVideo = webmSupport;
            console.log('🤖 Android device detected - using WebM videos');
        } else {
            // Desktop - Use iOS MOV files for testing
            this.poseVideos = ['ios/idle', 'ios/pose1', 'ios/pose2'];
            this.state.supportsTransparentVideo = true;  // Assume MOV support on desktop
            console.log('💻 Desktop device detected - using iOS MOV videos for testing');
        }
        
        console.log('📱 Device detection complete:', {
            userAgent: navigator.userAgent,
            isMobile: isMobile,
            isIOS: isIOS,
            isAndroid: isAndroid,
            poseVideos: this.poseVideos,
            supportsTransparentVideo: this.state.supportsTransparentVideo
        });
        
        // Add visual indicator for desktop testing
        if (!isMobile) {
            console.log('💻 DESKTOP TESTING MODE: Using iOS MOV videos for testing');
        }
        
        // Set up idle character overlay video based on device detection
        const useIOS = (isIOS && isMobile) || (!isMobile && !isAndroid); // iOS mobile OR desktop get iOS videos
        const useAndroid = isAndroid; // Only Android gets Android videos
        this.setupIdleVideo(useIOS, useAndroid);
        
        if (!this.state.supportsTransparentVideo) {
            console.log('Using static overlay for transparency');
            this.setupFallbackOverlay();
        }
    }
    
    /**
     * Setup idle character overlay video based on device type
     */
    setupIdleVideo(isIOS, isAndroid) {
        const characterOverlay = this.elements.characterOverlay;
        
        // Clear existing sources
        characterOverlay.innerHTML = '';
        
        if (isIOS) {
            // iOS: Use transparent MOV file
            const source = document.createElement('source');
            source.src = 'videos/ios/idle.mov';
            source.type = 'video/quicktime';
            characterOverlay.appendChild(source);
            console.log('📱 iOS idle video configured (MOV):', source.src);
            
        } else {
            // Android OR Desktop: Use WebM from android folder  
            const source = document.createElement('source');
            source.src = 'videos/android /idle.webm';
            source.type = 'video/webm; codecs=vp9';
            characterOverlay.appendChild(source);
            if (isAndroid) {
                console.log('🤖 Android idle video configured:', source.src);
            } else {
                console.log('💻 Desktop idle video configured (Android style):', source.src);
            }
        }
        
        // Reload video element to pick up new source
        characterOverlay.load();
        
        // Simple autoplay after loading
        characterOverlay.addEventListener('loadeddata', () => {
            console.log('📱 Character overlay loaded, attempting autoplay...');
            characterOverlay.play().then(() => {
                console.log('✅ Character overlay autoplay successful');
            }).catch(error => {
                console.warn('❌ Character overlay autoplay failed:', error);
                console.log('📱 Click anywhere to start video...');
            });
        }, { once: true });
        
        // Add error handler
        characterOverlay.addEventListener('error', (e) => {
            console.error('❌ Character overlay error:', e);
        });
        
        // Add debug info about video state
        characterOverlay.addEventListener('play', () => console.log('▶️ Character overlay started playing'));
        characterOverlay.addEventListener('pause', () => console.log('⏸️ Character overlay paused'));
        characterOverlay.addEventListener('ended', () => console.log('🔄 Character overlay ended (should loop)'));
    }
    
    /**
     * Debug video loading issues - comprehensive diagnostics
     */
    debugVideoIssue() {
        console.log('🚨 === DEBUG VIDEO ISSUE ===');
        
        const characterOverlay = this.elements.characterOverlay;
        
        // 1. Check file paths
        console.log('📁 Checking file access...');
        const testPaths = [
            'videos/ios/idle.mov',
            'videos/ios/pose1.mov', 
            'videos/ios/pose2.mov'
        ];
        
        testPaths.forEach(path => {
            fetch(path, { method: 'HEAD' })
                .then(response => {
                    console.log(`✅ File ${path}: ${response.status} ${response.statusText}`);
                    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
                    console.log(`   Content-Length: ${response.headers.get('content-length')}`);
                })
                .catch(error => {
                    console.log(`❌ File ${path}: ${error.message}`);
                });
        });
        
        // 2. Current video element state
        console.log('📺 Character overlay element state:');
        console.log({
            element: characterOverlay,
            currentSrc: characterOverlay.currentSrc,
            src: characterOverlay.src,
            innerHTML: characterOverlay.innerHTML,
            readyState: characterOverlay.readyState,
            networkState: characterOverlay.networkState,
            paused: characterOverlay.paused,
            ended: characterOverlay.ended,
            duration: characterOverlay.duration,
            videoWidth: characterOverlay.videoWidth,
            videoHeight: characterOverlay.videoHeight,
            error: characterOverlay.error
        });
        
        // 3. CSS computed styles
        const styles = window.getComputedStyle(characterOverlay);
        console.log('🎨 Computed CSS styles:');
        console.log({
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            position: styles.position,
            top: styles.top,
            left: styles.left,
            width: styles.width,
            height: styles.height,
            zIndex: styles.zIndex,
            transform: styles.transform
        });
        
        // 4. Create a visible test video
        console.log('🧪 Creating test video element...');
        const testVideo = document.createElement('video');
        testVideo.controls = true;
        testVideo.muted = true;
        testVideo.playsInline = true;
        testVideo.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 200px;
            height: 300px;
            z-index: 9999;
            border: 3px solid red;
            background: black;
        `;
        
        const testSource = document.createElement('source');
        testSource.src = 'videos/ios/idle.mov';
        testSource.type = 'video/quicktime';
        testVideo.appendChild(testSource);
        
        testVideo.addEventListener('loadeddata', () => {
            console.log('🎉 TEST VIDEO LOADED!');
            testVideo.play().catch(e => console.log('Test play failed:', e));
        });
        
        testVideo.addEventListener('error', (e) => {
            console.log('💥 TEST VIDEO ERROR:', e);
            console.log('Error code:', testVideo.error?.code);
            console.log('Error message:', testVideo.error?.message);
        });
        
        document.body.appendChild(testVideo);
        
        // Remove test video after 15 seconds
        setTimeout(() => {
            if (testVideo.parentNode) {
                testVideo.parentNode.removeChild(testVideo);
                console.log('🗑️ Test video removed');
            }
        }, 15000);
        
        // 5. Try to force main video to play (with proper timing)
        console.log('🎬 Forcing main video to play...');
        characterOverlay.load();
        
        // Wait for video to be ready before playing
        const tryPlay = () => {
            if (characterOverlay.readyState >= 3) {
                characterOverlay.play()
                    .then(() => console.log('✅ Main video play successful!'))
                    .catch(error => console.log('❌ Main video play failed:', error));
            } else {
                console.log('⏳ Waiting for video to load before playing...');
                setTimeout(tryPlay, 200);
            }
        };
        
        setTimeout(tryPlay, 100);
            
        console.log('🚨 === DEBUG SESSION COMPLETE ===');
    }
    
    /**
     * Ensure video visibility (Safari compatibility)
     */
    ensureVideoVisibility() {
        const characterOverlay = this.elements.characterOverlay;
        
        console.log('🔍 Checking character overlay visibility...');
        console.log('📱 Video element state:', {
            display: window.getComputedStyle(characterOverlay).display,
            visibility: window.getComputedStyle(characterOverlay).visibility,
            opacity: window.getComputedStyle(characterOverlay).opacity,
            zIndex: window.getComputedStyle(characterOverlay).zIndex,
            width: characterOverlay.offsetWidth,
            height: characterOverlay.offsetHeight,
            readyState: characterOverlay.readyState,
            paused: characterOverlay.paused,
            src: characterOverlay.currentSrc
        });
        
        // Force video to be visible
        characterOverlay.style.display = 'block';
        characterOverlay.style.visibility = 'visible';
        characterOverlay.style.opacity = '1';
        
        // Force proper positioning
        characterOverlay.style.position = 'absolute';
        characterOverlay.style.top = '50%';
        characterOverlay.style.left = '50%';
        characterOverlay.style.width = '100%';
        characterOverlay.style.height = '100%';
        characterOverlay.style.transform = 'translate(-50%, -50%)';
        characterOverlay.style.objectFit = 'contain';
        characterOverlay.style.zIndex = '15';
        
        // Attempt to play if not already playing
        if (characterOverlay.paused && characterOverlay.readyState >= 2) {
            console.log('🎬 Video is paused but loaded, attempting to play...');
            characterOverlay.play().catch(error => {
                console.warn('❌ Failed to play character overlay:', error);
                this.addVideoPlaybackHandler(characterOverlay);
            });
        }
    }
    
    /**
     * Add user interaction handler for video playback (Safari fallback)
     */
    addVideoPlaybackHandler(videoElement) {
        const playOnInteraction = () => {
            console.log('🎬 Playing video after user interaction...');
            videoElement.play().then(() => {
                console.log('✅ Video started after user interaction');
            }).catch(error => {
                console.warn('❌ User interaction play failed:', error);
            });
        };
        
        // Add listeners for user interaction
        document.addEventListener('touchstart', playOnInteraction, { once: true });
        document.addEventListener('click', playOnInteraction, { once: true });
        
        console.log('📱 Click anywhere on the screen to start video');
    }
    
    /**
     * Setup fallback static overlay
     */
    setupFallbackOverlay() {
        this.elements.characterOverlay.style.display = 'none';
        this.elements.fallbackOverlay.classList.remove('hidden');
    }
    
    /**
     * Check device orientation and show warning if needed
     */
    checkOrientation() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isSmallHeight = window.innerHeight < 600;
        
        if (isLandscape && isSmallHeight) {
            this.elements.orientationWarning.classList.remove('hidden');
        } else {
            this.elements.orientationWarning.classList.add('hidden');
        }
    }
    
    /**
     * Request camera permission and start video stream
     */
    async requestCameraPermission() {
        this.showLoading('Requesting camera access...');
        
        try {
            await this.startCamera();
            this.showScreen('camera');
            // Force video visibility check for Safari
            this.ensureVideoVisibility();
        } catch (error) {
            console.error('Camera access denied or failed:', error);
            alert('Camera access is required for the Photo Booth. Please allow camera access and try again.');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Start camera with current facing mode
     */
    async startCamera() {
        // Stop existing stream if any
        if (this.state.mediaStream) {
            this.state.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                facingMode: this.state.currentCamera,
                aspectRatio: { ideal: 3/4 }, // Portrait aspect ratio
                width: { ideal: 720, min: 480 }, // For 3:4 ratio
                height: { ideal: 960, min: 640 }, // For 3:4 ratio
                frameRate: { ideal: 30 }
            },
            audio: false
        };
        
        try {
            this.state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.elements.cameraVideo.srcObject = this.state.mediaStream;
            
            // Update camera mirror effect (preserving centering transform)
            if (this.state.currentCamera === 'user') {
                this.elements.cameraVideo.style.transform = 'translate(-50%, -50%) scaleX(-1)';
            } else {
                this.elements.cameraVideo.style.transform = 'translate(-50%, -50%) scaleX(1)';
            }
            
        } catch (error) {
            throw new Error(`Failed to access camera: ${error.message}`);
        }
    }
    
    /**
     * Flip between front and back camera
     */
    async flipCamera() {
        this.showLoading('Switching camera...');
        
        try {
            this.state.currentCamera = this.state.currentCamera === 'user' ? 'environment' : 'user';
            await this.startCamera();
        } catch (error) {
            console.error('Failed to flip camera:', error);
            // Revert to previous camera
            this.state.currentCamera = this.state.currentCamera === 'user' ? 'environment' : 'user';
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Capture photo with pose instruction → countdown → capture sequence
     */
    async capturePhoto() {
        if (this.state.isCapturing) return;
        
        this.state.isCapturing = true;
        this.elements.captureBtn.style.opacity = '0.5';
        this.elements.captureBtn.disabled = true;
        
        try {
            console.log('📸 Starting photo capture sequence...');
            
            // Phase 1: Play pose instruction video (2 seconds)
            await this.playPoseInstruction();
            
            // Phase 2: Show countdown (3 seconds)
            await this.startCountdown();
            
            // Phase 3: Capture with effects (instant)
            await this.captureWithEffects();
            
            // Show results
            this.showScreen('results');
            
        } catch (error) {
            console.error('Capture failed:', error);
            alert('Failed to capture photo. Please try again.');
        } finally {
            this.state.isCapturing = false;
            this.elements.captureBtn.style.opacity = '1';
            this.elements.captureBtn.disabled = false;
        }
    }
    
    /**
     * Phase 1: Play pose instruction video (2 seconds)
     */
    async playPoseInstruction() {
        console.log('🎭 Phase 1: Playing pose instruction (2s)');
        
        return new Promise((resolve) => {
            // Select random pose video
            const randomPose = this.poseVideos[Math.floor(Math.random() * this.poseVideos.length)];
            
            // Create pose instruction video element
            const poseVideo = document.createElement('video');
            poseVideo.className = 'character-overlay';
            poseVideo.style.zIndex = '20'; // Higher than base overlay
            poseVideo.muted = true;
            poseVideo.playsInline = true;
            
            // Force proper positioning for pose videos on mobile
            if (window.innerWidth <= 767) {
                poseVideo.style.position = 'absolute';
                poseVideo.style.top = '50%';
                poseVideo.style.left = '50%';
                poseVideo.style.width = '100%';
                poseVideo.style.height = '100%';
                poseVideo.style.transform = 'translate(-50%, -50%)';
                poseVideo.style.objectFit = 'contain';
            }
            
            // Add video source based on device type (desktop uses iOS for testing)
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const isAndroid = /Android/.test(navigator.userAgent);
            const isMobile = isIOS || isAndroid || /Mobile|webOS|BlackBerry|Opera Mini|IEMobile|Windows Phone/.test(navigator.userAgent);
            const useIOSVideo = (isIOS && isMobile) || (!isMobile && !isAndroid);  // iOS mobile OR desktop gets MOV
            const source = document.createElement('source');
            
            if (useIOSVideo) {
                // iOS mobile uses MOV files
                source.src = `videos/${randomPose}.mov`;
                source.type = 'video/quicktime';
            } else {
                // Android AND Desktop use WebM
                source.src = `videos/${randomPose}.webm`;
                source.type = 'video/webm; codecs=vp9';
            }
            
            poseVideo.appendChild(source);
            
            console.log('🎭 Pose instruction:', {
                pose: randomPose,
                src: source.src,
                format: useIOSVideo ? 'MOV' : 'WebM'
            });
            
            // Add to DOM
            this.elements.cameraVideo.parentNode.appendChild(poseVideo);
            this.state.currentPoseVideo = poseVideo;
            
            // Cleanup function
            const cleanup = () => {
                if (poseVideo.parentNode) {
                    poseVideo.parentNode.removeChild(poseVideo);
                }
                this.state.currentPoseVideo = null;
                console.log('✅ Phase 1 complete - pose instruction finished');
                resolve();
            };
            
            // Play video and cleanup after exactly 2 seconds
            poseVideo.addEventListener('loadeddata', () => {
                poseVideo.play().catch(() => {
                    console.warn('Pose instruction video failed to play');
                    cleanup();
                });
            });
            
            poseVideo.addEventListener('error', () => {
                console.warn('Pose instruction video failed to load');
                cleanup();
            });
            
            // Always cleanup after 2 seconds regardless of video state
            setTimeout(cleanup, 2000);
        });
    }
    
    /**
     * Phase 2: 3-second countdown (no pose videos during countdown)
     */
    async startCountdown() {
        console.log('⏰ Phase 2: Starting countdown (3s)');
        
        return new Promise(async (resolve) => {
            // Show countdown overlay
            this.elements.countdownOverlay.classList.remove('hidden');
            
            // Countdown from 3 to 1 (pure countdown, no videos)
            for (let i = 3; i >= 1; i--) {
                // Update countdown number
                this.elements.countdownNumber.textContent = i;
                
                // Trigger animation by removing and re-adding class
                this.elements.countdownNumber.style.animation = 'none';
                this.elements.countdownNumber.offsetHeight; // Trigger reflow
                this.elements.countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
                
                console.log(`⏱️ Countdown: ${i}`);
                
                // Wait exactly 1 second
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Hide countdown overlay and wait for UI to stabilize
            this.elements.countdownOverlay.classList.add('hidden');
            
            // Small delay to ensure display is stable before capture
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log('✅ Phase 2 complete - display stabilized for capture');
            resolve();
        });
    }
    
    /**
     * Phase 3: Capture with shutter sound and flash effect
     */
    async captureWithEffects() {
        console.log('📸 Phase 3: Capture with effects');
        
        // Flash effect
        await this.showFlashEffect();
        
        // Play shutter sound (if available)
        this.playShutterSound();
        
        // Capture the frame
        await this.captureFrame();
        
        console.log('✅ Phase 3 complete - photo captured with effects');
    }
    
    /**
     * Show flash effect
     */
    async showFlashEffect() {
        return new Promise((resolve) => {
            // Create flash overlay
            const flash = document.createElement('div');
            flash.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: white;
                z-index: 9999;
                opacity: 0;
                pointer-events: none;
            `;
            
            document.body.appendChild(flash);
            
            // Animate flash
            flash.style.transition = 'opacity 150ms ease-out';
            flash.style.opacity = '0.8';
            
            setTimeout(() => {
                flash.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(flash);
                    resolve();
                }, 150);
            }, 150);
            
            console.log('📸 Flash effect triggered');
        });
    }
    
    /**
     * Play shutter sound
     */
    playShutterSound() {
        try {
            // Create audio element for shutter sound
            const audio = new Audio();
            // Use a data URL for a simple click sound
            audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEcCDuS1/LMeSsFJ3TH8N+PQAkTYLTo66hVFAlHnt/yv2EcCDuS1/LNeSsFJnPH8d+PQQkTYLTo66hVFAlGnt/zwGEcCDuS1/LNeSsFJnPH8d+PQAkTYLTo66hVFAlGnt/ywGEbCTuS1/LNeSsFJnPH8d+PQAkTYLTo66hVFAlGnt/ywGEbCTuS1/LNeSsFJnPH8d+PQAkTYLTo66hVFAlGnt/ywGEbCTuS1/LNeSsFJnPH8d+PQAkTYLTo66hVFAlGnt/ywGEbCTuS1/LNeSsFJnPH8d+PQAkTYLTo66hVFAlGnt/ywGEbCQ==';
            audio.volume = 0.3;
            audio.play().catch(() => {
                console.log('Shutter sound not available (browser restriction)');
            });
            console.log('🔊 Shutter sound triggered');
        } catch (error) {
            console.log('Shutter sound not supported');
        }
    }
    
    /**
     * Play random pose animation
     */
    async playPoseAnimation() {
        const randomPose = this.poseVideos[Math.floor(Math.random() * this.poseVideos.length)];
        
        // Create new video element for pose
        const poseVideo = document.createElement('video');
        poseVideo.className = 'character-overlay';
        poseVideo.style.zIndex = '15';
        poseVideo.muted = true;
        poseVideo.playsInline = true;
        
        // Add video source based on device type
        const isAndroid = /Android/.test(navigator.userAgent);
        const source = document.createElement('source');
        
        if (isAndroid) {
            // Android: Use WebM format
            source.src = `videos/${randomPose}.webm`;
            source.type = 'video/webm; codecs=vp9';
        } else {
            // iOS/Desktop: Use MP4 format  
            source.src = `videos/${randomPose}.mp4`;
            source.type = 'video/mp4; codecs=hvc1';
        }
        
        poseVideo.appendChild(source);
        
        console.log('🎭 Playing pose animation:', {
            pose: randomPose,
            src: source.src,
            format: isAndroid ? 'WebM' : 'MP4'
        });
        
        // Add to DOM
        this.elements.cameraVideo.parentNode.appendChild(poseVideo);
        this.state.currentPoseVideo = poseVideo;
        
        // Play pose animation with timeout fallback
        return new Promise((resolve) => {
            let resolved = false;
            
            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    if (poseVideo.parentNode) {
                        poseVideo.parentNode.removeChild(poseVideo);
                    }
                    this.state.currentPoseVideo = null;
                    resolve();
                }
            };
            
            poseVideo.addEventListener('loadeddata', () => {
                poseVideo.play().catch(() => {
                    console.warn('Pose video failed to play');
                    cleanup();
                });
                
                // Remove after 800ms (shorter to reduce glitching)
                setTimeout(cleanup, 800);
            });
            
            poseVideo.addEventListener('error', () => {
                console.warn('Pose video failed to load, capturing immediately');
                cleanup();
            });
            
            // Fallback timeout in case video never loads
            setTimeout(() => {
                console.warn('Pose video loading timeout');
                cleanup();
            }, 1500);
        });
    }
    
    /**
     * Clean up any pose videos that might be playing
     */
    cleanupPoseVideos() {
        if (this.state.currentPoseVideo) {
            try {
                if (this.state.currentPoseVideo.parentNode) {
                    this.state.currentPoseVideo.parentNode.removeChild(this.state.currentPoseVideo);
                }
                this.state.currentPoseVideo = null;
                console.log('🧹 Cleaned up pose video before capture');
            } catch (error) {
                console.warn('Failed to cleanup pose video:', error);
            }
        }
    }
    
    /**
     * Capture frame - exactly what user sees during last second
     */
    async captureFrame() {
        console.log('📸 Capturing exactly what user sees on screen...');
        
        const canvas = this.elements.captureCanvas;
        const ctx = canvas.getContext('2d');
        
        // Set canvas to 3:4 aspect ratio at high resolution
        const targetWidth = 720 * 2;
        const targetHeight = 960 * 2;
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Calculate proper scaling to match CSS object-fit behavior
        const video = this.elements.cameraVideo;
        const characterOverlay = this.elements.characterOverlay;
        
        // Camera video uses object-fit: cover (crop to fill while maintaining aspect ratio)
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = targetWidth / targetHeight;
        
        let cameraDrawWidth, cameraDrawHeight, cameraDrawX, cameraDrawY;
        
        if (videoAspect > canvasAspect) {
            // Video is wider than canvas - crop width
            cameraDrawHeight = targetHeight;
            cameraDrawWidth = targetHeight * videoAspect;
            cameraDrawX = (targetWidth - cameraDrawWidth) / 2;
            cameraDrawY = 0;
        } else {
            // Video is taller than canvas - crop height  
            cameraDrawWidth = targetWidth;
            cameraDrawHeight = targetWidth / videoAspect;
            cameraDrawX = 0;
            cameraDrawY = (targetHeight - cameraDrawHeight) / 2;
        }
        
        console.log('📏 Camera drawing with object-fit: cover behavior:', {
            videoSize: `${video.videoWidth}x${video.videoHeight}`,
            drawSize: `${cameraDrawWidth}x${cameraDrawHeight}`,
            drawPos: `${cameraDrawX},${cameraDrawY}`
        });
        
        // Draw camera video with proper object-fit: cover scaling
        if (this.state.currentCamera === 'user') {
            // Mirror front camera like CSS does
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -cameraDrawX - cameraDrawWidth, cameraDrawY, cameraDrawWidth, cameraDrawHeight);
            ctx.restore();
        } else {
            ctx.drawImage(video, cameraDrawX, cameraDrawY, cameraDrawWidth, cameraDrawHeight);
        }
        
        console.log('✅ Camera feed captured with proper aspect ratio');
        
        // Character overlay uses object-fit: contain (scale to fit without cropping)
        if (characterOverlay && characterOverlay.readyState >= 2) {
            try {
                const overlayAspect = characterOverlay.videoWidth / characterOverlay.videoHeight;
                let overlayDrawWidth, overlayDrawHeight, overlayDrawX, overlayDrawY;
                
                if (overlayAspect > canvasAspect) {
                    // Overlay is wider - scale to fit width
                    overlayDrawWidth = targetWidth;
                    overlayDrawHeight = targetWidth / overlayAspect;
                    overlayDrawX = 0;
                    overlayDrawY = (targetHeight - overlayDrawHeight) / 2;
                } else {
                    // Overlay is taller - scale to fit height
                    overlayDrawHeight = targetHeight;
                    overlayDrawWidth = targetHeight * overlayAspect;
                    overlayDrawX = (targetWidth - overlayDrawWidth) / 2;
                    overlayDrawY = 0;
                }
                
                console.log('📏 Overlay drawing with object-fit: contain behavior:', {
                    overlaySize: `${characterOverlay.videoWidth}x${characterOverlay.videoHeight}`,
                    drawSize: `${overlayDrawWidth}x${overlayDrawHeight}`,
                    drawPos: `${overlayDrawX},${overlayDrawY}`
                });
                
                ctx.drawImage(characterOverlay, overlayDrawX, overlayDrawY, overlayDrawWidth, overlayDrawHeight);
                console.log('✅ Character overlay captured with proper aspect ratio');
            } catch (error) {
                console.warn('Character overlay capture failed:', error);
            }
        }
        
        // Add frame and logos on top
        this.drawCustomFrame(ctx, targetWidth, targetHeight);
        
        // Convert to image data
        this.state.capturedImageData = canvas.toDataURL('image/jpeg', 0.9);
        this.elements.capturedImage.src = this.state.capturedImageData;
        
        console.log('✅ Final capture complete - matches screen view');
        
        // Check if Web Share API is available
        if (navigator.share) {
            this.elements.shareBtn.classList.remove('hidden');
        }
    }
    
    /**
     * Draw custom frame with white border, logo, and QR code around camera area
     */
    drawCustomFrame(ctx, canvasWidth, canvasHeight) {
        // Always draw frame at full canvas size for captured photo (100% scale)
        const frameWidth = canvasWidth;
        const frameHeight = canvasHeight;
        const frameX = 0;
        const frameY = 0;
        
        // Draw white border around full canvas area (scaled thickness)
        const borderThickness = Math.max(frameWidth * 0.01, 10); // 1% of width or min 10px
        ctx.strokeStyle = 'white';
        ctx.lineWidth = borderThickness;
        const inset = borderThickness / 2;
        ctx.strokeRect(frameX + inset, frameY + inset, frameWidth - borderThickness, frameHeight - borderThickness);
        
        console.log('✅ Frame border drawn with thickness:', borderThickness);
        
        // Draw logo at top left of frame (10% spacing from frame border) - bigger for capture
        const logo = this.elements.logo;
        if (logo && logo.complete && logo.naturalWidth > 0) {
            try {
                const logoSize = frameWidth * 0.2; // 20% of frame width (much bigger)
                const logoX = frameX + (frameWidth * 0.05); // 5% from frame left
                const logoY = frameY + (frameHeight * 0.05); // 5% from frame top
                const logoHeight = (logo.naturalHeight / logo.naturalWidth) * logoSize;
                
                ctx.drawImage(logo, logoX, logoY, logoSize, logoHeight);
                console.log('✅ Logo drawn at size:', logoSize);
            } catch (error) {
                console.warn('Failed to draw logo:', error);
            }
        }
        
        // Draw QR code at bottom right of frame - bigger for capture
        const qrcode = this.elements.qrcode;
        if (qrcode && qrcode.complete && qrcode.naturalWidth > 0) {
            try {
                const qrSize = frameWidth * 0.15; // 15% of frame width (much bigger)
                const spacing = frameWidth * 0.03; // 3% spacing from edges
                const qrX = frameX + frameWidth - qrSize - spacing;
                const qrY = frameY + frameHeight - qrSize - spacing;
                
                ctx.drawImage(qrcode, qrX, qrY, qrSize, qrSize);
                console.log('✅ QR code drawn at size:', qrSize);
            } catch (error) {
                console.warn('Failed to draw QR code:', error);
            }
        }
    }
    
    /**
     * Download captured photo
     */
    downloadPhoto() {
        if (!this.state.capturedImageData) return;
        
        const link = document.createElement('a');
        link.download = `photo-booth-${Date.now()}.jpg`;
        link.href = this.state.capturedImageData;
        
        // For iOS Safari, open in new tab since download might not work
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            link.target = '_blank';
            alert('Tap and hold the image to save it to your photos.');
        }
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Share captured photo using Web Share API
     */
    async sharePhoto() {
        if (!this.state.capturedImageData || !navigator.share) return;
        
        try {
            // Convert data URL to blob
            const response = await fetch(this.state.capturedImageData);
            const blob = await response.blob();
            
            const file = new File([blob], 'photo-booth.jpg', { type: 'image/jpeg' });
            
            await navigator.share({
                title: 'Photo Booth Picture',
                text: 'Check out my photo booth picture!',
                files: [file]
            });
        } catch (error) {
            console.error('Share failed:', error);
            // Fallback to download
            this.downloadPhoto();
        }
    }
    
    /**
     * Take another photo
     */
    takeAnother() {
        this.state.capturedImageData = null;
        this.showScreen('camera');
    }
    
    /**
     * Show specific screen
     */
    showScreen(screen) {
        // Hide all screens
        this.elements.permissionScreen.classList.add('hidden');
        this.elements.cameraScreen.classList.add('hidden');
        this.elements.resultsScreen.classList.add('hidden');
        
        // Show requested screen
        switch (screen) {
            case 'permission':
                this.elements.permissionScreen.classList.remove('hidden');
                break;
            case 'camera':
                this.elements.cameraScreen.classList.remove('hidden');
                // Force video state check when camera screen is shown
                setTimeout(() => this.ensureVideoVisibility(), 100);
                break;
            case 'results':
                this.elements.resultsScreen.classList.remove('hidden');
                break;
        }
    }
    
    /**
     * Show loading indicator
     */
    showLoading(message = 'Loading...') {
        this.elements.loading.querySelector('p').textContent = message;
        this.elements.loading.classList.remove('hidden');
    }
    
    /**
     * Hide loading indicator
     */
    hideLoading() {
        this.elements.loading.classList.add('hidden');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PhotoBoothApp();
});

// Service worker registration for offline capability (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered:', registration))
            .catch(error => console.log('SW registration failed:', error));
    });
}
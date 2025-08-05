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
            currentPoseVideo: null,
            videosLoaded: false,
            criticalVideosLoaded: false,
            loadingRetries: 0,
            loadedPoses: [],
            priorityPose: null,
            captureCount: 0
        };

        // Pose videos will be set after device detection
        this.poseVideos = [];

        // Video cache for preloading
        this.videoCache = new Map();

        this.init();

        // Start periodic cleanup for video performance
        this.startPeriodicCleanup();
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

        this.elements.takeAnotherBtn.addEventListener('click', () => this.takeAnother());
    }

    /**
     * Detect device type and configure video support
     */
    detectVideoSupport() {
        const video = document.createElement('video');

        // Test MP4 with HEVC (iOS/Safari)
        const mp4Support = video.canPlayType('video/mp4; codecs="hvc1"') !== '';

        // Test multiple WebM formats for Android compatibility
        const webmVP9Support = video.canPlayType('video/webm; codecs="vp9"') !== '';
        const webmVP8Support = video.canPlayType('video/webm; codecs="vp8"') !== '';
        const webmSupport = webmVP9Support || webmVP8Support;

        // Test MP4 with H.264 for broader Android compatibility
        const mp4H264Support = video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';

        console.log('🎥 Video format support:', {
            mp4HEVC: mp4Support,
            webmVP9: webmVP9Support,
            webmVP8: webmVP8Support,
            mp4H264: mp4H264Support
        });

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
            // Android uses WebM videos, but fallback to iOS if WebM not supported
            if (webmSupport) {
                this.poseVideos = ['android /idle', 'android /pose1', 'android /pose2'];
                this.state.supportsTransparentVideo = true;
                console.log('🤖 Android device detected - using WebM videos');
            } else {
                // Fallback to iOS MOV files for Android if WebM not supported
                this.poseVideos = ['ios/idle', 'ios/pose1', 'ios/pose2'];
                this.state.supportsTransparentVideo = true;
                console.log('🤖 Android device detected - WebM not supported, falling back to iOS MOV videos');
            }
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

        // Start progressive video loading (critical first, then background)
        this.startProgressiveLoading();

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

        // Enhanced video attributes for better performance
        characterOverlay.setAttribute('preload', 'auto');
        characterOverlay.setAttribute('muted', 'true');
        characterOverlay.setAttribute('playsinline', 'true');
        characterOverlay.setAttribute('webkit-playsinline', 'true');
        characterOverlay.setAttribute('loop', 'true');

        // Clear existing sources
        characterOverlay.innerHTML = '';

        if (isIOS) {
            // iOS: Use transparent MOV file
            const source = document.createElement('source');
            source.src = 'videos/ios/idle.mov';
            source.type = 'video/quicktime';
            characterOverlay.appendChild(source);
            console.log('📱 iOS idle video configured (MOV):', source.src);

        } else if (isAndroid) {
            // Android: Try WebM first, then fallback to MOV
            const webmSource = document.createElement('source');
            webmSource.src = 'videos/android /idle.webm';
            webmSource.type = 'video/webm; codecs=vp9';
            characterOverlay.appendChild(webmSource);

            // Fallback to iOS MOV for Android compatibility
            const movSource = document.createElement('source');
            movSource.src = 'videos/ios/idle.mov';
            movSource.type = 'video/quicktime';
            characterOverlay.appendChild(movSource);

            console.log('🤖 Android idle video configured with WebM and MOV fallback');
        } else {
            // Desktop: Use WebM from android folder  
            const source = document.createElement('source');
            source.src = 'videos/android /idle.webm';
            source.type = 'video/webm; codecs=vp9';
            characterOverlay.appendChild(source);
            console.log('💻 Desktop idle video configured (Android style):', source.src);
        }

        // Reload video element to pick up new source
        characterOverlay.load();

        // Enhanced loading with retry mechanism
        this.setupVideoLoadingWithRetry(characterOverlay, 'idle');
    }

    /**
     * Setup video loading with retry mechanism and better error handling
     */
    setupVideoLoadingWithRetry(videoElement, videoType, maxRetries = 3) {
        let retryCount = 0;

        const attemptLoad = () => {
            videoElement.addEventListener('loadeddata', () => {
                console.log(`📱 ${videoType} video loaded successfully, attempting autoplay...`);
                this.state.videosLoaded = true;

                videoElement.play().then(() => {
                    console.log(`✅ ${videoType} video autoplay successful`);
                    retryCount = 0; // Reset retry count on success
                }).catch(error => {
                    console.warn(`❌ ${videoType} video autoplay failed:`, error);
                    if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`🔄 Retrying ${videoType} video playback (${retryCount}/${maxRetries})`);
                        setTimeout(() => videoElement.play().catch(() => { }), 500);
                    } else {
                        console.log('📱 Click anywhere to start video...');
                        this.addVideoPlaybackHandler(videoElement);
                    }
                });
            }, { once: true });

            // Enhanced error handler with retry
            videoElement.addEventListener('error', (e) => {
                console.error(`❌ ${videoType} video error:`, e);
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`🔄 Retrying ${videoType} video load (${retryCount}/${maxRetries})`);
                    setTimeout(() => {
                        videoElement.load();
                        attemptLoad();
                    }, 1000);
                } else {
                    console.error(`💥 ${videoType} video failed after ${maxRetries} retries`);
                    this.handleVideoFailure(videoElement, videoType);
                }
            }, { once: true });
        };

        attemptLoad();

        // Add debug info about video state
        videoElement.addEventListener('play', () => console.log(`▶️ ${videoType} video started playing`));
        videoElement.addEventListener('pause', () => console.log(`⏸️ ${videoType} video paused`));
        videoElement.addEventListener('ended', () => console.log(`🔄 ${videoType} video ended (should loop)`));
    }

        /**
     * Start progressive video loading: critical videos first, then background loading
     */
    async startProgressiveLoading() {
        console.log('🚀 Starting progressive video loading...');
        
        // Phase 1: Load critical videos (idle + 1 random pose)
        await this.loadCriticalVideos();
        
        // Phase 2: Background load remaining videos
        this.loadRemainingVideos();
    }

    /**
     * Phase 1: Load critical videos for immediate use
     */
    async loadCriticalVideos() {
        console.log('⚡ Phase 1: Loading critical videos...');
        
        const idlePath = 'videos/ios/idle.mov';
        
        // Get pose video paths (skip idle)
        const poseOptions = this.poseVideos.filter(video => !video.includes('idle'));
        
        // Randomly select one pose for priority loading
        this.state.priorityPose = poseOptions[Math.floor(Math.random() * poseOptions.length)];
        const priorityPosePath = `videos/${this.state.priorityPose}.mov`;
        
        console.log('🎯 Priority pose selected:', this.state.priorityPose);
        
        // Load critical videos in parallel
        const criticalPromises = [
            this.preloadSingleVideo(idlePath),
            this.preloadSingleVideo(priorityPosePath)
        ];
        
        try {
            const results = await Promise.allSettled(criticalPromises);
            
            // Track which poses loaded successfully
            if (results[1].status === 'fulfilled') {
                this.state.loadedPoses.push(this.state.priorityPose);
                console.log('✅ Priority pose loaded:', this.state.priorityPose);
            }
            
            this.state.criticalVideosLoaded = true;
            console.log('🎉 Critical videos loaded! App ready for first capture.');
            
        } catch (error) {
            console.warn('⚠️ Some critical videos failed to load:', error);
            this.state.criticalVideosLoaded = true; // Still mark as ready
        }
    }

    /**
     * Phase 2: Background load remaining videos
     */
    async loadRemainingVideos() {
        console.log('📦 Phase 2: Background loading remaining videos...');
        
        // Get all pose videos except the priority one
        const poseOptions = this.poseVideos.filter(video => 
            !video.includes('idle') && video !== this.state.priorityPose
        );
        
        // Load remaining poses one by one to avoid overwhelming the network
        for (const pose of poseOptions) {
            const posePath = `videos/${pose}.mov`;
            
            try {
                await this.preloadSingleVideo(posePath);
                this.state.loadedPoses.push(pose);
                console.log('📦 Background loaded pose:', pose);
                
                // Small delay to not overwhelm the network
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.warn(`⚠️ Failed to background load ${pose}:`, error);
            }
        }
        
        this.state.videosLoaded = true;
        console.log('✅ All video loading completed! Loaded poses:', this.state.loadedPoses);
    }

    /**
     * Preload a single video
     */
    preloadSingleVideo(videoPath) {
        return new Promise((resolve, reject) => {
            if (this.videoCache.has(videoPath)) {
                resolve(this.videoCache.get(videoPath));
                return;
            }

            const video = document.createElement('video');
            video.setAttribute('preload', 'auto');
            video.setAttribute('muted', 'true');
            video.setAttribute('playsinline', 'true');
            video.src = videoPath;

            const onLoad = () => {
                console.log(`📦 Preloaded: ${videoPath}`);
                this.videoCache.set(videoPath, video);
                cleanup();
                resolve(video);
            };

            const onError = (error) => {
                console.warn(`❌ Failed to preload: ${videoPath}`, error);
                cleanup();
                reject(error);
            };

            const cleanup = () => {
                video.removeEventListener('loadeddata', onLoad);
                video.removeEventListener('error', onError);
            };

            video.addEventListener('loadeddata', onLoad, { once: true });
            video.addEventListener('error', onError, { once: true });

            // Start loading
            video.load();

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.videoCache.has(videoPath)) {
                    cleanup();
                    reject(new Error(`Timeout loading ${videoPath}`));
                }
            }, 10000);
        });
    }

    /**
     * Handle video failure gracefully
     */
    handleVideoFailure(videoElement, videoType) {
        console.log(`🔧 Handling ${videoType} video failure`);

        // Hide the failed video element
        videoElement.style.display = 'none';

        // Show fallback overlay if it's the character overlay
        if (videoType === 'idle') {
            this.setupFallbackOverlay();
        }

        // For pose videos, we'll continue without the visual effect
        if (videoType.includes('pose')) {
            console.log('📸 Continuing capture without pose video effect');
        }
    }

    /**
     * Clean up video resources to prevent memory leaks
     */
    cleanupVideoResources() {
        console.log('🧹 Cleaning up video resources...');

        // Clear video cache
        this.videoCache.forEach((video, path) => {
            video.src = '';
            video.load();
        });
        this.videoCache.clear();

        // Reset video elements
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
            if (video !== this.elements.cameraVideo) { // Don't touch camera video
                video.pause();
                video.currentTime = 0;
            }
        });

        console.log('✅ Video cleanup completed');
    }

    /**
     * Start periodic cleanup to maintain performance
     */
        startPeriodicCleanup() {
        // More frequent cleanup to prevent memory accumulation
        setInterval(() => {
            // Only cleanup if not currently capturing
            if (!this.state.isCapturing && this.state.criticalVideosLoaded) {
                console.log('🧹 Performing periodic video maintenance...');
                
                // Enhanced idle video health check
                const idleVideo = this.elements.characterOverlay;
                if (idleVideo) {
                    // Check for various error states
                    if (idleVideo.error || 
                        idleVideo.networkState === 3 || // NETWORK_NO_SOURCE
                        idleVideo.readyState === 0 ||   // HAVE_NOTHING
                        (idleVideo.paused && !idleVideo.ended)) {
                        
                        console.log('🔧 Refreshing problematic idle video');
                        idleVideo.load();
                        
                        // Attempt to restart playback
                        setTimeout(() => {
                            idleVideo.play().catch(e => 
                                console.warn('Failed to restart idle video:', e)
                            );
                        }, 500);
                    }
                }
                
                // Aggressive cleanup of orphaned elements
                const allVideos = document.querySelectorAll('video');
                allVideos.forEach(video => {
                    if (video !== this.elements.cameraVideo && 
                        video !== this.elements.characterOverlay && 
                        video !== this.state.currentPoseVideo) {
                        
                        // Remove any disconnected or problematic videos
                        if (!video.parentNode || video.error || video.networkState === 3) {
                            try {
                                video.pause();
                                video.src = '';
                                if (video.parentNode) {
                                    video.parentNode.removeChild(video);
                                    console.log('🗑️ Removed problematic video element');
                                }
                            } catch (error) {
                                console.warn('Failed to remove problematic video:', error);
                            }
                        }
                    }
                });
                
                console.log('✅ Periodic maintenance completed');
            }
        }, 60000); // Every 1 minute (more frequent)
        
        // Additional memory optimization every 5 minutes
        setInterval(() => {
            if (!this.state.isCapturing && this.state.captureCount > 0) {
                console.log('♻️ Deep memory optimization cycle...');
                
                // Force browser to clean up unused resources
                if (window.gc) {
                    window.gc(); // Chrome dev tools garbage collection
                }
                
                console.log(`📊 Current capture count: ${this.state.captureCount}`);
                console.log(`📦 Loaded poses: ${this.state.loadedPoses.join(', ')}`);
            }
        }, 300000); // Every 5 minutes
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
                aspectRatio: { ideal: 3 / 4 }, // Portrait aspect ratio
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

            // Phase 1: Play pose instruction video immediately
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
     * Phase 1: Play pose instruction video immediately and keep it playing during countdown
     */
    async playPoseInstruction() {
        console.log('🎭 Phase 1: Playing pose instruction and setup for countdown');

        return new Promise((resolve) => {
            // Hide the idle video immediately when capture starts
            this.elements.characterOverlay.style.display = 'none';

            // Smart pose selection: prefer loaded poses, fallback to any available
            let poseOptions = this.state.loadedPoses.length > 0 
                ? this.state.loadedPoses 
                : this.poseVideos.filter(video => !video.includes('idle'));
            
            // If no poses are loaded yet, use priority pose if available
            if (poseOptions.length === 0 && this.state.priorityPose) {
                poseOptions = [this.state.priorityPose];
            }
            
            const randomPose = poseOptions[Math.floor(Math.random() * poseOptions.length)];
            
            console.log('🎯 Pose selection:', {
                loadedPoses: this.state.loadedPoses,
                priorityPose: this.state.priorityPose,
                selectedPose: randomPose,
                criticalLoaded: this.state.criticalVideosLoaded
            });

            console.log('🎯 Available videos:', this.poseVideos);
            console.log('🎯 Pose options (filtered):', poseOptions);
            console.log('🎯 Selected pose:', randomPose);

            // Determine video path
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const isAndroid = /Android/.test(navigator.userAgent);
            const isMobile = isIOS || isAndroid || /Mobile|webOS|BlackBerry|Opera Mini|IEMobile|Windows Phone/.test(navigator.userAgent);
            const useIOSVideo = (isIOS && isMobile) || (!isMobile && !isAndroid);
            const videoPath = useIOSVideo ? `videos/${randomPose}.mov` : `videos/${randomPose}.webm`;

            // Try to use preloaded video first, fallback to creating new element
            let poseVideo = this.videoCache.get(videoPath);

            if (poseVideo) {
                console.log('📦 Using preloaded pose video:', videoPath);
                // Clone the preloaded video to avoid conflicts
                poseVideo = poseVideo.cloneNode(true);
            } else {
                console.log('⚠️ Creating new pose video element (not preloaded):', videoPath);
                poseVideo = document.createElement('video');

                // Enhanced video attributes for better performance
                poseVideo.setAttribute('preload', 'auto');
                poseVideo.setAttribute('muted', 'true');
                poseVideo.setAttribute('playsinline', 'true');
                poseVideo.setAttribute('webkit-playsinline', 'true');

                const source = document.createElement('source');
                source.src = videoPath;
                source.type = useIOSVideo ? 'video/quicktime' : 'video/webm; codecs=vp9';
                poseVideo.appendChild(source);
            }

            // Configure video element
            poseVideo.className = 'character-overlay';
            poseVideo.style.zIndex = '20'; // Higher than base overlay
            poseVideo.style.display = 'block';
            poseVideo.muted = true;
            poseVideo.playsInline = true;
            poseVideo.loop = true; // Loop the pose video

            // Force proper positioning for pose videos on mobile
            poseVideo.style.position = 'absolute';
            poseVideo.style.top = '50%';
            poseVideo.style.left = '50%';
            poseVideo.style.width = '100%';
            poseVideo.style.height = '100%';
            poseVideo.style.transform = 'translate(-50%, -50%)';
            poseVideo.style.objectFit = 'contain';

            console.log('🎭 Pose instruction:', {
                pose: randomPose,
                src: videoPath,
                preloaded: this.videoCache.has(videoPath),
                format: useIOSVideo ? 'MOV' : 'WebM'
            });

            // Add to DOM
            this.elements.cameraVideo.parentNode.appendChild(poseVideo);
            this.state.currentPoseVideo = poseVideo;

            // Enhanced event handlers for better reliability
            this.setupVideoLoadingWithRetry(poseVideo, 'pose-instruction', 2);

            // Prevent video from pausing and ensure smooth playback
            poseVideo.addEventListener('pause', () => {
                console.log('🎬 Pose video paused - attempting to resume');
                if (!poseVideo.ended) {
                    poseVideo.play().catch(e => console.warn('Failed to resume paused pose video:', e));
                }
            });

            poseVideo.addEventListener('ended', () => {
                console.log('🔄 Pose video ended - restarting loop');
                poseVideo.currentTime = 0;
                poseVideo.play().catch(e => console.warn('Failed to restart pose video:', e));
            });

            // Enhanced loading detection
            const checkAndPlay = () => {
                if (poseVideo.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                    poseVideo.play().then(() => {
                        console.log('✅ Pose video started and will continue through countdown');
                        resolve();
                    }).catch((error) => {
                        console.warn('Pose instruction video failed to play:', error);
                        resolve();
                    });
                } else {
                    // If video from cache, it should already be loaded
                    if (this.videoCache.has(videoPath)) {
                        console.log('📦 Cached video not ready, attempting play anyway');
                        poseVideo.play().then(() => {
                            console.log('✅ Cached pose video started');
                            resolve();
                        }).catch(() => {
                            console.warn('❌ Cached pose video failed to play');
                            resolve();
                        });
                    } else {
                        // Wait for new video to load
                        poseVideo.addEventListener('loadeddata', () => {
                            poseVideo.play().then(() => {
                                console.log('✅ New pose video loaded and started');
                                resolve();
                            }).catch(() => {
                                console.warn('❌ New pose video failed to play');
                                resolve();
                            });
                        }, { once: true });

                        // Fallback timeout
                        setTimeout(() => {
                            console.warn('⏰ Pose video loading timeout');
                            resolve();
                        }, 2000);
                    }
                }
            };

            // Start the process
            setTimeout(checkAndPlay, 50);

            // Error fallback
            poseVideo.addEventListener('error', () => {
                console.warn('❌ Pose instruction video failed to load');
                resolve();
            });

            // Fallback timeout
            setTimeout(() => {
                console.log('✅ Phase 1 timeout - continuing to countdown');
                resolve();
            }, 3000);
        });
    }

    /**
 * Phase 2: 3-second countdown (pose video continues playing during countdown)
 */
    async startCountdown() {
        console.log('⏰ Phase 2: Starting countdown (3s) - pose video continues playing');

        return new Promise(async (resolve) => {
            // Ensure pose video keeps playing during countdown
            if (this.state.currentPoseVideo && this.state.currentPoseVideo.paused) {
                console.log('🎬 Resuming pose video during countdown');
                this.state.currentPoseVideo.play().catch(e => console.warn('Failed to resume pose video:', e));
            }

            // Show countdown overlay (pose video keeps playing underneath)
            this.elements.countdownOverlay.classList.remove('hidden');

            // Countdown from 3 to 1 (pose video continues playing)
            for (let i = 3; i >= 1; i--) {
                // Ensure pose video is still playing at each countdown step
                if (this.state.currentPoseVideo && this.state.currentPoseVideo.paused) {
                    console.log(`🎬 Resuming pose video at countdown ${i}`);
                    this.state.currentPoseVideo.play().catch(e => console.warn('Failed to resume pose video at countdown:', e));
                }

                // Update countdown number
                this.elements.countdownNumber.textContent = i;

                // Trigger animation by removing and re-adding class
                this.elements.countdownNumber.style.animation = 'none';
                this.elements.countdownNumber.offsetHeight; // Trigger reflow
                this.elements.countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';

                console.log(`⏱️ Countdown: ${i} (pose video playing: ${this.state.currentPoseVideo ? !this.state.currentPoseVideo.paused : 'no video'})`);

                // Wait exactly 1 second
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Hide countdown overlay and wait for UI to stabilize
            this.elements.countdownOverlay.classList.add('hidden');

            // Final check to ensure pose video is still playing before capture
            if (this.state.currentPoseVideo && this.state.currentPoseVideo.paused) {
                console.log('🎬 Final resume of pose video before capture');
                this.state.currentPoseVideo.play().catch(e => console.warn('Failed to resume pose video before capture:', e));
            }

            // Small delay to ensure display is stable before capture
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('✅ Phase 2 complete - pose video still playing, ready for capture');
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

        // Capture the frame (with pose video still visible)
        await this.captureFrame();

        // Clean up pose video after capture
        this.cleanupPoseVideos();

        // Restore idle video for next capture
        this.elements.characterOverlay.style.display = 'block';

        console.log('✅ Phase 3 complete - photo captured with effects, pose video cleaned up, idle restored');
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
     * Enhanced cleanup for pose videos with memory leak prevention
     */
    cleanupPoseVideos() {
        // Clean up current pose video
        if (this.state.currentPoseVideo) {
            try {
                // Pause and reset video to free resources
                this.state.currentPoseVideo.pause();
                this.state.currentPoseVideo.currentTime = 0;
                this.state.currentPoseVideo.src = '';
                
                // Remove from DOM
                if (this.state.currentPoseVideo.parentNode) {
                    this.state.currentPoseVideo.parentNode.removeChild(this.state.currentPoseVideo);
                }
                
                this.state.currentPoseVideo = null;
                console.log('🧹 Enhanced cleanup: pose video resources freed');
            } catch (error) {
                console.warn('Failed to cleanup pose video:', error);
            }
        }
        
        // Clean up any orphaned pose videos (memory leak prevention)
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach(video => {
            // Remove any video that's not the camera video or idle overlay
            if (video !== this.elements.cameraVideo && 
                video !== this.elements.characterOverlay &&
                video.className.includes('character-overlay')) {
                
                try {
                    video.pause();
                    video.currentTime = 0;
                    video.src = '';
                    if (video.parentNode) {
                        video.parentNode.removeChild(video);
                        console.log('🧹 Removed orphaned pose video');
                    }
                } catch (error) {
                    console.warn('Failed to cleanup orphaned video:', error);
                }
            }
        });
        
        // Increment capture count for monitoring
        this.state.captureCount++;
        console.log(`📊 Capture #${this.state.captureCount} - Memory cleanup completed`);
        
        // Force garbage collection hint every 5 captures
        if (this.state.captureCount % 5 === 0) {
            console.log('🗑️ Capture milestone reached, suggesting garbage collection');
            // Force a small delay to allow garbage collection
            setTimeout(() => {
                console.log('♻️ Memory optimization window completed');
            }, 100);
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

        // Use the current pose video if it's playing, otherwise use the idle video
        const videoToCapture = this.state.currentPoseVideo || characterOverlay;

        console.log('🎬 CAPTURE DEBUG:', {
            currentPoseVideo: this.state.currentPoseVideo,
            characterOverlay: characterOverlay,
            videoToCapture: videoToCapture,
            videoSrc: videoToCapture ? videoToCapture.currentSrc : 'none',
            readyState: videoToCapture ? videoToCapture.readyState : 'none'
        });

        if (videoToCapture && videoToCapture.readyState >= 2) {
            try {
                const overlayAspect = videoToCapture.videoWidth / videoToCapture.videoHeight;
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

                console.log('📏 Video overlay drawing with object-fit: contain behavior:', {
                    videoType: this.state.currentPoseVideo ? 'pose' : 'idle',
                    overlaySize: `${videoToCapture.videoWidth}x${videoToCapture.videoHeight}`,
                    drawSize: `${overlayDrawWidth}x${overlayDrawHeight}`,
                    drawPos: `${overlayDrawX},${overlayDrawY}`
                });

                ctx.drawImage(videoToCapture, overlayDrawX, overlayDrawY, overlayDrawWidth, overlayDrawHeight);
                console.log('✅ Video overlay captured:', this.state.currentPoseVideo ? 'pose video' : 'idle video');
            } catch (error) {
                console.warn('Video overlay capture failed:', error);
            }
        }

        // Add frame and logos on top
        this.drawCustomFrame(ctx, targetWidth, targetHeight);

        // Convert to image data
        this.state.capturedImageData = canvas.toDataURL('image/jpeg', 0.9);
        this.elements.capturedImage.src = this.state.capturedImageData;

        console.log('✅ Final capture complete - matches screen view');

        // Share functionality removed - using press and hold instead
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

        // Make sure idle video is visible and any pose videos are cleaned up
        this.cleanupPoseVideos();
        this.elements.characterOverlay.style.display = 'block';

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
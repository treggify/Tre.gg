class ShaderBackground {
    constructor(targetElement) {
        this.targetElement = targetElement;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true // Enable transparency
        });
        this.mouse = new THREE.Vector2(0.5, 0.5);
        this.clock = new THREE.Clock();
        
        // Add smoothed mouse position and velocity
        this.smoothedMouse = new THREE.Vector2(0.5, 0.5);
        this.targetMouse = new THREE.Vector2(0.5, 0.5);
        this.mouseVelocity = new THREE.Vector2(0, 0);
        
        this.init();
        this.createMesh();
        this.addEventListeners();
        this.animate();
    }
    
    init() {
        // Set renderer to match target element size
        const bounds = this.targetElement.getBoundingClientRect();
        this.renderer.setSize(bounds.width, bounds.height);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '-1';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        
        // Add canvas to target element
        this.targetElement.style.position = 'relative';
        this.targetElement.style.height = '100%';
        this.targetElement.style.width = '100%';
        this.targetElement.insertBefore(this.renderer.domElement, this.targetElement.firstChild);
        
        // Initial resize to match container
        this.onResize();
    }
    
    createMesh() {
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uMouse: { value: this.mouse },
                uSeed: { value: Math.random() * 100.0 }
            }
        });
        
        const mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(mesh);
    }
    
    addEventListeners() {
        window.addEventListener('resize', this.onResize.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
    }
    
    onResize() {
        if (!this.material || !this.scene.children[0]) return;
        
        const bounds = this.targetElement.getBoundingClientRect();
        this.renderer.setSize(bounds.width, bounds.height, false);
        this.material.uniforms.uResolution.value.set(bounds.width, bounds.height);
        
        // Force aspect ratio to match container
        const mesh = this.scene.children[0];
        mesh.scale.x = 1;
        mesh.scale.y = bounds.height / bounds.width;
    }
    
    onMouseMove(event) {
        // Update target mouse position
        this.targetMouse.x = event.clientX / window.innerWidth;
        this.targetMouse.y = 1 - (event.clientY / window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Smooth mouse movement with momentum
        const smoothFactor = 0.05;  // Reduced for more lag
        const momentum = 0.85;      // Higher = more momentum
        
        // Calculate velocity
        this.mouseVelocity.x = (this.targetMouse.x - this.smoothedMouse.x) * smoothFactor;
        this.mouseVelocity.y = (this.targetMouse.y - this.smoothedMouse.y) * smoothFactor;
        
        // Apply velocity with momentum
        this.smoothedMouse.x += this.mouseVelocity.x;
        this.smoothedMouse.y += this.mouseVelocity.y;
        
        // Apply momentum (preserve some of the velocity)
        this.mouseVelocity.multiplyScalar(momentum);
        
        const mesh = this.scene.children[0];
        mesh.material.uniforms.uTime.value = this.clock.getElapsedTime();
        mesh.material.uniforms.uMouse.value = this.smoothedMouse;
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize shader backgrounds for all patternbg elements
function initShaderBackgrounds() {
    const elements = document.getElementsByClassName('patternbg');
    
    // Check if Three.js is already loaded
    if (typeof THREE === 'undefined') {
        // Load Three.js first
        const threeScript = document.createElement('script');
        threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        threeScript.onload = () => {
            // Create shader background for each element
            Array.from(elements).forEach(element => {
                try {
                    new ShaderBackground(element);
                } catch (e) {
                    console.warn('Error initializing WebGL background:', e);
                    // Will fall back to CSS background
                }
            });
        };
        document.head.appendChild(threeScript);
    } else {
        // Three.js already loaded, initialize immediately
        Array.from(elements).forEach(element => {
            try {
                new ShaderBackground(element);
            } catch (e) {
                console.warn('Error initializing WebGL background:', e);
                // Will fall back to CSS background
            }
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShaderBackgrounds);
} else {
    initShaderBackgrounds();
} 
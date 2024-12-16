// Vertex shader - handles position and UV coordinates
const vertexShader = `
    // UV coordinates passed to fragment shader for texture mapping
    varying vec2 vUv;
    
    void main() {
        // Pass UV coordinates to fragment shader unchanged
        vUv = uv;
        // Convert 3D position to clip space (screen coordinates)
        gl_Position = vec4(position, 1.0);
    }
`;

// Fragment shader - handles all pixel coloring and effects
const fragmentShader = `
    // Time value passed from JavaScript for animation
    uniform float uTime;
    // Screen resolution for pixel calculations
    uniform vec2 uResolution;
    // Mouse position in normalized coordinates
    uniform vec2 uMouse;
    // UV coordinates received from vertex shader
    varying vec2 vUv;
    // Seed value passed from JavaScript for randomization
    uniform float uSeed;

    // Simplex noise helper functions
    // Modulo 289 without floating point arithmetic
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    // Permutation function for noise generation
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    // Simplex noise implementation
    float snoise(vec2 v) {
        // Constants for noise calculation
        const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                           0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                           -0.577350269189626,  // -1.0 + 2.0 * C.x
                           0.024390243902439); // 1.0 / 41.0
        
        // First corner calculation
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);

        // Other corners
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;

        // Permutations
        i = mod289(i); // Avoid truncation effects in permutation
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

        // Gradients: 41 points uniformly over a line, mapped onto a diamond
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; // m *= m to increase contrast
        m = m*m; // m *= m to increase contrast further

        // Calculate final noise value at P
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g); // Scale output to [-1,1]
    }

    // Bayer matrix for dithering pattern
    float getBayerFromCoordLevel(vec2 pixelCoord) {
        // 8x8 Bayer matrix dimension
        const int bayerMatrixDim = 8;
        // 8x8 Bayer dithering pattern normalized to [0,1]
        const float bayerMatrix[64] = float[64](
            0.0/64.0,  32.0/64.0,  8.0/64.0, 40.0/64.0,  2.0/64.0, 34.0/64.0, 10.0/64.0, 42.0/64.0,
            48.0/64.0, 16.0/64.0, 56.0/64.0, 24.0/64.0, 50.0/64.0, 18.0/64.0, 58.0/64.0, 26.0/64.0,
            12.0/64.0, 44.0/64.0,  4.0/64.0, 36.0/64.0, 14.0/64.0, 46.0/64.0,  6.0/64.0, 38.0/64.0,
            60.0/64.0, 28.0/64.0, 52.0/64.0, 20.0/64.0, 62.0/64.0, 30.0/64.0, 54.0/64.0, 22.0/64.0,
            3.0/64.0,  35.0/64.0, 11.0/64.0, 43.0/64.0,  1.0/64.0, 33.0/64.0,  9.0/64.0, 41.0/64.0,
            51.0/64.0, 19.0/64.0, 59.0/64.0, 27.0/64.0, 49.0/64.0, 17.0/64.0, 57.0/64.0, 25.0/64.0,
            15.0/64.0, 47.0/64.0,  7.0/64.0, 39.0/64.0, 13.0/64.0, 45.0/64.0,  5.0/64.0, 37.0/64.0,
            63.0/64.0, 31.0/64.0, 55.0/64.0, 23.0/64.0, 61.0/64.0, 29.0/64.0, 53.0/64.0, 21.0/64.0
        );
        
        // Get x,y coordinates within the 8x8 pattern
        int x = int(mod(pixelCoord.x, float(bayerMatrixDim)));
        int y = int(mod(pixelCoord.y, float(bayerMatrixDim)));
        // Return the pattern value for this pixel
        return bayerMatrix[x + y * bayerMatrixDim];
    }

    // Apply dithering to a color
    vec3 dither(vec3 color, vec2 pixelCoord) {
        // Scale down the pixel coordinates for larger dither pattern
        vec2 scaledCoord = pixelCoord * 0.5; // Makes dither pattern 2x larger
        float bayerValue = getBayerFromCoordLevel(scaledCoord);
        
        // More aggressive quantization
        float ditherSteps = 3.0;  // Reduced for much lower precision
        
        // Adjust dither to preserve darkness
        bayerValue *= 0.7; // Reduce dither intensity to keep darker values dark
        vec3 ditherColor = floor(color * ditherSteps + bayerValue) / ditherSteps;
        
        return ditherColor;
    }

    void main() {
        vec2 uv = vUv;
        
        // Add cursor influence on the UV coordinates
        float mouseInfluence = 1.15; // Strength of cursor effect
        vec2 mouseOffset = (uMouse - uv) * mouseInfluence;
        vec2 distortion = mouseOffset * exp(-length(uMouse - uv) * 5.0);
        // Clamp the distortion to limit the blur effect
        distortion = clamp(distortion, -0.1, 0.1);
        vec2 distortedUV = uv + distortion;
        
        // Create two separate blob layers with different movement (much slower time values)
        float blob1 = snoise(distortedUV * 0.6 + uTime * 0.01 + vec2(uSeed)) * 0.5 +
                     snoise(distortedUV * 1.2 - uTime * 0.015 + vec2(uSeed * 1.5)) * 0.25;
        
        float blob2 = snoise(distortedUV * 0.8 - uTime * 0.012 + vec2(uSeed * 2.0)) * 0.5 +
                     snoise(distortedUV * 1.0 + uTime * 0.008 + vec2(uSeed * 2.5)) * 0.25;
        
        // Add some sharper detail to the blobs
        float detail = snoise(distortedUV * 3.0 + uTime * 0.007 + vec2(uSeed * 3.0)) * 0.15;
        
        // Create center bias (inverted to push to edges)
        float centerDistance = length(uv - 0.5) * 2.0;
        float edgeBias = 1.0 - smoothstep(0.0, 1.0, centerDistance);
        
        // Apply edge bias to blobs (stronger reduction)
        blob1 = mix(blob1, blob1 * 0.05, edgeBias);  // Reduced from 0.1 to 0.05 for darker center
        blob2 = mix(blob2, blob2 * 0.05, edgeBias);
        
        blob1 += detail;
        blob2 += detail;
        
        // Define colors (same as before)
        vec3 blobColor1 = vec3(0.0, 0.588, 0.784);    // #0096C8
        vec3 blobColor2 = vec3(0.0, 0.784, 0.627);    // #00C8A0
        vec3 backgroundColor = vec3(0.012, 0.051, 0.043);  // #030D0B
        
        // Add noise in background color
        float bgNoise = snoise(uv * 20.0 + vec2(uSeed * 4.0)) * 0.03;
        vec3 noisyBg = backgroundColor + (backgroundColor * bgNoise);
        
        // Create smooth blob masks with adjusted thresholds
        float blob1Mask = smoothstep(0.1, 0.3, blob1);
        float blob2Mask = smoothstep(0.1, 0.3, blob2);
        
        // Mix colors with background
        vec3 finalColor = backgroundColor;
        
        // Layer the blobs with reduced opacity
        finalColor = mix(finalColor, blobColor1, blob1Mask * 0.75);  // Increase to 80% opacity
        finalColor = mix(finalColor, blobColor2, blob2Mask * 0.75);  // Increase to 70% opacity
        
        // Add fine noise using background color to break up banding
        float gradientNoise = snoise(uv * 400.0 + vec2(uSeed * 5.0)) * .3;
        finalColor += backgroundColor * gradientNoise;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`; 
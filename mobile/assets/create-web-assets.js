#!/usr/bin/env node

/**
 * VaultKe Web Assets Generator
 * Creates PNG versions of our premium SVG logos for web use
 */

const fs = require('fs');
const path = require('path');

// Create a simple HTML file that can be used to generate PNGs from SVGs
const createPngGeneratorHtml = () => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>VaultKe Asset Generator</title>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            background: #0D1117; 
            color: white; 
            font-family: Arial, sans-serif;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
        }
        .asset-section {
            margin: 30px 0;
            padding: 20px;
            background: #161B22;
            border-radius: 10px;
        }
        .asset-preview {
            display: inline-block;
            margin: 10px;
            padding: 10px;
            background: white;
            border-radius: 5px;
        }
        canvas {
            border: 1px solid #ccc;
            margin: 5px;
        }
        .instructions {
            background: #1E293B;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 VaultKe Web Assets Generator</h1>
        
        <div class="instructions">
            <h3>📋 Instructions:</h3>
            <p>1. Right-click on each logo below and "Save image as..."</p>
            <p>2. Save with the exact filenames shown</p>
            <p>3. Place files in the assets/ directory</p>
        </div>
        
        <div class="asset-section">
            <h2>Favicon (32x32)</h2>
            <div class="asset-preview">
                <canvas id="favicon" width="32" height="32"></canvas>
                <p>Save as: <strong>favicon.png</strong></p>
            </div>
        </div>
        
        <div class="asset-section">
            <h2>App Icon (512x512)</h2>
            <div class="asset-preview">
                <canvas id="icon" width="512" height="512"></canvas>
                <p>Save as: <strong>icon.png</strong></p>
            </div>
        </div>
        
        <div class="asset-section">
            <h2>Splash Icon (1024x1024)</h2>
            <div class="asset-preview">
                <canvas id="splash" width="1024" height="1024"></canvas>
                <p>Save as: <strong>splash-icon.png</strong></p>
            </div>
        </div>
        
        <div class="asset-section">
            <h2>Adaptive Icon (512x512)</h2>
            <div class="asset-preview">
                <canvas id="adaptive" width="512" height="512"></canvas>
                <p>Save as: <strong>adaptive-icon.png</strong></p>
            </div>
        </div>
    </div>

    <script>
        // VaultKe Premium Logo Generator
        function drawVaultLogo(canvas, size) {
            const ctx = canvas.getContext('2d');
            const center = size / 2;
            
            // Clear canvas
            ctx.clearRect(0, 0, size, size);
            
            // Create gradients
            const steelGradient = ctx.createRadialGradient(
                center * 0.6, center * 0.5, 0,
                center, center, center * 0.8
            );
            steelGradient.addColorStop(0, '#FFFFFF');
            steelGradient.addColorStop(0.5, '#CBD5E1');
            steelGradient.addColorStop(1, '#64748B');
            
            const rimGradient = ctx.createRadialGradient(
                center, center * 0.7, 0,
                center, center, center
            );
            rimGradient.addColorStop(0, '#1E293B');
            rimGradient.addColorStop(1, '#0F172A');
            
            const goldGradient = ctx.createRadialGradient(
                center * 0.75, center * 0.75, 0,
                center, center, center * 0.3
            );
            goldGradient.addColorStop(0, '#FEF3C7');
            goldGradient.addColorStop(1, '#F59E0B');
            
            // Draw outer rim
            ctx.fillStyle = rimGradient;
            ctx.beginPath();
            ctx.arc(center, center, center * 0.95, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw main vault door
            ctx.fillStyle = steelGradient;
            ctx.beginPath();
            ctx.arc(center, center, center * 0.75, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = size * 0.01;
            ctx.stroke();
            
            // Draw security bolts
            const boltSize = size * 0.02;
            const boltDistance = center * 0.6;
            ctx.fillStyle = '#0F172A';
            [
                [center - boltDistance, center - boltDistance],
                [center + boltDistance, center - boltDistance],
                [center - boltDistance, center + boltDistance],
                [center + boltDistance, center + boltDistance]
            ].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x, y, boltSize, 0, 2 * Math.PI);
                ctx.fill();
            });
            
            // Draw central lock
            ctx.fillStyle = goldGradient;
            ctx.beginPath();
            ctx.arc(center, center, center * 0.25, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#92400E';
            ctx.lineWidth = size * 0.005;
            ctx.stroke();
            
            // Draw lock spokes
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = size * 0.008;
            ctx.lineCap = 'round';
            
            const spokeLength = center * 0.15;
            const spokeStart = center * 0.4;
            
            // Vertical and horizontal spokes
            ctx.beginPath();
            ctx.moveTo(center, center - spokeStart - spokeLength);
            ctx.lineTo(center, center - spokeStart);
            ctx.moveTo(center, center + spokeStart);
            ctx.lineTo(center, center + spokeStart + spokeLength);
            ctx.moveTo(center - spokeStart - spokeLength, center);
            ctx.lineTo(center - spokeStart, center);
            ctx.moveTo(center + spokeStart, center);
            ctx.lineTo(center + spokeStart + spokeLength, center);
            ctx.stroke();
            
            // Central handle
            ctx.fillStyle = '#FCD34D';
            ctx.beginPath();
            ctx.arc(center, center, center * 0.08, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = '#FEF3C7';
            ctx.beginPath();
            ctx.arc(center, center, center * 0.04, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        // Generate all assets
        drawVaultLogo(document.getElementById('favicon'), 32);
        drawVaultLogo(document.getElementById('icon'), 512);
        drawVaultLogo(document.getElementById('splash'), 1024);
        drawVaultLogo(document.getElementById('adaptive'), 512);
        
        console.log('✅ VaultKe web assets generated successfully!');
        console.log('📋 Right-click each canvas and save as PNG with the specified filename.');
    </script>
</body>
</html>
  `;
  
  return html;
};

// Write the HTML generator
const htmlContent = createPngGeneratorHtml();
fs.writeFileSync(path.join(__dirname, 'asset-generator.html'), htmlContent);

console.log('✅ Asset generator created!');
console.log('📋 Open asset-generator.html in your browser to generate PNG assets.');
console.log('🎯 Right-click each canvas and save as PNG with the specified filename.');

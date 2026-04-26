import fs from 'fs';
import path from 'path';
import https from 'https';

const TEXTURES = [
  { name: 'sun.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_sun.jpg' },
  { name: 'mercury.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_mercury.jpg' },
  { name: 'venus.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg' },
  { name: 'earth.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg' },
  { name: 'earth_clouds.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg' },
  { name: 'moon.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_moon.jpg' },
  { name: 'mars.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_mars.jpg' },
  { name: 'jupiter.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg' },
  { name: 'saturn.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_saturn.jpg' },
  { name: 'saturn_ring.png', url: 'https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png' },
  { name: 'uranus.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_uranus.jpg' },
  { name: 'neptune.jpg', url: 'https://www.solarsystemscope.com/textures/download/2k_neptune.jpg' }
];

const DIR = path.join(process.cwd(), 'public', 'textures');

if (!fs.existsSync(DIR)) {
  fs.mkdirSync(DIR, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    // Some sites redirect or reject without User-Agent
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    };
    const request = https.get(url, options, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  console.log('Starting texture downloads...');
  for (const tex of TEXTURES) {
    const dest = path.join(DIR, tex.name);
    if (!fs.existsSync(dest)) {
      console.log(`Downloading ${tex.name}...`);
      try {
        await download(tex.url, dest);
        console.log(`Successfully downloaded ${tex.name}`);
      } catch (err) {
        console.error(`Error downloading ${tex.name}:`, err.message);
      }
    } else {
      console.log(`Already exists: ${tex.name}`);
    }
  }
  console.log('All downloads complete!');
}

main();

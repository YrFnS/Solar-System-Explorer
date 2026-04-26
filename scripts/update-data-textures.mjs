import fs from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'src/components/solar-system/data.ts');
let content = fs.readFileSync(dataPath, 'utf8');

const textures = {
  sun: { textureUrl: "'/textures/sun.jpg'" },
  mercury: { textureUrl: "'/textures/mercury.jpg'" },
  venus: { textureUrl: "'/textures/venus.jpg'" },
  earth: { textureUrl: "'/textures/earth.jpg'", cloudMapUrl: "'/textures/earth_clouds.jpg'" },
  mars: { textureUrl: "'/textures/mars.jpg'" },
  jupiter: { textureUrl: "'/textures/jupiter.jpg'" },
  saturn: { textureUrl: "'/textures/saturn.jpg'", ringTextureUrl: "'/textures/saturn_ring.png'" },
  uranus: { textureUrl: "'/textures/uranus.jpg'", ringTextureUrl: "'/textures/saturn_ring.png'" }, // Reusing saturn ring temporarily
  neptune: { textureUrl: "'/textures/neptune.jpg'" },
  pluto: { textureUrl: "''" }, // Just empty string for now or default
};

// Update Sun
if (!content.includes("textureUrl: '/textures/sun.jpg'")) {
  content = content.replace(
    /export const sunData = \{([\s\S]*?)\}/,
    (match, inner) => {
      if (inner.includes('textureUrl')) return match;
      return `export const sunData = {${inner.trimEnd()},\n  textureUrl: '/textures/sun.jpg',\n}`;
    }
  );
}

// Update planets
for (const [id, props] of Object.entries(textures)) {
  if (id === 'sun') continue;
  
  const regex = new RegExp(`(id:\\s*'${id}'[\\s\\S]*?)(moons:\\s*\\[)`, 'g');
  content = content.replace(regex, (match, p1, p2) => {
    if (p1.includes('textureUrl:')) return match; // Already updated
    
    let injected = '';
    for (const [key, val] of Object.entries(props)) {
      injected += `    ${key}: ${val},\n`;
    }
    
    return p1.trimEnd() + '\n' + injected + '    ' + p2;
  });
}

// Update moon
if (!content.includes("textureUrl: '/textures/moon.jpg'")) {
  content = content.replace(
    /(name:\s*'Moon'[\s\S]*?)(funFact:\s*'.*?')/,
    (match, p1, p2) => {
      return p1 + p2 + ",\n        textureUrl: '/textures/moon.jpg'";
    }
  );
}

fs.writeFileSync(dataPath, content, 'utf8');
console.log('Successfully updated data.ts with texture URLs');

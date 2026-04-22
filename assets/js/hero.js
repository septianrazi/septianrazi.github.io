/* =============================================================
   HERO.JS  ·  Razi Portfolio — 3D Graph Scene
   ─────────────────────────────────────────────────────────────
   Changes in this version
   ──────────────────────────────────────────────────────────────
   · New node layout: work=far right, projects=bottom-left,
     blog=top-left, about+contact above hero, contact=far left-back
   · Camera offset: each section cam is shifted left so the node
     sits on the right half of the screen
   · Live-tracking edges: rebuilt every frame from current child
     world-positions (no more stale static geometry)
   · Focus colour system: unfocused nodes/children lerp to a
     desaturated grey-red; focused section stays full red
   · Dynamic scroll mapping: section focus derived from DOM
     section offsetTop positions, not fixed scrollFrac math
   · Projects → double-row arc layout (organic, scalable)
   · Blog → spiral layout (scales to any number of posts)
   · Performance: child rings removed; section sphere segments
     reduced; particles reduced; per-frame allocs minimised
   · setTheme('light'|'dark') public API kept
================================================================= */

/* ── Expected globals (define in your HTML before this file) ──
   SKILLS      string[]
   EXPERIENCE  any[]
   PROJECTS    any[]
   BLOG_POSTS  any[]
   CONTACTS    any[]   (optional, falls back to 4)
──────────────────────────────────────────────────────────────── */

'use strict';

let renderer, scene, camera, graphGroup, frameId;
let scrollFrac = 0, lastScrollY = -1, cachedFocusName = 'hero';
let mouse = { x: 0, y: 0 }, targetMouse = { x: 0, y: 0 };

let sectionNodes        = {};   // secKey → section Group
let instancedChildren;          // InstancedMesh for all OTHER cores
let instancedChildData  = [];   // Data for each instanced child
let aboutChildNodes     = [];   // Individual meshes/sprites for About section
let childEdgesMesh, hubEdgesMesh; // LineSegments
let projectBranchEdges, projectLeafEdges; // Separate project edges for hierarchy
let isDark = true;

/* ── Texture loader & Logo mapping ─────────────────────────── */
const texLoader = new THREE.TextureLoader();
const logoTextures = {};

// Normalizes a string (e.g. "p5.JS" -> "p5js") for smarter matching
function normalizeName(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Dynamically finds a logo file in the manifest that matches the skill name.
 * Uses normalized matching so "three.JS" matches "Threejs.svg".
 */
function findLogoFile(skillName) {
  if (!window.TECH_STACK_MANIFEST || !Array.isArray(window.TECH_STACK_MANIFEST)) return null;
  const target = normalizeName(skillName);
  
  // Try to find an exact match first
  for (const filename of window.TECH_STACK_MANIFEST) {
    const basename = filename.split('.')[0];
    if (normalizeName(basename) === target) {
      return filename;
    }
  }
  
  // Specific fallbacks for common aliases
  const aliases = {
    'webxr': ['mrtk', 'webxr'],
    'threejs': ['threejs'],
    'p5js': ['p5js']
  };
  
  if (aliases[target]) {
    for (const alt of aliases[target]) {
      for (const filename of window.TECH_STACK_MANIFEST) {
        if (normalizeName(filename.split('.')[0]) === alt) return filename;
      }
    }
  }

  return null;
}

/**
 * Creates a white circular badge with a grayscale logo inside.
 * Processed on a canvas for high performance (zero per-frame cost).
 */
function loadBadgeTexture(path, callback, useBadge = true) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (useBadge) {
      // 1. Draw Red Circle
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2 - 4, 0, Math.PI * 2);
      ctx.fillStyle = '#cc0000'; // Matching T.nodeMain red
      ctx.fill();
    }

    // 2. Draw Logo
    ctx.save();
    
    if (useBadge) {
      // For badges: allow original brand colors, add saturation
      ctx.filter = 'saturate(1.5) contrast(1.1) brightness(1.1)';
    } else {
      // For plain logos: make them pure black
      ctx.filter = 'brightness(0)';
    }
    
    const padding = useBadge ? size * 0.22 : size * 0.05;
    const innerSize = size - padding * 2;
    const aspect = img.width / img.height;
    
    let drawW = innerSize, drawH = innerSize;
    if (aspect > 1) drawH = innerSize / aspect;
    else drawW = innerSize * aspect;
    
    ctx.drawImage(img, (size - drawW)/2, (size - drawH)/2, drawW, drawH);
    ctx.restore();

    callback(new THREE.CanvasTexture(canvas));
  };
  img.src = path;
}

/**
 * Creates a texture with text for tag nodes.
 */
function loadTextTexture(text, callback) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 1. Just White Text (No background badge as per request)
  ctx.fillStyle = '#ffffff'; 
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Choose font size based on text length
  const fontSize = text.length > 7 ? 48 : 64;
  ctx.font = `bold ${fontSize}px "Bebas Neue", sans-serif`;
  
  ctx.fillText(text.toUpperCase(), size/2, size/2 + size * 0.05); // slight offset for Bebas Neue centering

  callback(new THREE.CanvasTexture(canvas));
}

/* ── Reusable vectors — avoid per-frame heap allocation ─────── */
const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _vc = new THREE.Vector3();
const _scaleV = new THREE.Vector3();

/* ════════════════════════════════════════════════════════════
   NODE POSITIONS
   hero     – centre
   about    – slightly upper-left of hero, forward
   contact  – upper-right of hero, slightly behind
   work     – far right, alone, big Z variation
   projects – lower-left, forward
   blog     – upper-left, behind
════════════════════════════════════════════════════════════ */
const SEC_POS = {
  hero:     [  0.0,   0.0,   0.0 ],
  about:    [  0.0 ,  4.8,   1.5 ],
  work:     [ 11.5,   0.5,  -2.0 ],   // far right, alone
  projects: [ -7.0,  -5.5,   2.0 ],   // lower-left, forward
  blog:     [  4.5,   -5.5,  -3.0 ],   // upper-left, behind
  contact:  [ -9.0,   1.0,  5.0 ],   // far left, behind
};

const PROJECT_TAGS = ['XR', 'WebDev', 'Research', 'DataVis'];

/* ── Scroll section DOM order ───────────────────────────────── */
const SCROLL_SECTIONS = ['hero','about','work','projects','blog','contact'];

/* ── Camera path — fully hand-authored ──────────────────────
   One entry per SCROLL_SECTIONS element (hero → contact).
   p = [x, y, z]  camera world position
   l = [x, y, z]  lookat target

   Node positions for reference when tuning:
     hero     [  0.0,  0.0,  0.0 ]
     about    [  0.0,  4.8,  1.5 ]
     work     [ 11.5,  0.5, -2.0 ]
     projects [ -7.0, -5.5,  2.0 ]
     blog     [ -8.5,  5.5, -3.0 ]
     contact  [ -9.0,  1.0,  5.0 ]

   Rule of thumb: camera x = node.x − ~5  (so node sits right-of-centre)
────────────────────────────────────────────────────────────── */
const CAM = [
  // 0 — hero: wide overview, centred, whole graph visible
  { p: [  0.0,  1.0,  22.0 ], l: [  0.0,  0.0,   0.0 ] },

  // 1 — about: pull left, node on right half of screen
  { p: [ -5.0,  6.0,  13.5 ], l: [  -6.5,  4.6,   1.5 ] },

  // 2 — work: far right node — camera comes in from the left
  { p: [  5.5,  2.5,  10.0 ], l: [ 13.5,  0.5,  -2.0 ] },

  // 3 — projects: lower-left node — camera above-left looking down-right
  { p: [-21.0, -7.5,  17.5 ], l: [ -17.5, -5.5,   2.0 ] },

  // 4 — blog: upper-left behind — camera below-left looking up-right
  { p: [9.0,  2.5,   7.5 ], l:    [  -3.5,   -5.5,  -3.0 ],  },

  // 5 — contact: far-left-forward node — camera left looking inward
  { p: [-15.5,  3.0,  15.0 ], l: [ -17.0,  1.0,   -2.0 ] },
];

/* ════════════════════════════════════════════════════════════
   THEME PALETTES
════════════════════════════════════════════════════════════ */
const THEMES = {
  dark: {
    nodeMain:    0xcc0000,    // Darker, truer red
    nodeSec:     0x990000,
    nodeChild:   0x880000,
    nodeDim:     0x331616,    // Darker desaturated red
    edge:        0xd42020 ,       // brighter than node colour so edges read clearly
    edgeDimOp:   0.12,           // raised from 0.07 — dimmed edges still faintly visible
    edgeOpacity: 0.34,           // raised from 0.26 — focused edges noticeably prominent
    particle:    0x440000,
    particleOp:  0.40,
    glowOpacity: 0.055,
    fog:         0x0e0e12,
    grid:        0x440000,
  },
  light: {
    nodeMain:    0xcc1111,
    nodeSec:     0xaa0000,
    nodeChild:   0xbb1010,
    nodeDim:     0x997070,
    edge:        0xcc1111,
    edgeDimOp:   0.09,
    edgeOpacity: 0.28,
    particle:    0xaa3333,
    particleOp:  0.22,
    glowOpacity: 0.07,
    fog:         0xf0eded,
    grid:        0xccaaaa,
  },
};
let T = THEMES.dark;

/* ════════════════════════════════════════════════════════════
   MATH HELPERS
════════════════════════════════════════════════════════════ */
function v3arr(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
function ss(t) { return t * t * (3 - 2 * t); }

function variedColor(baseHex) {
  const c = new THREE.Color(baseHex);
  c.offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.18);
  return c;   // return Color object directly
}

/* ════════════════════════════════════════════════════════════
   LAYOUT GENERATORS  (offsets relative to section node)
════════════════════════════════════════════════════════════ */

// Wide single arc — About
function layoutArc(n, radius, startA, spanA, yTilt) {
  return Array.from({ length: n }, (_, i) => {
    const a = startA + (spanA / Math.max(n - 1, 1)) * i;
    return {
      x: Math.cos(a) * radius,
      y: Math.sin(a) * radius * 0.38 + (yTilt || 0),
      z: -Math.sin(a) * radius * 0.30,
    };
  });
}

// Uniform circular ring — About
function layoutCircle(n, radius, yOff) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      x: Math.cos(a) * radius,
      y: yOff || 0,
      z: -Math.sin(a) * radius,
    };
  });
}

// Double-row arc — Projects (organic, scalable)
function layoutDoubleArc(n, r1, r2, startA, spanA) {
  const n1 = Math.ceil(n / 2), n2 = n - n1;
  const a1 = layoutArc(n1, r1, startA, spanA,  0.7);
  const a2 = layoutArc(n2, r2, startA + 0.18, spanA * 0.78, -0.9);
  return [...a1, ...a2];
}

// Vertical column — Work
function layoutColumn(n, spacing, xOff, zOff) {
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: (xOff || 1.8) + (i % 2 === 0 ? -0.15 : 0.15), // Much tighter stack
    y: (i - mid) * spacing,
    z: (zOff || 0) + (i % 3 - 1) * 0.15, // Reduced Z-jitter for cleaner stack
  }));
}

// Spiral — Blog (scales to any post count)
function layoutSpiral(n, r0, rStep, turnRate) {
  return Array.from({ length: n }, (_, i) => {
    const a = i * Math.PI * 2 * (turnRate || 0.36);
    const r = r0 + i * rStep;
    return {
      x: Math.cos(a) * r,
      y: i * 0.55 - (n * 0.55) / 2,
      z: Math.sin(a) * r * 0.5,
    };
  });
}

// Cross arms — Contact
function layoutCross(n) {
  const arms = [
    { x:  0,    y:  2.6, z:  0 },
    { x:  2.6,  y:  0,   z:  0 },
    { x:  0,    y: -2.6, z:  0 },
    { x: -2.6,  y:  0,   z:  0 },
    { x:  0,    y:  0,   z:  2.6 },
    { x:  0,    y:  0,   z: -2.6 },
  ];
  return arms.slice(0, n);
}

// Orbit scatter — initial unfocused state
function layoutOrbit(n, radius) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * 1.4;
    return {
      x: Math.cos(a) * r,
      y: (Math.random() - 0.5) * 2.2,
      z: Math.sin(a) * r * 0.55,
    };
  });
}

/* ════════════════════════════════════════════════════════════
   NODE BUILDERS
════════════════════════════════════════════════════════════ */

function makeSectionNode(posArr, col, r) {
  const g = new THREE.Group();
  g.position.set(posArr[0], posArr[1], posArr[2]);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 24),
    new THREE.MeshPhongMaterial({
      color: col,
      transparent: false,
      shininess: 5,
      specular: 0x333333,
      emissive: col,
      emissiveIntensity: 0.3,
    })
  );
  g.add(core);
  g.userData.core = core;

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.5, 8, 8),
    new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.08 })
  );
  g.add(shell);
  g.userData.shell = shell;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.7, 0.015, 6, 32),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25 })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.userData.ring = ring;

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(r * 3.2, 18),
    new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: T.glowOpacity,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  g.add(glow);
  g.userData.glow = glow;

  const baseColor = new THREE.Color(col);
  g.userData.phase       = Math.random() * Math.PI * 2;
  g.userData.isSection   = true;
  g.userData.currentCol  = baseColor.clone();
  g.userData.targetCol   = baseColor.clone();
  g.userData.baseCol     = baseColor.clone();
  g.userData.r           = r;
  return g;
}

// Reusable matrix for instanced mesh updates
const _mat4 = new THREE.Matrix4();
const _dummy = new THREE.Object3D();

/* ════════════════════════════════════════════════════════════
   LIVE-TRACKING EDGES (Optimized Grouped LineSegments)
════════════════════════════════════════════════════════════ */
function makeLineSegmentsMesh(count, col, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
  const mat = new THREE.LineBasicMaterial({
    color: col, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  graphGroup.add(mesh);
  return mesh;
}

/* ════════════════════════════════════════════════════════════
   GRAPH BUILD
════════════════════════════════════════════════════════════ */
function buildGraph() {
  // 1. Section nodes
  Object.keys(SEC_POS).forEach(key => {
    const isHero = key === 'hero';
    const node = makeSectionNode(SEC_POS[key], isHero ? T.nodeMain : T.nodeSec, isHero ? 1.6 : 1.0);
    graphGroup.add(node);
    sectionNodes[key] = node;
  });

  // 2. Collect all children definitions to know TOTAL count for InstancedMesh
  const aboutDefs = getAboutChildren();
  const childrenMap = {
    work:     getWorkChildren(),
    projects: getProjectChildren(),
    blog:     getBlogChildren(),
    contact:  getContactChildren(),
  };
  const totalInstanced = Object.values(childrenMap).reduce((sum, arr) => sum + arr.length, 0);

  // 3. Init InstancedMesh for non-About sections
  const childGeo = new THREE.SphereGeometry(1, 10, 10);
  const childMat = new THREE.MeshPhongMaterial({ 
    transparent: false, 
    shininess: 10, 
    specular: 0x222222,
    emissiveIntensity: 0.28 
  });
  instancedChildren = new THREE.InstancedMesh(childGeo, childMat, totalInstanced);
  graphGroup.add(instancedChildren);

  // 5. Build section children data
  instancedChildData = [];
  let globalIdx = 0;

  // First, build individual "About" nodes
  sectionNodes['about'].userData.childCount = aboutDefs.length;
  buildAboutNodes(aboutDefs);

  // Then build instanced nodes for everything else
  Object.entries(childrenMap).forEach(([key, defs]) => {
    sectionNodes[key].userData.childStartIdx = globalIdx;
    sectionNodes[key].userData.childCount = defs.length;
    buildSectionChildrenData(key, defs, globalIdx);
    globalIdx += defs.length;
  });

  // Calculate total edges for childEdgesMesh
  // Non-project sections have 1 edge per child.
  // Project section has: numTagNodes (hub->tag) + sum(projectTagsCount) (tag->project)
  let projEdgesCount = 0;
  childrenMap.projects.forEach(def => {
    if (def.type === 'tag') projEdgesCount += 1;
    else if (def.type === 'project') projEdgesCount += (def.tags.length || 1); // fallback to 1 edge if no tags
  });

  const nonProjEdges = [childrenMap.work, childrenMap.blog, childrenMap.contact].reduce((s, a) => s + a.length, 0);
  const totalEdges = aboutDefs.length + nonProjEdges;
  childEdgesMesh = makeLineSegmentsMesh(totalEdges, T.edge, T.edgeOpacity * 0.65);

  // Separate Project Edges
  let branchCount = 0, leafCount = 0;
  childrenMap.projects.forEach(def => {
    if (def.type === 'tag') branchCount++;
    else leafCount += (def.tags.length || 1);
  });
  projectBranchEdges = makeLineSegmentsMesh(branchCount, T.edge, T.edgeOpacity);        // full opacity for hub→tag
  projectLeafEdges   = makeLineSegmentsMesh(leafCount,  T.edge, T.edgeOpacity * 0.55);  // slightly dimmer for tag→project

  // 6. Hub → section live edges (grouped)
  const hubCount = SCROLL_SECTIONS.length - 1;
  hubEdgesMesh = makeLineSegmentsMesh(hubCount, T.edge, T.edgeOpacity * 1.1); // hub spokes are the most prominent
  hubEdgesMesh.userData.keys = SCROLL_SECTIONS.filter(k => k !== 'hero');
}

/* ── Child-def factories ─────────────────────────────────── */
function getAboutChildren() {
  const skills = (typeof SKILLS !== 'undefined' && SKILLS.length)
    ? SKILLS
    : ['Unity','C#','WebXR','Three.js','JavaScript','Python','React','Flutter'];
  
  // Use layoutCircle for a uniform uniform 360-degree ring
  const ordered = layoutCircle(skills.length, 3.8, 0);
  return skills.map((name, i) => ({ 
    name,
    r: 0.22, 
    ordered: ordered[i] 
  }));
}

function buildAboutNodes(defs) {
  const sp = SEC_POS['about'];
  const secP = new THREE.Vector3(sp[0], sp[1], sp[2]);
  const scattered = layoutOrbit(defs.length, 4.2);

  aboutChildNodes = defs.map((def, i) => {
    const s = scattered[i];
    const wp = new THREE.Vector3(secP.x + s.x, secP.y + s.y, secP.z + s.z);
    const wo = def.ordered
      ? new THREE.Vector3(secP.x + def.ordered.x, secP.y + def.ordered.y, secP.z + def.ordered.z)
      : wp.clone();

    const col = variedColor(T.nodeChild);
    
    // Group for the node
    const group = new THREE.Group();
    group.position.copy(wp);
    graphGroup.add(group);

    // Sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(def.r, 12, 12),
      new THREE.MeshPhongMaterial({ 
        color: col, 
        shininess: 10,
        specular: 0x222222,
        emissive: col,
        emissiveIntensity: 0.28
      })
    );
    group.add(sphere);

    // Logo Sprite (Circular Badge)
    let sprite = null;
    const logoFile = findLogoFile(def.name);
    if (logoFile) {
      // Use encodeURIComponent to handle special characters like '#' in filenames
      const path = `/assets/images/logosIcons/techStack/${encodeURIComponent(logoFile)}`;
      const spriteMat = new THREE.SpriteMaterial({ 
        transparent: true, 
        opacity: 0,
        depthTest: true,
        depthWrite: false
      });
      sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(def.r * 1.5, def.r * 1.5, 1);
      group.add(sprite);

      if (logoTextures[path]) {
        spriteMat.map = logoTextures[path];
      } else {
        loadBadgeTexture(path, (tex) => {
          logoTextures[path] = tex;
          spriteMat.map = tex;
          spriteMat.needsUpdate = true;
        });
      }
    }

    return {
      group,
      sphere,
      sprite,
      phase: Math.random() * Math.PI * 2,
      basePos: wp,
      orderedPos: wo,
      currentPos: wp.clone(),
      r: def.r,
      currentScale: 1.0,
      currentCol: col.clone(),
      targetCol: col.clone(),
      baseCol: col.clone(),
      secKey: 'about'
    };
  });
}

function getWorkChildren() {
  const n = (typeof EXPERIENCE !== 'undefined') ? EXPERIENCE.length : 4;
  const ordered = layoutColumn(n, 1.5, 0, 0);
  return Array.from({ length: n }, (_, i) => ({ r: 0.36, ordered: ordered[i] }));
}

function getProjectChildren() {
  const projects = (typeof PROJECTS !== 'undefined') ? PROJECTS : Array.from({ length: 6 }, (_, i) => ({ title: `Project ${i+1}`, cat: PROJECT_TAGS[i % PROJECT_TAGS.length] }));
  
  // 1. Identify active tags
  const activeTags = PROJECT_TAGS.filter(tag => 
    projects.some(p => (p.cat || "").toLowerCase().includes(tag.toLowerCase()))
  );

  // 2. Layout for tags (Inner Branches)
  // Positioned in a wide arc around the project hub
  const tagRadius = 3.8;
  const tagOrdered = layoutArc(activeTags.length, tagRadius, -Math.PI * 0.65, Math.PI * 1.3, 0.5);
  
  const tagDefs = activeTags.map((name, i) => ({
    name,
    type: 'tag',
    r: 0.60, 
    ordered: tagOrdered[i]
  }));

  // 3. Layout for projects (Leaves)
  // Group projects by their primary tag to create distinct clusters
  const projectDefs = [];
  const projectsByTag = {};
  activeTags.forEach(t => projectsByTag[t] = []);
  
  projects.forEach(p => {
    const myTags = activeTags.filter(t => (p.cat || "").toLowerCase().includes(t.toLowerCase()));
    if (myTags.length > 0) {
      // Use the first tag as primary group
      projectsByTag[myTags[0]].push({ p, myTags });
    } else {
      // Fallback for untagged
      if (!projectsByTag['misc']) projectsByTag['misc'] = [];
      projectsByTag['misc'].push({ p, myTags: [] });
    }
  });

  activeTags.forEach((tagName, tagIdx) => {
    const tDef = tagDefs[tagIdx];
    const group = projectsByTag[tagName];
    if (!group || group.length === 0) return;

    const fanSpan = Math.PI * 0.45; // ~80 degree fan
    const leafDist = 3.2;         // distance from tag node
    const tagAngle = Math.atan2(tDef.ordered.y, tDef.ordered.x);

    group.forEach((item, i) => {
      const subFrac = group.length > 1 ? (i / (group.length - 1) - 0.5) : 0;
      const angle = tagAngle + subFrac * fanSpan;
      
      const px = tDef.ordered.x + Math.cos(angle) * leafDist;
      const py = tDef.ordered.y + Math.sin(angle) * leafDist;
      const pz = tDef.ordered.z + (Math.random() - 0.5) * 1.5;

      projectDefs.push({
        name: item.p.title,
        type: 'project',
        r: 0.26,
        ordered: { x: px, y: py, z: pz },
        tags: item.myTags
      });
    });
  });

  return [...tagDefs, ...projectDefs];
}

function getBlogChildren() {
  const posts = (typeof BLOG_POSTS !== 'undefined') ? BLOG_POSTS : [];
  const n = posts.length || 5;
  const ordered = layoutSpiral(n, 1.4, 0.68, 0.37);
  return Array.from({ length: n }, (_, i) => ({ 
    r: 0.30, 
    ordered: ordered[i],
    name: posts[i] ? (posts[i].cat || posts[i].title) : '',
    type: 'standard' // Removed 'tag' type to disable logo/label rendering as requested
  }));
}

function getContactChildren() {
  const n = (typeof CONTACTS !== 'undefined' && CONTACTS.length) ? CONTACTS.length : 4;
  const ordered = layoutCross(n);
  return Array.from({ length: n }, (_, i) => ({ r: 0.26, ordered: ordered[i] }));
}

/* ── Scatter children around section node ─────────────────── */
function buildSectionChildrenData(secKey, defs, startIdx) {
  const sp = SEC_POS[secKey];
  const secP = new THREE.Vector3(sp[0], sp[1], sp[2]);
  const n  = defs.length;

  defs.forEach((def, i) => {
    // Hierarchical Scattering for Projects: Tags stay close, projects scatter far out
    const sRad = (secKey === 'projects') ? (def.type === 'tag' ? 2.8 : 7.4) : 4.0;
    const angle = (i / n) * Math.PI * 2;
    const r = sRad + (Math.random() - 0.5) * 1.5;
    
    const wp = new THREE.Vector3(
      secP.x + Math.cos(angle) * r,
      secP.y + (Math.random() - 0.5) * 2.2,
      secP.z + Math.sin(angle) * r * 0.55
    );

    const wo = def.ordered
      ? new THREE.Vector3(secP.x + def.ordered.x, secP.y + def.ordered.y, secP.z + def.ordered.z)
      : wp.clone();

    const col = variedColor(T.nodeChild);
    
    const childData = {
      idx: startIdx + i,
      phase: Math.random() * Math.PI * 2,
      basePos: wp,
      orderedPos: wo,
      currentPos: wp.clone(),
      r: def.r,
      currentScale: 1.0,
      currentCol: col.clone(),
      targetCol: col.clone(),
      baseCol: col.clone(),
      secKey: secKey,
      type: def.type || 'standard',
      name: def.name || '',
      tags: def.tags || []
    };

    // If it's a tag node, we add a logo or text label sprite
    if (def.type === 'tag') {
      const tagLabel = def.name || '';
      const spriteMat = new THREE.SpriteMaterial({ 
        transparent: true, 
        opacity: 0, 
        depthWrite: false,
        depthTest: true // Respect depth so sprites are occluded by other nodes
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.renderOrder = 999;
      sprite.scale.set(def.r * 1.0, def.r * 1.0, 1);
      childData.sprite = sprite;
      graphGroup.add(sprite);

      // 1. Try to find a logo in the main logosIcons folder
      const normalized = normalizeName(tagLabel);
      const logoFilename = normalized + '.png';
      const logoPath = `/assets/images/logosIcons/${logoFilename}`;
      
      // Expanded list of known logos in /assets/images/logosIcons/ (verified in filesystem)
      const knownLogos = [
        'xr', 'webdev', 'research', 'datavis', 'sass', 'accenture', 'anu', 'data61',
        'safeCoVR', 'crisper', 'imlex', 'tut', 'ujm', 'github', 'linkedin', 'instagram', 'email'
      ];

      let found = false;
      if (knownLogos.includes(normalized)) {
        found = true;
      } else {
        // Search by prefix or inclusion (e.g. "UX Design" -> "ux")
        const partialMatch = knownLogos.find(k => normalized.includes(k) || k.includes(normalized));
        if (partialMatch) {
          found = true;
          // logoPath = `/assets/images/logosIcons/${partialMatch}.png`; // Update path if found
        }
      }

      if (found) {
        const finalPath = found && knownLogos.includes(normalized) ? logoPath : `/assets/images/logosIcons/${knownLogos.find(k => normalized.includes(k) || k.includes(normalized))}.png`;
        
        if (logoTextures[finalPath]) {
          spriteMat.map = logoTextures[finalPath];
          spriteMat.needsUpdate = true;
        } else {
          loadBadgeTexture(finalPath, (tex) => {
            logoTextures[finalPath] = tex;
            spriteMat.map = tex;
            spriteMat.needsUpdate = true;
          }, false); // Pass false to remove the circular badge for tags
        }
      } else {
        // Fallback to text
        loadTextTexture(tagLabel, (tex) => {
          spriteMat.map = tex;
          spriteMat.needsUpdate = true;
        });
      }
    }

    instancedChildData.push(childData);
  });

  // Optimization: Pre-link project nodes to their tag node data objects
  if (secKey === 'projects') {
    instancedChildData.forEach(data => {
      if (data.secKey === 'projects' && data.type === 'project') {
        data.tagNodes = (data.tags || []).map(tagName => 
          instancedChildData.find(d => d.secKey === 'projects' && d.type === 'tag' && d.name === tagName)
        ).filter(Boolean);
      }
    });
  }
}

/* ════════════════════════════════════════════════════════════
   PARTICLES
════════════════════════════════════════════════════════════ */
function buildParticles() {
  const PC = window.innerWidth < 768 ? 450 : 950;
  const pp = new Float32Array(PC * 3);
  for (let i = 0; i < PC; i++) {
    pp[i * 3]     = (Math.random() - 0.5) * 55;
    pp[i * 3 + 1] = (Math.random() - 0.5) * 45;
    pp[i * 3 + 2] = (Math.random() - 0.5) * 35;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const mat = new THREE.PointsMaterial({
    color: T.particle, size: 0.045, transparent: true,
    opacity: T.particleOp, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.isParticles = true;
  graphGroup.add(pts);
}

/* ════════════════════════════════════════════════════════════
   HORIZON GRID
════════════════════════════════════════════════════════════ */
let horizonGrid;

function buildHorizonGrid() {
  const size = 500;
  const divisions = 45;
  horizonGrid = new THREE.GridHelper(size, divisions, T.grid, T.grid);
  horizonGrid.position.y = -13.5;
  horizonGrid.material.transparent = true;
  horizonGrid.material.opacity = 0.35;
  horizonGrid.material.blending = THREE.AdditiveBlending;
  scene.add(horizonGrid);
}

/* ════════════════════════════════════════════════════════════
   DYNAMIC SCROLL → SECTION FOCUS
   Reads DOM offsetTop so it adapts to content length changes.
════════════════════════════════════════════════════════════ */
let sectionBounds = null;   // [{ name, top, bottom }]

function buildSectionBounds() {
  const bounds = [];
  SCROLL_SECTIONS.forEach(key => {
    const el = document.getElementById(key)
            || document.querySelector(`[data-section="${key}"]`);
    if (el) {
      const top = el.offsetTop;
      bounds.push({ name: key, top, bottom: top + el.offsetHeight });
    }
  });
  bounds.sort((a, b) => a.top - b.top);
  sectionBounds = bounds.length ? bounds : null;
}

function computeFocusSection() {
  if (lastScrollY === window.scrollY && cachedFocusName) return cachedFocusName;
  lastScrollY = window.scrollY;

  const mid = window.scrollY + window.innerHeight * 0.42;

  if (sectionBounds) {
    for (let i = 0; i < sectionBounds.length; i++) {
      if (mid >= sectionBounds[i].top && mid < sectionBounds[i].bottom) {
        cachedFocusName = sectionBounds[i].name;
        return cachedFocusName;
      }
    }
    cachedFocusName = mid < (sectionBounds[0]?.top || 0)
      ? sectionBounds[0].name
      : sectionBounds[sectionBounds.length - 1].name;
    return cachedFocusName;
  }

  const idx = Math.round(scrollFrac * (SCROLL_SECTIONS.length - 1));
  cachedFocusName = SCROLL_SECTIONS[Math.max(0, Math.min(idx, SCROLL_SECTIONS.length - 1))];
  return cachedFocusName;
}

/* ════════════════════════════════════════════════════════════
   FOCUS ANIMATIONS  (per-section child behaviour)
════════════════════════════════════════════════════════════ */
const FOCUS_ANIMATIONS = {
  about: {
    childScale: 1.45,
    perChildFn: (child, i, n, t, _localFrac) => {
      // Seamless rhythmic vertical bobbing (wraps perfectly around circle)
      // Multiply by 2.0 to see more wave peaks around the ring
      const phase = (i / (n || 1)) * Math.PI * 4.0;
      child.position.y += Math.sin(t * 1.0 + phase) * 0.04;
    }
  },
  work: {
    childScale: 1.50,
    perChildFn: (child, i, n, t, localFrac) => {
      // Scroll-reactive "piano key" impulse on X and Z
      // Maps localFrac [0, 1] to target index [n-1, 0] (top to bottom)
      const targetIdx = (1.0 - localFrac) * (n - 1);
      const dist = Math.abs(i - targetIdx);
      
      // Sharp impulse peak
      const impulse = Math.exp(-dist * dist * 3.5); // Tight Gaussian
      
      // Pop out diagonally (forward and right)
      child.position.x += impulse * 0.08;
      child.position.z += impulse * 0.12;

      // Extremely subtle breathing to keep it alive when not scrolling
      const breathe = Math.sin(t * 0.8 + i * 0.8) * 0.008;
      child.position.x += breathe;
      child.position.z += breathe * 0.3;
    }
  },
  projects: {
    childScale: 1.42,
    perChildFn: (child, i, _n, t, _localFrac) => {
      // Front-back ripple across the double arc rows
      child.position.z += Math.sin(t * 0.88 + i * 0.42) * 0.07;
    }
  },
  blog: {
    childScale: 1.38,
    perChildFn: (child, i, n, t, _localFrac) => {
      // Rhythmic vertical floating
      const phase = (i / (n || 1)) * Math.PI * 2.0;
      child.position.y += Math.sin(t * 1.5 + phase) * 0.12;
      
      // Subtle spiral wobble
      child.position.x += Math.cos(t * 0.8 + phase) * 0.035;
      child.position.z += Math.sin(t * 0.8 + phase) * 0.035;
    }
  },
  contact: {
    childScale: 1.35,
    perChildFn: (child, i, _n, t, _localFrac) => {
      // Arms breathe outward
      if (child.userData.orderedPos) {
        const dx = child.userData.orderedPos.x - child.position.x;
        const dy = child.userData.orderedPos.y - child.position.y;
        const dz = child.userData.orderedPos.z - child.position.z;
        const inv = 1 / (Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.001);
        const pulse = Math.sin(t * 0.95 + i * (Math.PI / 3)) * 0.07;
        child.position.x += dx * inv * pulse;
        child.position.y += dy * inv * pulse;
        child.position.z += dz * inv * pulse;
      }
    }
  },
};

/* ════════════════════════════════════════════════════════════
   COLOUR LERP — smooth dim / bright transitions
════════════════════════════════════════════════════════════ */
const COL_LERP_SPEED = 0.042;

function applyColourLerp(userData, targetHex) {
  userData.targetCol.set(targetHex);
  userData.currentCol.lerp(userData.targetCol, COL_LERP_SPEED);
}

/* ════════════════════════════════════════════════════════════
   ANIMATION LOOP
════════════════════════════════════════════════════════════ */
function animate() {
  frameId = requestAnimationFrame(animate);
  const t = performance.now() * 0.001;

  mouse.x += (targetMouse.x - mouse.x) * 0.055;
  mouse.y += (targetMouse.y - mouse.y) * 0.055;

  graphGroup.rotation.y = mouse.x * 0.06;
  graphGroup.rotation.x = -mouse.y * 0.035;

  const focusName = computeFocusSection();
  // In hero mode every node stays full-bright so the whole graph is readable
  const heroMode = (focusName === 'hero');

  /* ── Section nodes (Hubs) ─────────────────────────────────── */
  Object.entries(sectionNodes).forEach(([key, node]) => {
    const ph      = node.userData.phase;
    const inFocus = focusName === key;

    const targetHex = (heroMode || inFocus)
      ? (key === 'hero' ? T.nodeMain : T.nodeSec)
      : T.nodeDim;
    applyColourLerp(node.userData, targetHex);
    const col = node.userData.currentCol;
    node.userData.core.material.color.copy(col);
    if (node.userData.core.material.emissive) node.userData.core.material.emissive.copy(col);
    node.userData.shell.material.color.copy(col);
    node.userData.ring.material.color.copy(col);
    node.userData.glow.material.color.copy(col);

    const pAmp  = inFocus ? 0.09 : 0.05;
    const pBase = inFocus ? 1.07 : 0.93;
    const pulse = pBase + Math.sin(t * 0.85 + ph) * pAmp;
    _scaleV.set(pulse, pulse, pulse);
    node.scale.lerp(_scaleV, 0.07);

    node.userData.ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.58 + ph) * 0.48;
    node.userData.ring.rotation.y = Math.cos(t * 0.38 + ph) * 0.48;
    node.userData.shell.rotation.y = t * 0.28 + ph;

    const maxG = inFocus ? T.glowOpacity * 2.8 : T.glowOpacity * 0.45;
    node.userData.glow.material.opacity += (maxG + Math.sin(t * 1.05 + ph) * T.glowOpacity * 0.3 - node.userData.glow.material.opacity) * 0.05;
    node.userData.glow.lookAt(camera.position);
  });

  /* ── Children (InstancedMesh) + Child Edges (LineSegments) ── */
  if (instancedChildren && childEdgesMesh) {
    const linePool = childEdgesMesh.geometry.attributes.position.array;
    const branchPool = projectBranchEdges.geometry.attributes.position.array;
    const leafPool = projectLeafEdges.geometry.attributes.position.array;

    let edgeSegIdx = aboutChildNodes.length; 
    let branchIdx = 0, leafIdx = 0;

    // Calculate current localFrac for the focused section
    let currentLocalFrac = 0.5;
    if (sectionBounds) {
      const bounds = sectionBounds.find(b => b.name === focusName);
      if (bounds) {
        const mid = window.scrollY + window.innerHeight * 0.42;
        currentLocalFrac = (mid - bounds.top) / (bounds.bottom - bounds.top);
        currentLocalFrac = Math.max(0, Math.min(1, currentLocalFrac));
      }
    }
    
    instancedChildData.forEach((data, i) => {
      const isFocused = focusName === data.secKey;
      const anim = FOCUS_ANIMATIONS[data.secKey];

      // Position lerp
      _vb.copy(isFocused ? data.orderedPos : data.basePos);

      // (Original orbital rotation logic kept for about nodes if they were instanced - although they aren't currently)
      if (isFocused && data.secKey === 'about') {
        const hub = sectionNodes['about'].position;
        const rotSpeed = 0.22;
        const angle = t * rotSpeed;
        const dx = _vb.x - hub.x;
        const dz = _vb.z - hub.z;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        _vb.x = hub.x + (dx * cos - dz * sin);
        _vb.z = hub.z + (dx * sin + dz * cos);
      }

      data.currentPos.lerp(_vb, isFocused ? 0.040 : 0.015);

      if (isFocused && anim && anim.perChildFn) {
        const localIdx = i - sectionNodes[data.secKey].userData.childStartIdx;
        const total = sectionNodes[data.secKey].userData.childCount;
        _dummy.position.copy(data.currentPos);
        anim.perChildFn(_dummy, localIdx, total, t, currentLocalFrac);
        data.currentPos.copy(_dummy.position);
      }

      data.currentPos.x += Math.sin(t * 0.40 + data.phase * 1.1) * 0.0022;
      data.currentPos.y += Math.sin(t * 0.51 + data.phase * 0.9) * 0.0038;
      data.currentPos.z += Math.cos(t * 0.35 + data.phase * 1.3) * 0.0028;

      const tgtS = isFocused ? (anim ? anim.childScale : 1.3) : 1.0;
      data.currentScale += (tgtS - data.currentScale) * 0.045;
      const scale = data.currentScale * data.r;

      _dummy.position.copy(data.currentPos);
      _dummy.scale.set(scale, scale, scale);
      
      // Hierarchical Pulse Animation (Projects only)
      if (data.secKey === 'projects' && isFocused) {
        const pulseSpeed = 4.5;
        const pulseOffset = (data.type === 'tag') ? 0.35 : 0.85;
        const pulse = 1.0 + Math.sin(t * pulseSpeed - pulseOffset) * 0.08;
        _dummy.scale.multiplyScalar(pulse);
      }

      _dummy.updateMatrix();
      instancedChildren.setMatrixAt(i, _dummy.matrix);

      applyColourLerp(data, (heroMode || isFocused) ? data.baseCol.getHex() : T.nodeDim);
      instancedChildren.setColorAt(i, data.currentCol);

      // Tag Sprite Logic (White text only)
      if (data.sprite) {
        // Offset the sprite towards the camera even further to prevent clipping
        _va.copy(camera.position).sub(data.currentPos).normalize().multiplyScalar(data.r + 0.45);
        data.sprite.position.copy(data.currentPos).add(_va);

        const tgtA = isFocused ? 1.0 : 0;
        data.sprite.material.opacity += (tgtA - data.sprite.material.opacity) * 0.1;
        data.sprite.scale.set(scale * 1.0, scale * 1.0, 1);
      }

      /* ── Hierarchical Edge Rendering ── */
      const hubPos = sectionNodes[data.secKey].position;
      
      if (data.secKey === 'projects') {
        if (data.type === 'tag') {
          // Hub -> Tag (Primary Branches)
          const sIdx = branchIdx * 6;
          branchPool[sIdx]   = hubPos.x; branchPool[sIdx+1] = hubPos.y; branchPool[sIdx+2] = hubPos.z;
          branchPool[sIdx+3] = data.currentPos.x; branchPool[sIdx+4] = data.currentPos.y; branchPool[sIdx+5] = data.currentPos.z;
          branchIdx++;
        } else {
          // Tag -> Project (Leaves)
          const myTagNodes = data.tagNodes || [];
          if (myTagNodes.length === 0) {
             const sIdx = leafIdx * 6;
             leafPool[sIdx]   = hubPos.x; leafPool[sIdx+1] = hubPos.y; leafPool[sIdx+2] = hubPos.z;
             leafPool[sIdx+3] = data.currentPos.x; leafPool[sIdx+4] = data.currentPos.y; leafPool[sIdx+5] = data.currentPos.z;
             leafIdx++;
          } else {
            myTagNodes.forEach(tagNode => {
              const sIdx = leafIdx * 6;
              leafPool[sIdx]   = tagNode.currentPos.x; leafPool[sIdx+1] = tagNode.currentPos.y; leafPool[sIdx+2] = tagNode.currentPos.z;
              leafPool[sIdx+3] = data.currentPos.x; leafPool[sIdx+4] = data.currentPos.y; leafPool[sIdx+5] = data.currentPos.z;
              leafIdx++;
            });
          }
        }
      } else {
        // Standard Hub -> Child
        const sIdx = edgeSegIdx * 6;
        linePool[sIdx]   = hubPos.x; linePool[sIdx+1] = hubPos.y; linePool[sIdx+2] = hubPos.z;
        linePool[sIdx+3] = data.currentPos.x; linePool[sIdx+4] = data.currentPos.y; linePool[sIdx+5] = data.currentPos.z;
        edgeSegIdx++;
      }
    });

    /* ── About Nodes (Individual) ── */
    const isAboutFocused = focusName === 'about';
    const aboutAnim = FOCUS_ANIMATIONS['about'];
    const aboutHubPos = sectionNodes['about'].position;

    aboutChildNodes.forEach((data, i) => {
      // Position lerp
      _vb.copy(isAboutFocused ? data.orderedPos : data.basePos);

      // Orbital Rotation: Rotate the target position around the hub when focused
      if (isAboutFocused) {
        const rotSpeed = 0.22;
        const angle = t * rotSpeed;
        const dx = _vb.x - aboutHubPos.x;
        const dz = _vb.z - aboutHubPos.z;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        _vb.x = aboutHubPos.x + (dx * cos - dz * sin);
        _vb.z = aboutHubPos.z + (dx * sin + dz * cos);
      }

      data.currentPos.lerp(_vb, isAboutFocused ? 0.040 : 0.015);

      if (isAboutFocused && aboutAnim && aboutAnim.perChildFn) {
        _dummy.position.copy(data.currentPos);
        aboutAnim.perChildFn(_dummy, i, aboutChildNodes.length, t, currentLocalFrac);
        data.currentPos.copy(_dummy.position);
      }

      data.currentPos.x += Math.sin(t * 0.40 + data.phase * 1.1) * 0.0022;
      data.currentPos.y += Math.sin(t * 0.51 + data.phase * 0.9) * 0.0038;
      data.currentPos.z += Math.cos(t * 0.35 + data.phase * 1.3) * 0.0028;

      const tgtS = isAboutFocused ? aboutAnim.childScale : 1.0;
      data.currentScale += (tgtS - data.currentScale) * 0.045;
      const scale = data.currentScale;

      data.group.position.copy(data.currentPos);
      data.group.scale.set(scale, scale, scale);

      applyColourLerp(data, (heroMode || isAboutFocused) ? data.baseCol.getHex() : T.nodeDim);
      data.sphere.material.color.copy(data.currentCol);
      data.sphere.material.emissive.copy(data.currentCol);

      // Logo Fade
      if (data.sprite) {
        const isVisible = isAboutFocused;
        const tgtAlpha = isVisible ? 1.0 : 0.0;
        data.sprite.material.opacity += (tgtAlpha - data.sprite.material.opacity) * 0.1;
        
        // OPTIMIZATION: Hide the underlying sphere when the badge is fully opaque
        // This reduces draw calls and overdraw since the sphere is completely covered.
        data.sphere.visible = (data.sprite.material.opacity < 0.95);
      }

      const sIdx = i * 6;
      linePool[sIdx]   = aboutHubPos.x; linePool[sIdx+1] = aboutHubPos.y; linePool[sIdx+2] = aboutHubPos.z;
      linePool[sIdx+3] = data.currentPos.x; linePool[sIdx+4] = data.currentPos.y; linePool[sIdx+5] = data.currentPos.z;
    });

    instancedChildren.instanceMatrix.needsUpdate = true;
    if (instancedChildren.instanceColor) instancedChildren.instanceColor.needsUpdate = true;
    childEdgesMesh.geometry.attributes.position.needsUpdate = true;

    // Project Hierarchical Edges Updates
    projectBranchEdges.geometry.attributes.position.needsUpdate = true;
    projectLeafEdges.geometry.attributes.position.needsUpdate = true;

    const projsInFocus = focusName === 'projects';
    projectBranchEdges.material.opacity = projsInFocus ? (0.55 + Math.sin(t * 4.5) * 0.15) : T.edgeDimOp;
    projectLeafEdges.material.opacity   = projsInFocus ? (0.38 + Math.sin(t * 4.5 - 0.5) * 0.10) : T.edgeDimOp;
    projectBranchEdges.material.color.set(projsInFocus ? T.edge : T.nodeDim);
    projectLeafEdges.material.color.set(projsInFocus ? T.edge : T.nodeDim);
    
    // Standard child edge visibility — full opacity in hero mode and when focused
    const tgtOp = (heroMode || focusName !== 'hero') ? T.edgeOpacity * 0.52 : T.edgeDimOp;
    childEdgesMesh.material.opacity += (tgtOp - childEdgesMesh.material.opacity) * 0.04;
    childEdgesMesh.material.color.set((heroMode || focusName !== 'hero') ? T.edge : T.nodeDim);
  }

  /* ── Hub → section edges (grouped) ────────────────────────── */
  if (hubEdgesMesh) {
    const linePool = hubEdgesMesh.geometry.attributes.position.array;
    const heroPos = sectionNodes['hero'].position;
    const keys = hubEdgesMesh.userData.keys;
    keys.forEach((key, i) => {
      const toPos = sectionNodes[key].position;
      const sIdx = i * 6;
      linePool[sIdx]   = heroPos.x; linePool[sIdx+1] = heroPos.y; linePool[sIdx+2] = heroPos.z;
      linePool[sIdx+3] = toPos.x;   linePool[sIdx+4] = toPos.y;   linePool[sIdx+5] = toPos.z;
    });
    hubEdgesMesh.geometry.attributes.position.needsUpdate = true;
    const isHeroFocus = focusName === 'hero';
    const hubOp = (heroMode || isHeroFocus) ? T.edgeOpacity : T.edgeDimOp;
    hubEdgesMesh.material.opacity += (hubOp - hubEdgesMesh.material.opacity) * 0.04;
    hubEdgesMesh.material.color.set((heroMode || isHeroFocus) ? T.edge : T.nodeDim);
  }

  /* ── Camera scroll path ─────────────────────────────────── */
  const rawFrac = scrollFrac * (CAM.length - 1);
  const seg     = Math.min(Math.floor(rawFrac), CAM.length - 2);
  const lt      = ss(rawFrac - seg);
  const ca = CAM[seg], cb = CAM[seg + 1];

  _va.set(
    ca.p[0] + (cb.p[0] - ca.p[0]) * lt,
    ca.p[1] + (cb.p[1] - ca.p[1]) * lt,
    ca.p[2] + (cb.p[2] - ca.p[2]) * lt,
  );
  _vb.set(
    ca.l[0] + (cb.l[0] - ca.l[0]) * lt,
    ca.l[1] + (cb.l[1] - ca.l[1]) * lt,
    ca.l[2] + (cb.l[2] - ca.l[2]) * lt,
  );

  _va.x += mouse.x * 0.35;
  _va.y -= mouse.y * 0.18;

  camera.position.lerp(_va, 0.048);
  camera.lookAt(_vb);

  renderer.render(scene, camera);
}

/* ════════════════════════════════════════════════════════════
   THEME TOGGLE  — public API
   Wire up: <button onclick="setTheme(isDark ? 'light' : 'dark')">
════════════════════════════════════════════════════════════ */
function setTheme(mode) {
  isDark = mode !== 'light';
  T = isDark ? THEMES.dark : THEMES.light;

  if (scene.fog) scene.fog.color.set(T.fog);

  graphGroup.traverse(obj => {
    if (!obj.material) return;
    if (obj.isPoints) { obj.material.color.set(T.particle); obj.material.opacity = T.particleOp; }
  });

  Object.entries(sectionNodes).forEach(([key, node]) => {
    const col = new THREE.Color(key === 'hero' ? T.nodeMain : T.nodeSec);
    node.userData.baseCol.copy(col);
    node.userData.currentCol.copy(col);
    node.userData.targetCol.copy(col);
  });

  if (horizonGrid) {
    horizonGrid.material.color.set(T.grid);
  }

  instancedChildData.forEach(data => {
    const col = variedColor(T.nodeChild);
    data.baseCol.copy(col);
    data.currentCol.copy(col);
    data.targetCol.copy(col);
  });

  aboutChildNodes.forEach(data => {
    const col = variedColor(T.nodeChild);
    data.baseCol.copy(col);
    data.currentCol.copy(col);
    data.targetCol.copy(col);
  });

  if (childEdgesMesh) childEdgesMesh.material.color.set(T.edge);
  if (hubEdgesMesh) hubEdgesMesh.material.color.set(T.edge);
}

/* ════════════════════════════════════════════════════════════
   SCROLL + RESIZE
════════════════════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
  const dh = document.body.scrollHeight - window.innerHeight;
  scrollFrac = dh > 0 ? window.scrollY / dh : 0;
}, { passive: true });

window.addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  setTimeout(buildSectionBounds, 200);   // reflow may take a tick
}, { passive: true });

/* ════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════ */
function initScene() {
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) { console.error('hero.js: #graph-canvas not found'); return; }

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(T.fog, 16, 56);

  camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(CAM[0].p[0], CAM[0].p[1], CAM[0].p[2]);
  camera.lookAt(CAM[0].l[0], CAM[0].l[1], CAM[0].l[2]);
  scene.add(camera); // Added camera to scene so it can host children lights

  graphGroup = new THREE.Group();
  scene.add(graphGroup);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  // Headlamp: Attached to camera so it always illuminates what the user is looking at
  const camLight = new THREE.PointLight(0xffffff, 0.45);
  camLight.position.set(2, 2, 2); 
  camera.add(camLight);

  const mainLight = new THREE.PointLight(0xffffff, 0.82); // Slightly reduced intensity to account for camLight
  mainLight.position.set(5, 5, 15);
  scene.add(mainLight);

  const fillLight = new THREE.PointLight(0xaa0000, 0.45);
  fillLight.position.set(-8, -5, 5);
  scene.add(fillLight);

  buildGraph();
  buildParticles();
  buildHorizonGrid();

  document.addEventListener('mousemove', e => {
    targetMouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
    targetMouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // Let the page render first so offsetTop values are accurate
  setTimeout(buildSectionBounds, 400);

  animate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScene);
} else {
  initScene();
}

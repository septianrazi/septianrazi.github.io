/* =========================================================
   MODAL INTERACTION
========================================================= */
function openModal(p){
  const ov=document.getElementById('modal-overlay');
  const md=document.getElementById('modal-container');
  const media=document.getElementById('modal-media');

  if(p.video && p.video.length > 0){
    media.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${p.video}?autoplay=1&mute=1" frameborder="0" allowfullscreen allow="autoplay"></iframe>`;
  }else if(p.modalImgURL && p.modalImgURL.length > 0){
    media.innerHTML=`<img src="${p.modalImgURL}" alt="${p.title}">`;
  }else if(p.img && p.img.length > 0){
    media.innerHTML=`<img src="${p.img}" alt="${p.title}">`;
  }else{
    media.innerHTML=`<div class="modal-media-fb"><span>${p.title[0]}</span></div>`;
  }

  document.getElementById('modal-year').textContent=`${p.year} \u00b7 ${p.cat}`;
  document.getElementById('modal-title').textContent=p.title;
  document.getElementById('modal-sub').textContent=p.sub;
  document.getElementById('modal-desc').innerHTML=p.desc;
  const stackCont = document.getElementById('modal-stack');
  stackCont.innerHTML = '';
  if(p.stack) {
    p.stack.split(',').forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = s.trim();
      stackCont.appendChild(chip);
    });
  }

  const acts=document.getElementById('modal-actions');
  acts.innerHTML='';
  if(p.github && p.github.length > 0)acts.innerHTML+=`<a href="${p.github}" target="_blank" rel="noopener noreferrer" class="btn-outline"><i class="bi bi-github"></i> GitHub</a>`;
  if(p.link && p.link.length > 0)  acts.innerHTML+=`<a href="${p.link}"   target="_blank" rel="noopener noreferrer" class="btn-red"><i class="bi bi-box-arrow-up-right"></i> View Live</a>`;

  // Update hash for deep linking
  const prefix = PROJECTS.some(x => x.id === p.id) ? '/project/' : '/work/';
  if(window.location.hash !== '#' + prefix + p.id) {
    window.location.hash = prefix + p.id;
  }

  ov.classList.add('open');
  requestAnimationFrame(()=>md.classList.add('open'));
  document.body.style.overflow='hidden';
}

function closeModalBtn(){
  const ov=document.getElementById('modal-overlay');
  const md=document.getElementById('modal-container');
  md.classList.remove('open');
  setTimeout(()=>{
    ov.classList.remove('open');
    document.getElementById('modal-media').innerHTML='';
    document.body.style.overflow='';
    // Only clear hash if it matches a project/experience to avoid unwanted jumps
    const hash = window.location.hash.substring(1);
    if (hash && (PROJECTS.some(x => x.id === hash) || EXPERIENCE.some(x => x.id === hash))) {
      history.replaceState('', document.title, window.location.pathname + window.location.search);
    }
  },420);
}

function checkHash() {
  let hash = window.location.hash.substring(1);
  if (!hash) {
    const ov = document.getElementById('modal-overlay');
    if (ov && ov.classList.contains('open')) {
      closeModalBtn();
    }
    return;
  }

  // Handle semantic prefixes
  if (hash.startsWith('/project/')) hash = hash.replace('/project/', '');
  if (hash.startsWith('/work/')) hash = hash.replace('/work/', '');

  // Find project or experience
  const p = PROJECTS.find(x => x.id === hash) || EXPERIENCE.find(x => x.id === hash);
  if (p) {
    openModal(p);
  }
}

window.addEventListener('hashchange', checkHash);

function closeModalOv(e){if(e.target===document.getElementById('modal-overlay'))closeModalBtn();}

if (document.getElementById('modal')) {
  document.getElementById('modal').addEventListener('click',e=>e.stopPropagation());
}

/* =========================================================
   NAV
========================================================= */
function toggleMob(){
  const mn = document.getElementById('mob-nav');
  if(mn) mn.classList.toggle('open');
}
function closeMob(){
  const mn = document.getElementById('mob-nav');
  if(mn) mn.classList.remove('open');
}
window.addEventListener('scroll',()=>{
  const mainNav = document.getElementById('main-nav');
  if(mainNav) mainNav.classList.toggle('scrolled',window.scrollY>60);
},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMob();closeModalBtn();}});

/* =========================================================
   INTERACTIONS BINDING (For Liquid rendered nodes)
========================================================= */
function initInteractions() {
  // Project Filtering
  const filterBtns = document.querySelectorAll('.f-btn');
  filterBtns.forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.f-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const f = b.dataset.filter.toLowerCase();
      const cards = document.querySelectorAll('.proj-card');
      cards.forEach(card => {
        const cats = (card.dataset.cat || '').toLowerCase().split(' ');
        const isShown = card.dataset.show === 'true';

        if(f === 'all') {
          if(isShown) {
            card.style.display = 'block';
            gsap.to(card,{opacity:1, y:0, duration:0.3});
          } else {
            card.style.display = 'none';
          }
        } else {
          if(cats.includes(f)) {
            card.style.display = 'block';
            gsap.to(card,{opacity:1, y:0, duration:0.3});
          } else {
            card.style.display = 'none';
          }
        }
      });
    });
  });

  // Project Cards Modal & 3D Hover
  document.querySelectorAll('.proj-card').forEach(card => {
    card.addEventListener('click', () => {
      const p = PROJECTS.find(x => x.id === card.dataset.id);
      if(p) openModal(p);
    });
    if(window.innerWidth>768){
      card.addEventListener('mousemove',e=>{
        const r=card.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-.5;
        const y=(e.clientY-r.top)/r.height-.5;
        card.style.transform=`perspective(1200px) rotateY(${x*24}deg) rotateX(${-y*18}deg) translateY(-10px) scale(1.03)`;
      });
      card.addEventListener('mouseleave',()=>{ card.style.transform=''; });
    }
  });

  window.addEventListener('scroll',()=>{
    document.querySelectorAll('.proj-card').forEach(card=>{
      card.style.transform='';
    });
  },{passive:true});

  // Timeline (Experience/Work) Cards Modal & 3D Hover
  document.querySelectorAll('.tl-item').forEach(card => {
    card.addEventListener('click', () => {
      const e = EXPERIENCE.find(x => x.id === card.dataset.id);
      if(e) openModal(e);
    });
    if(window.innerWidth>768){
      card.addEventListener('mousemove',e=>{
        const r=card.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-.5;
        const y=(e.clientY-r.top)/r.height-.5;
        card.style.transform=`perspective(1200px) rotateY(${x*12}deg) rotateX(${-y*8}deg) translateY(-5px) scale(1.02)`;
      });
      card.addEventListener('mouseleave',()=>{ card.style.transform=''; });
    }
  });
  
  // About Stats 3D Hover
  const aboutStats = document.querySelectorAll('.about-stat');
  console.log(`Found ${aboutStats.length} about-stat elements`);
  aboutStats.forEach(stat => {
    if(window.innerWidth > 768){
      stat.addEventListener('mousemove', e => {
        const r = stat.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        // console.log(`Tilting stat: ${x}, ${y}`);
        stat.style.transform = `perspective(1200px) rotateY(${x * 24}deg) rotateX(${-y * 18}deg) translateY(-10px) scale(1.03)`;
      });
      stat.addEventListener('mouseleave', () => { stat.style.transform = ''; });
    }
  });

  // Marquee pause
  const track = document.getElementById('marquee');
  if(track) {
    track.addEventListener('mouseenter', () => track.style.animationPlayState = 'paused');
    track.addEventListener('mouseleave', () => track.style.animationPlayState = 'running');
  }
}

/**
 * Attaches the logo click listener for smooth reset.
 * Separated to ensure it's called reliably.
 */
/**
 * Attaches the logo click listener for smooth reset.
 * Uses event delegation on document so it works regardless of when the logo is added.
 */
function initLogoReset() {
  document.addEventListener('click', e => {
    const logo = e.target.closest('.nav-logo');
    if (!logo) return;

    // Root check for various environments
    const path = window.location.pathname;
    const isRoot = path === '/' || 
                   path.endsWith('/index.html') || 
                   path.includes('/septianrazi.github.io/');
    
    if (isRoot) {
      e.preventDefault();
      if (typeof window.resetCamera === 'function') {
        window.resetCamera();
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // Also close mobile nav if open
      const mn = document.getElementById('mob-nav');
      if (mn) mn.classList.remove('open');
    }
  });
}

// Call immediately to be ready for interaction
initLogoReset();

/* =========================================================
   LOADER
========================================================= */
function runLoader(){
  const loader=document.getElementById('loader');
  const pct=document.getElementById('lpct');
  if(!loader || !pct) return heroIn(0);

  const stages=['Initialising','Building graph','Placing nodes','Loading assets','Ready'];
  let p=0,si=0;
  const iv=setInterval(()=>{
    p+=Math.random()*30;
    if(p>=100){
      p=100;pct.textContent='Ready';clearInterval(iv);
      setTimeout(()=>{loader.classList.add('hidden');heroIn();},500);
    }else{
      const ni=Math.floor((p/100)*stages.length);
      if(ni!==si){si=ni;pct.textContent=stages[Math.min(si,stages.length-1)];}
    }
  },220);
}

/* =========================================================
   INIT
========================================================= */
window.addEventListener('DOMContentLoaded', () => {
  const yr = document.getElementById('yr');
  if(yr) yr.textContent=new Date().getFullYear();
  initInteractions();
  // Check hash for deep link
  setTimeout(checkHash, 600); 
});

window.addEventListener('load',()=>{
  const noMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(!noMotion){
    if(typeof initScene === 'function') initScene();
    runLoader();
    if(typeof initGSAP === 'function') initGSAP();
  }else{
    const loader = document.getElementById('loader');
    if(loader) loader.classList.add('hidden');
    document.querySelectorAll('.reveal,.tl-item,.blog-card,.hero-eyebrow,.hero-name,.hero-tagline,.hero-desc,.hero-actions,.hero-hint')
      .forEach(el=>{el.style.opacity='1';el.style.transform='none';});
  }
});

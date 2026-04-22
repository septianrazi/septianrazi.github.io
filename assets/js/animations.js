function initGSAP(){
  gsap.registerPlugin(ScrollTrigger);
  document.querySelectorAll('.reveal').forEach((el,i)=>{
    gsap.to(el,{opacity:1,y:0,duration:0.7,ease:'power2.out',delay:(i%4)*.08,scrollTrigger:{trigger:el,start:'top 88%',once:true}});
  });
  document.querySelectorAll('.reveal-fast').forEach((el,i)=>{
    gsap.to(el,{opacity:1,y:0,duration:0.4,ease:'power2.out',delay:i*.04,scrollTrigger:{trigger:el,start:'top 92%',once:true}});
  });
  document.querySelectorAll('.tl-entry').forEach((el,i)=>{
    gsap.to(el,{opacity:1,x:0,duration:0.6,ease:'power2.out',delay:i*.1,scrollTrigger:{trigger:el,start:'top 85%',once:true}});
  });
  document.querySelectorAll('.blog-card').forEach((el,i)=>{
    gsap.to(el,{opacity:1,y:0,duration:0.6,ease:'power2.out',delay:i*.1,scrollTrigger:{trigger:el,start:'top 88%',once:true}});
  });
  document.querySelectorAll('.proj-card').forEach((el,i)=>{
    gsap.to(el,{opacity:1,y:0,duration:0.6,ease:'power2.out',delay:i*.05,scrollTrigger:{trigger:el,start:'top 88%',once:true}});
  });
  document.querySelectorAll('[data-count]').forEach(el=>{
    const target=+el.dataset.count;
    ScrollTrigger.create({trigger:el,start:'top 85%',once:true,onEnter:()=>{
      gsap.to({v:0},{v:target,duration:1.6,ease:'power2.out',onUpdate:function(){
        const val = Math.round(this.targets()[0].v);
        el.textContent = el.dataset.plus === 'true' ? val + '+' : val;
      }});
    }});
  });
}

function heroIn(d = 1.5){
  const tl=gsap.timeline({delay:d});
  tl.to('.hero-eyebrow',{opacity:1,y:0,duration:0.6,ease:'power2.out'})
    .to('.hero-name',   {opacity:1,y:0,duration:0.8,ease:'power2.out'},'-=0.3')
    .to('.hero-tagline',{opacity:1,y:0,duration:0.6,ease:'power2.out'},'-=0.4')
    .to('.hero-desc',   {opacity:1,y:0,duration:0.6,ease:'power2.out'},'-=0.3')
    .to('.hero-actions',{opacity:1,y:0,duration:0.6,ease:'power2.out'},'-=0.3')
    .to('.hero-sidebar-bento',{opacity:1,y:0,duration:0.8,ease:'power2.out'},'-=0.5')
    .call(() => startBentoCycle())
    .to('.hero-hint',   {opacity:1,       duration:0.6},'-=0.2');
}

function startBentoCycle() {
  const cards = document.querySelectorAll('.bento-vid-card');
  const duration = 6; // 9 seconds cycle
  let currentIndex = 0;
  let isPaused = false;
  let cycleTimer;

  if (!cards.length) return;

  // Initial play for first card
  const initialPromise = cards[0].querySelector('video').play();
  if (initialPromise !== undefined) {
    initialPromise.catch(e => console.warn('Video play interrupted:', e));
  }

  const container = document.querySelector('.hero-sidebar-bento');

  // Pause when offscreen
  let isVisible = true;
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    });
    observer.observe(container);
  }

  const transition = () => {
    if (isPaused || !isVisible) return;

    const prevIndex = currentIndex;
    currentIndex = (currentIndex + 1) % cards.length;

    const prevCard = cards[prevIndex];
    const nextCard = cards[currentIndex];

    // EXIT Animation: Zoom Past Viewer + Slide Bottom-Right
    gsap.to(prevCard, {
      z: 5000,
      x: 3000,
      y: 400,
      opacity: 0,
      rotateY: -20,
      rotateX: -20,
      duration: 1.2,
      ease: 'power2.in',
      onComplete: () => {
        prevCard.classList.remove('active');
        prevCard.querySelector('video').pause();
        // Reset position to deep background entry point
        gsap.set(prevCard, { z: -1500, x: 200, y: -150, rotateY: -40, rotateX: 15 });
      }
    });

    // ENTRY Animation: Zoom from Deep Background
    nextCard.classList.add('active');
    const playPromise = nextCard.querySelector('video').play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.warn('Video play interrupted:', e));
    }
    
    gsap.fromTo(nextCard, 
      { z: -1500, x: 200, y: -150, opacity: 0, rotateY: -40, rotateX: 15 },
      { z: 0, x: 0, y: 0, opacity: 1, rotateY: 0, rotateX: 0, duration: 1.5, ease: 'power2.out' }
    );
  };

  // Cycle Loop
  cycleTimer = setInterval(() => {
    transition();
  }, duration * 1000);

  // Hover Pause
  container.addEventListener('mouseenter', () => { isPaused = true; });
  container.addEventListener('mouseleave', () => { isPaused = false; });

  // Click Deep-Linking & Hover Zoom
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const projectId = card.getAttribute('data-project');
      if (projectId) {
        window.location.hash = `/project/${projectId}`;
      }
    });

    card.addEventListener('mouseenter', () => {
      if (card.classList.contains('active')) {
        gsap.to(card, { 
          scale: 1.5, 
          transformOrigin: "right center",
          zIndex: 20, 
          duration: 0.4, 
          ease: 'power2.out' 
        });
      }
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, { 
        scale: 1, 
        zIndex: 5, 
        duration: 0.4, 
        ease: 'power2.out' 
      });
    });
  });
}


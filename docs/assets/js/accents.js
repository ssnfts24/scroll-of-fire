/* Accents: stars background + subtle phase tint */
(function(){
  "use strict";
  const c = document.getElementById("skyBg");
  if(!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = ()=> (c.width  = Math.floor(innerWidth*dpr), c.height = Math.floor(innerHeight*dpr), c.style.width='100vw', c.style.height='100vh');
  const R = c.getContext("2d");
  let stars=[];
  function seed(){
    stars.length=0;
    const n = Math.ceil((innerWidth*innerHeight)/9000);
    for(let i=0;i<n;i++){
      stars.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.6+.2, tw:Math.random()*2*Math.PI});
    }
  }
  function draw(t){
    R.clearRect(0,0,c.width,c.height);
    R.globalCompositeOperation="lighter";
    for(const s of stars){
      const a = .4 + .6*Math.sin(t/1200 + s.tw);
      R.beginPath(); R.arc(s.x,s.y,s.r,0,Math.PI*2);
      R.fillStyle=`rgba(122,243,255,${0.05*a})`;
      R.fill();
    }
    requestAnimationFrame(draw);
  }
  addEventListener("resize",()=>{W(); seed();});
  W(); seed(); requestAnimationFrame(draw);
})();
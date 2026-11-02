(function(){var d=document.documentElement,R=matchMedia('(prefers-reduced-motion: reduce)').matches;
function intro(){var el=document.getElementById('intro');if(!d.classList.contains('intro')){el.remove();return start()}
try{sessionStorage.setItem('intro-seen','1')}catch(e){}
var cv=el.querySelector('canvas'),x=cv.getContext('2d'),hud=el.querySelector('.hud span'),W,H,S=[],t0=performance.now(),done=0;
W=cv.width=innerWidth;H=cv.height=innerHeight;
for(var i=0;i<300;i++)S.push([Math.random()*6.283,Math.random(),Math.random()]);
function end(){if(done)return;done=1;d.classList.add('intro-out');setTimeout(function(){d.classList.remove('intro','intro-out');el.remove();start()},500)}
function bolt(side){var x0=W/2+side*W*.3,p=[[x0,0]];for(var i=1;i<=10;i++)p.push([x0+(Math.random()-.5)*W*.16,H*i/10]);[[11,'rgba(139,233,237,.32)'],[2.5,'#fff']].forEach(function(s){x.lineWidth=s[0];x.strokeStyle=s[1];x.beginPath();p.forEach(function(q,i){i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])});x.stroke()})}
function f(now){if(done)return;var t=(now-t0)/1e3,cx=W/2,cy=H/2,dist=280*(1-Math.exp(-3.4*t))+120*t+Math.pow(Math.max(0,t-1.9),2)*900;
x.fillStyle='rgba(8,11,13,.36)';x.fillRect(0,0,W,H);x.fillStyle='#eee5d3';
for(var i=0;i<300;i++){var s=S[i],z=((s[2]*1e3-dist)%1e3+1e3)%1e3+1,k=300/z;x.fillRect(cx+Math.cos(s[0])*s[1]*W*k*.5,cy+Math.sin(s[0])*s[1]*H*k*.5,Math.min(3,k*1.2),Math.min(3,k*1.2))}
[1,1.62,2.3].forEach(function(b,j){if(t>b&&t<b+.1)bolt(j%2?1:-1)});
hud.textContent=Math.min(100,Math.round((1-Math.pow(1-Math.min(t/2.2,1),2))*100));
t>2.7?end():requestAnimationFrame(f)}
requestAnimationFrame(f);el.querySelector('.iskip').addEventListener('click',end);addEventListener('keydown',function(e){if(e.key==='Escape')end()})}
var started=0;function start(){if(started||R)return;started=1;var go=function(){embers();parallax()};'requestIdleCallback'in window?requestIdleCallback(go,{timeout:2000}):setTimeout(go,600)}
function embers(){var c=document.createElement('canvas');c.id='embers';c.setAttribute('aria-hidden','true');document.body.appendChild(c);var x=c.getContext('2d'),P=[],W,H,run=0;
function rs(){W=c.width=innerWidth;H=c.height=innerHeight}rs();addEventListener('resize',rs);
for(var i=0;i<60;i++)P.push({x:Math.random()*W,y:Math.random()*H,v:.2+Math.random()*.6,s:1+Math.random()*2,a:Math.random(),h:Math.random()<.5?'255,230,43':'139,233,237'});
function f(){if(!d.classList.contains('anim')){run=0;x.clearRect(0,0,W,H);return}x.clearRect(0,0,W,H);P.forEach(function(p){p.y-=p.v;p.x+=Math.sin(p.y/40)*.3;if(p.y<-5){p.y=H+5;p.x=Math.random()*W}x.fillStyle='rgba('+p.h+','+(.25+.5*p.a)+')';x.fillRect(p.x,p.y,p.s,p.s)});requestAnimationFrame(f)}
function kick(){if(!run&&d.classList.contains('anim')){run=1;requestAnimationFrame(f)}}kick();document.addEventListener('bc-motion',kick)}
function parallax(){var F=document.querySelectorAll('[data-depth]'),q=0;addEventListener('pointermove',function(e){if(q||!d.classList.contains('anim'))return;q=1;requestAnimationFrame(function(){q=0;var dx=e.clientX/innerWidth-.5,dy=e.clientY/innerHeight-.5;F.forEach(function(n){var k=+n.dataset.depth;n.style.translate=(dx*k)+'px '+(dy*k)+'px'})})},{passive:true})}
document.readyState==='complete'?intro():addEventListener('load',intro)})();

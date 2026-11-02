(function(){var d=document.documentElement,b=document.getElementById('mt');
function on(){return d.classList.contains('anim')}
b.setAttribute('aria-pressed',on());
b.addEventListener('click',function(){var v=!on();d.classList.toggle('anim',v);d.classList.toggle('no-motion',!v);b.setAttribute('aria-pressed',v);try{localStorage.setItem('bc-motion',v?'on':'off')}catch(e){}document.dispatchEvent(new Event('bc-motion'))});
var els=document.querySelectorAll('.reveal,.rv');
if('IntersectionObserver'in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(e){io.observe(e)})}else els.forEach(function(e){e.classList.add('is-in')})})();

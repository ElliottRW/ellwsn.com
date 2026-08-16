// Decorative animated background — self-contained, no exports needed
// beyond the single entry point that starts it.
export function initParticles(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, particles;
  const COUNT = 90;
  const MOUSE = { x: -9999, y: -9999 };
  const RADIUS = 120;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  function mkParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.35 + 0.12,
    };
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      const dx = p.x - MOUSE.x, dy = p.y - MOUSE.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < RADIUS) {
        const force = (RADIUS - dist) / RADIUS;
        p.vx += (dx / dist) * force * 0.8;
        p.vy += (dy / dist) * force * 0.8;
      }
      p.vx *= 0.96; p.vy *= 0.96;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
      ctx.fill();
    }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 80) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255,255,255,${0.1 * (1 - d / 80)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('mousemove', e => { MOUSE.x = e.clientX; MOUSE.y = e.clientY; });
  window.addEventListener('mouseleave', () => { MOUSE.x = -9999; MOUSE.y = -9999; });
  window.addEventListener('touchmove', e => { MOUSE.x = e.touches[0].clientX; MOUSE.y = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', () => { MOUSE.x = -9999; MOUSE.y = -9999; });
  window.addEventListener('resize', resize);

  resize();
  particles = Array.from({ length: COUNT }, mkParticle);
  draw();
}

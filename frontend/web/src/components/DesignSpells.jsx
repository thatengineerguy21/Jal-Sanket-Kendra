import React, { useEffect, useRef } from 'react';

export default function DesignSpells() {
  const spotlightRef = useRef(null);

  useEffect(() => {
    // 1. Spotlight Global Background
    const handleMouseMove = (e) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.setProperty('--mouse-x', `${e.clientX}px`);
        spotlightRef.current.style.setProperty('--mouse-y', `${e.clientY}px`);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 2. Liquid Ripple Effect on buttons & nav links
    const handleGlobalClick = (e) => {
      const btn = e.target.closest('.btn, .spell-magnetic-item');
      if (!btn) return;
      
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      const ripple = document.createElement('span');
      ripple.className = 'spell-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      if (getComputedStyle(btn).position === 'static') {
        btn.style.position = 'relative';
      }
      btn.style.overflow = 'hidden';
      
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    };
    document.addEventListener('mousedown', handleGlobalClick);

    // 3. Magnetic Nav Pill
    const handleMagneticEnter = (e) => {
      const item = e.target.closest('.spell-magnetic-item');
      if (!item) return;
      const wrap = item.closest('.spell-magnetic-wrap');
      if (!wrap) return;
      
      let pill = wrap.querySelector('.spell-magnetic-pill');
      if (!pill) {
        pill = document.createElement('div');
        pill.className = 'spell-magnetic-pill';
        wrap.insertBefore(pill, wrap.firstChild);
      }
      
      const wrapRect = wrap.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      
      pill.style.opacity = '1';
      pill.style.width = `${itemRect.width}px`;
      pill.style.height = `${itemRect.height}px`;
      pill.style.left = `${itemRect.left - wrapRect.left}px`;
      pill.style.top = `${itemRect.top - wrapRect.top}px`;
    };

    const handleMagneticLeave = (e) => {
      const item = e.target.closest('.spell-magnetic-item');
      if (!item) return;
      const wrap = item.closest('.spell-magnetic-wrap');
      if (!wrap) return;
      
      const pill = wrap.querySelector('.spell-magnetic-pill');
      if (pill) {
        pill.style.opacity = '0';
      }
    };

    // 4. 3D Tilt Effect
    const handleCardMove = (e) => {
      const card = e.target.closest('.spell-tilt-card');
      if (!card) return;
      
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Limit max rotation degrees
      const rotateX = ((y - centerY) / centerY) * -5; 
      const rotateY = ((x - centerX) / centerX) * 5;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      
      let glare = card.querySelector('.spell-tilt-glare');
      if (!glare) {
        glare = document.createElement('div');
        glare.className = 'spell-tilt-glare';
        card.appendChild(glare);
      }
      glare.style.setProperty('--glare-x', `${x}px`);
      glare.style.setProperty('--glare-y', `${y}px`);
    };
    
    const handleCardLeave = (e) => {
      const card = e.target.closest('.spell-tilt-card');
      if (!card) return;
      card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      const glare = card.querySelector('.spell-tilt-glare');
      if (glare) {
        glare.style.opacity = '0';
      }
    };
    
    document.addEventListener('mouseover', handleMagneticEnter);
    document.addEventListener('mouseout', handleMagneticLeave);
    document.addEventListener('mousemove', handleCardMove);
    document.addEventListener('mouseleave', handleCardLeave, true); // Use capture phase for mouseleave

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('mouseover', handleMagneticEnter);
      document.removeEventListener('mouseout', handleMagneticLeave);
      document.removeEventListener('mousemove', handleCardMove);
      document.removeEventListener('mouseleave', handleCardLeave, true);
    };
  }, []);

  return <div ref={spotlightRef} className="spell-spotlight" />;
}

/* Canvas adapter for the S3 human-mouth drawing, in its 240 x 100 viewport.
 * Pose data comes from the generated cross-platform mouth contract.
 */
class Robot790HumanMouth {
  constructor(context) {
    this.context = context;
    this.shape = null;
    this.changedAt = 0;
  }

  draw(shape, inputPose, talk, energy, now, viewport) {
    if (shape !== this.shape) { this.shape = shape; this.changedAt = now; }
    const ctx = this.context;
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const scale = 0.66;
    const lip = '#cf91a5', hi = '#f5c2cc', lo = '#966477';
    const shadow = '#29171f', cavity = '#090005', enamel = '#eee4c6';
    const mix = (a, b, amount) => {
      const av = parseInt(a.slice(1), 16), bv = parseInt(b.slice(1), 16);
      return '#' + [16, 8, 0].map(shift => Math.round(((av >> shift) & 255) * (1 - amount) + ((bv >> shift) & 255) * amount).toString(16).padStart(2, '0')).join('');
    };
    const ellipse = (x, y, rx, ry, color) => {
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    };
    const line = (x1, y1, x2, y2, color, width = 1) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    };
    const rect = (x, y, w, h, r, color) => {
      ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.min(r, w / 2, h / 2));
      ctx.fillStyle = color; ctx.fill();
    };
    const triangle = (x1, y1, x2, y2, x3, y3, color) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    const teeth = (x, y, w, h, amount) => {
      if (amount <= 0.01 || h < 12 || w < 36) return;
      const th = clamp(h * (0.24 + amount * 0.18), 5, 22);
      rect(x, y, w, th, 5, enamel);
      line(x + 4, y + th - 1, x + w - 4, y + th - 1, '#7e6862');
      for (let tx = x + 28; tx < x + w - 14; tx += 36) line(tx, y + 2, tx, y + th - 4, '#7e6862');
    };
    const tongue = (x, y, rx, ry) => {
      if (rx < 14 || ry < 4) return;
      ellipse(x, y, rx, ry, '#a23648');
      ellipse(x - rx / 5, y - ry / 4, Math.max(4, rx / 3), Math.max(2, ry / 4), '#da5e6a');
    };
    const pose = { ...inputPose };
    if (talk > 0.01) {
      const pulse = clamp(0.58 + 0.32 * Math.sin(now * 0.037) + 0.18 * Math.sin(now * 0.071 + 1.7), 0, 1);
      pose.open = Math.max(pose.open, 0.18 + energy * 0.70 * pulse * talk);
      pose.width = Math.max(pose.width, 0.56 + energy * 0.20 * talk);
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height); ctx.clip();
    const fit = Math.min(viewport.width / 280, viewport.height / 150);
    ctx.translate(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
    ctx.scale(fit, fit);
    ctx.translate(-120, -53);
    try {
      const cx0 = 118, cy0 = 53;
      if (shape === 'sleep' && talk <= 0.01 && now - this.changedAt >= 220) {
        const w = (240 - 84) * scale, x = cx0 - w / 2, y = cy0 - 8;
        rect(x, y, w, 16, 8, lo);
        line(x + 24, y + 3, x + w - 34, y + 3, hi);
        line(x + 30, y + 13, x + w - 40, y + 13, shadow);
        return;
      }
      const w = clamp((124 + pose.width * 210) * scale, 84 * scale, 228);
      const open = clamp((7 + pose.open * 88) * scale, 4, 74);
      const lh = clamp((26 + pose.open * 28 + pose.tension * 7) * scale, 17, 34);
      const smirk = shape === 'smirk_left' || shape === 'smirk_right';
      const dx = talk > 0.01 ? 5 * Math.sin(now * 0.0031) + 2 * Math.sin(now * 0.0071 + 1.4) : 0;
      const dy = talk > 0.01 ? 2 * Math.sin(now * 0.0027 + 0.6) : 0;
      const cx = cx0 + pose.skew * (smirk ? 38 : 20) + dx, cy = cy0 + pose.tension * 4 + dy;
      const curve = pose.curve * 18;
      const asym = (talk > 0.01 ? 5 * talk * Math.sin(now * 0.0041 + pose.width * 3.1) : 0) + pose.skew * (smirk ? 22 : 12);
      const slant = pose.slant * 24 + pose.skew * 6, lift = pose.upperLift * 26;
      const ll = Math.max(0, -lift), rl = Math.max(0, lift);
      const cw = w * (0.86 - pose.tension * 0.05), ch = Math.max(5, open);
      const top = cy - ch / 2 - lh / 3 - curve / 3, bottom = cy + ch / 2 + lh / 3 - curve / 5;
      const lt = top + slant / 2 - ll + asym / 10, rt = top - slant / 2 - rl - asym / 12;
      const ct = top - (ll + rl) / 6 + asym / 18;
      const lb = bottom - slant / 4 + ll / 7, rb = bottom + slant / 4 + rl / 7, bc = bottom + asym / 18;
      let lc = cy - curve + pose.tension * 2 + asym / 3 + slant / 2 - ll / 2;
      let rc = cy - curve + pose.tension * 2 - asym / 4 - slant / 2 - rl / 2;
      if (smirk) {
        lc += Math.abs(pose.skew) * (pose.skew > 0 ? 5 : -15);
        rc += Math.abs(pose.skew) * (pose.skew > 0 ? -15 : 5);
      }
      if ((smirk || shape === 'sneer') && talk <= 0.01) {
        const dir = pose.skew >= 0 ? 1 : -1;
        const wobble = smirk ? Math.sin(now * 0.0023 + (dir > 0 ? 0.4 : 2.1)) * 4 * scale : 0;
        const ripple = smirk ? Math.sin(now * 0.0037 + (dir > 0 ? 1.6 : 3)) * 3 * scale : 0;
        const rw = w * (smirk ? 0.64 : 0.84), rh = (smirk ? 68 : 82) * scale;
        const x = cx0 + (smirk ? dir * 58 : pose.skew * 28) * scale + wobble;
        const y = cy0 + (smirk ? 0 : 12) * scale + ripple / 3;
        const raisedX = x + dir * rw / 5, lowX = x - dir * rw / 5;
        const raisedY = y - rh / 4 - ripple, lowY = y + rh / 4 + ripple;
        ellipse(x, y + 8 * scale, rw / 2 + 18 * scale, rh / 2 + 16 * scale, shadow);
        ellipse(x, y + 10 * scale, rw / 2 + 8 * scale, rh / 2 + 8 * scale, lo);
        ellipse(lowX, lowY, rw / 3, Math.max(9, 20 * scale), lip);
        ellipse(raisedX, raisedY, rw / 3, Math.max(8, 18 * scale), lip);
        ellipse(raisedX + dir * rw / 12, raisedY - 7 * scale, rw / 5, Math.max(3, 6 * scale), hi);
        line(x - rw / 2 + rw / 5, y + (dir > 0 ? 12 : 4) * scale,
          x + rw / 2 - rw / 5, y + (dir > 0 ? 4 : 12) * scale, cavity, 5);
        if (!smirk) {
          const ty = y - 2 * scale, fx = x + dir * rw / 6;
          teeth(dir > 0 ? x + rw / 25 : x - rw / 3, ty, Math.max(36, rw * 0.28), Math.max(20, 30 * scale), 0.45);
          triangle(fx - 9 * scale, ty + 2, fx + 9 * scale, ty + 2, fx + dir * 5 * scale, ty + 21 * scale, enamel);
        } else {
          const creaseX = x + dir * (rw / 2 - 26 * scale), creaseY = raisedY + 12 * scale;
          line(creaseX, creaseY, creaseX - dir * 30 * scale, creaseY - 11 * scale, hi);
          line(lowX - rw / 5, lowY + 3 * scale, lowX + rw / 5, lowY + 6 * scale, mix(lip, hi, 0.35));
        }
        ellipse(x - rw / 2 + 31 * scale, y + 10 * scale, Math.max(8, 18 * scale), Math.max(8, 15 * scale), mix(lo, lip, 0.42));
        ellipse(x + rw / 2 - 31 * scale, y + 10 * scale, Math.max(8, 18 * scale), Math.max(8, 15 * scale), mix(lo, lip, 0.48));
        return;
      }
      if (shape === 'o' && talk <= 0.01) {
        ellipse(cx, cy, w / 2 + 22 * scale, open / 2 + lh / 2 + 18 * scale, shadow);
        ellipse(cx, cy, w / 2 + 8 * scale, open / 2 + lh / 2 + 8 * scale, lo);
        ellipse(cx, cy, Math.max(8, w / 2 - 8 * scale), Math.max(8, open / 2 + lh / 2 - 4 * scale), lip);
        ellipse(cx, cy, Math.max(6, w / 2 - 28 * scale), Math.max(5, open / 2 - 8 * scale), cavity);
        ellipse(cx - w / 7, cy - open / 4, Math.max(5, w / 8), Math.max(2, 5 * scale), hi);
        return;
      }
      ellipse(cx + asym / 4, cy, w / 2 + 20, ch / 2 + lh + 16, shadow);
      ellipse(cx + asym / 5, bc + 2, w / 2 + 16, Math.max(18, lh / 2 + 10), lo);
      ellipse(cx - w / 5 + asym / 4, lb, w / 3 + 12, Math.max(15, lh / 2 + 4), lip);
      ellipse(cx + w / 5 + asym / 3, rb, w / 3 + 8, Math.max(15, lh / 2 + 4), lip);
      ellipse(cx - w / 5 + asym / 2, lt, w / 3 + 14, Math.max(13, lh / 2 + 1), lo);
      ellipse(cx + w / 5 + asym / 3, rt, w / 3 + 5, Math.max(12, lh / 2 - 1), lo);
      ellipse(cx - w / 5 + asym / 2, lt - 3, w / 3 + 6, Math.max(11, lh / 2 - 2), lip);
      ellipse(cx + w / 5 + asym / 3, rt - 4, Math.max(8, w / 3 - 1), Math.max(10, lh / 2 - 4), lip);
      ellipse(cx + asym / 3, ct + lh / 7, w / 5 + 3, Math.max(8, lh / 3), mix(lo, lip, 0.36));
      triangle(cx - 24 + asym / 4, ct - lh / 2 + 6, cx + 18 + asym / 4, ct - lh / 2 + 4, cx - 3 + asym / 3, ct - lh / 7, lo);
      ellipse(cx - w / 5 + asym / 2, lt - lh / 5, w / 5, Math.max(4, lh / 8), hi);
      ellipse(cx + w / 6 + asym / 3, rt - lh / 6, w / 6, Math.max(3, lh / 9), mix(lip, hi, 0.5));
      ellipse(cx + w / 10 + asym / 4, bc - lh / 5, w / 3 + 6, Math.max(5, lh / 7), mix(lip, hi, 0.5));
      ellipse(cx + asym / 3, cy + asym / 12, cw / 2, Math.max(3, ch / 2), cavity);
      if (shape === 'grimace') {
        const tw = cw - 44, th = clamp(Math.max(26, ch + 12) * (0.20 + 0.95 * 0.08), 8, 16);
        const x = cx + asym / 3 - tw / 2, y = cy + asym / 12;
        if (tw >= 48) {
          rect(x, y - th - 1, tw, th, 5, enamel); rect(x, y + 1, tw, th, 5, enamel);
          line(x + 5, y, x + tw - 5, y, '#7e6862');
          const step = clamp(tw / 8, 24, 34);
          for (let tx = x + step; tx < x + tw - step / 2; tx += step) {
            line(tx, y - th + 1, tx, y - 4, '#7e6862');
            line(tx + step / 2, y + 3, tx + step / 2, y + th - 2, '#7e6862');
          }
        }
      } else if (shape === 'tongue') {
        const y = cy + ch / 2 + lh / 5, x = cx + asym / 5;
        ellipse(x, y, cw / 4, Math.max(12, ch / 3), '#c94f68');
        ellipse(x, y + 14 * scale, cw / 5, Math.max(9, ch / 4), '#e07586');
        line(x, y - Math.max(5, ch / 8), x, y + Math.max(14, ch / 4), '#9d3048');
      } else if (ch > 16) tongue(cx + asym / 4, cy + ch / 3 + asym / 12, cw / 4, Math.max(5, ch / 5));
      else line(cx + asym / 3 - cw / 2 + 10, cy + asym / 12, cx + asym / 3 + cw / 2 - 10, cy + asym / 12, '#1c020c');
      teeth(cx + asym / 3 - cw / 2 + 18, cy + asym / 12 - ch / 2 + 2, cw - 36, ch,
        shape === 'grimace' ? 0 : Math.max(pose.teeth, pose.open > 0.34 ? clamp((pose.open - 0.30) * 1.2, 0, 0.42) : 0));
      if (shape === 'big_smile' && cw > 92) {
        const y = cy + asym / 12 + Math.max(4, ch / 7);
        line(cx + asym / 3 - cw / 2 + 24, y, cx + asym / 3 + cw / 2 - 24, y, '#ccbeaa');
        for (let tx = cx + asym / 3 - cw / 2 + 40; tx < cx + asym / 3 + cw / 2 - 36; tx += 30) line(tx, y - 7, tx, y + 7, '#7e6862');
      }
      if (Math.abs(pose.upperLift) > 0.35 && cw > 84) {
        const right = pose.upperLift > 0;
        const x = cx + (right ? cw / 6 : -cw / 6) + asym / 3;
        const y = cy + asym / 12 - ch / 2 + 3 - (right ? rl : ll) / 3;
        triangle(x - 12, y, x + 12, y, x + (right ? 5 : -5), y + Math.max(10, ch / 3), enamel);
      }
      const left = cx - w / 2, right = cx + w / 2;
      ellipse(left + asym / 3, lc + pose.skew * 10, Math.max(9, lh / 3), Math.max(9, lh / 3), mix(lo, lip, 0.42));
      ellipse(right + asym / 4, rc - pose.skew * 10, Math.max(11, lh / 3), Math.max(11, lh / 3), mix(lo, lip, 0.48));
      if (shape === 'smile') {
        line(left + 20, lc - 6, left + 48, lc - 18, hi);
        line(right - 20, rc - 6, right - 48, rc - 18, hi);
      } else if (shape === 'frown') {
        line(left + 22, lc + 3, left + 66, lc + 34, lo);
        line(right - 22, rc + 3, right - 66, rc + 34, lo);
      }
    } finally { ctx.restore(); }
  }
}
globalThis.Robot790HumanMouth = Robot790HumanMouth;

(function (root) {
  'use strict';

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const mix = (a, b, amount) => a + (b - a) * amount;
  const poses = Object.freeze({
    X: { jaw: 0, width: .72, round: 0, seal: 1, bite: 0, tongue: 0, teeth: 0 },
    A: { jaw: .12, width: .74, round: .02, seal: 1, bite: 0, tongue: 0, teeth: 0 },
    B: { jaw: .12, width: .88, round: 0, seal: 0, bite: 0, tongue: 0, teeth: .7 },
    C: { jaw: .48, width: .88, round: .05, seal: 0, bite: 0, tongue: 0, teeth: .28 },
    D: { jaw: .92, width: .8, round: .08, seal: 0, bite: 0, tongue: 0, teeth: .24 },
    E: { jaw: .46, width: .57, round: .62, seal: 0, bite: 0, tongue: 0, teeth: .08 },
    F: { jaw: .24, width: .36, round: 1, seal: 0, bite: 0, tongue: 0, teeth: 0 },
    G: { jaw: .13, width: .76, round: .04, seal: 0, bite: 1, tongue: 0, teeth: .9 },
    H: { jaw: .4, width: .8, round: .08, seal: 0, bite: 0, tongue: 1, teeth: .4 }
  });
  const labels = { X: 'Rest', A: 'M / B / P', B: 'Consonant / EE', C: 'EH / AE', D: 'AH', E: 'OH', F: 'OO / W', G: 'F / V', H: 'L' };
  const defaults = Object.freeze({ transition: 90, anticipation: 45, jaw: 1, lips: 1, width: 1, smile: .12 });

  function validateTrack(data) {
    const duration = data?.metadata?.duration;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 120) throw new Error('Cue duration must be between 0 and 120 seconds.');
    if (!Array.isArray(data.mouthCues) || !data.mouthCues.length || data.mouthCues.length > 10000) throw new Error('Expected 1 to 10,000 mouth cues.');
    const cues = [];
    let end = 0;
    for (const cue of data.mouthCues) {
      if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < end || cue.end <= cue.start || cue.end > duration + .001 || !Object.hasOwn(poses, cue.value)) {
        throw new Error('Cues must be ordered, non-overlapping A-H/X intervals within the duration.');
      }
      if (cue.start > end) cues.push({ start: end, end: cue.start, value: 'X' });
      const normalizedEnd = Math.min(cue.end, duration);
      if (normalizedEnd <= cue.start) throw new Error('Cue starts after the audio ends.');
      cues.push({ start: cue.start, end: normalizedEnd, value: cue.value });
      end = normalizedEnd;
    }
    if (end < duration) cues.push({ start: end, end: duration, value: 'X' });
    return { metadata: { duration }, mouthCues: cues };
  }

  function study(sequence) {
    let time = 0;
    const mouthCues = sequence.map(([value, duration]) => {
      const start = time;
      time += duration;
      return { value, start, end: time };
    });
    return validateTrack({ metadata: { duration: time }, mouthCues });
  }
  const studies = {
    contacts: study([['X', .5], ['D', .55], ['A', .12], ['C', .48], ['A', .09], ['F', .6], ['G', .35], ['C', .5], ['H', .32], ['D', .5], ['X', .6]]),
    rounding: study([['X', .5], ['C', .65], ['F', .65], ['D', .65], ['E', .65], ['B', .45], ['F', .65], ['X', .6]]),
    inventory: study(Object.keys(poses).map(value => [value, .8]).concat([['X', .6]]))
  };

  function cueIndex(track, t) {
    const cues = track.mouthCues;
    let low = 0;
    let high = cues.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (cues[mid].end <= t) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  function blend(a, b, amount) {
    return Object.fromEntries(Object.keys(poses.X).map(key => [key, mix(a[key], b[key], amount)]));
  }

  function sample(track, t, transition = 0) {
    if (t < 0 || t >= track.metadata.duration) return { ...poses.X };
    const cues = track.mouthCues;
    const index = cueIndex(track, t);
    const cue = cues[index];
    if (!cue) return { ...poses.X };
    if (transition > 0) {
      // Keep an unblended center even for brief contacts. Smoothing cannot erase it.
      for (const rightIndex of [index, index + 1]) {
        const left = cues[rightIndex - 1];
        const right = cues[rightIndex];
        if (!left || !right) continue;
        const half = Math.min(transition / 2000, (left.end - left.start) * .4, (right.end - right.start) * .4);
        if (half > 0 && t >= right.start - half && t <= right.start + half) {
          return blend(poses[left.value], poses[right.value], smooth((t - right.start + half) / (2 * half)));
        }
      }
    }
    return { ...poses[cue.value] };
  }

  function poseAt(track, t, options = defaults, articulated = true) {
    const settings = { ...defaults, ...options };
    const pose = sample(track, t, articulated ? settings.transition : 0);
    if (articulated && t >= 0 && t < track.metadata.duration) {
      const lips = sample(track, t + settings.anticipation / 1000, settings.transition);
      pose.round = lips.round;
      pose.width = lips.width;
    }
    return pose;
  }

  function geometry(pose, options = defaults) {
    const settings = { ...defaults, ...options };
    const seal = clamp(pose.seal);
    const bite = clamp(pose.bite);
    const round = clamp(pose.round);
    const width = (70 + 150 * clamp(pose.width)) * (1 - round * .48) * clamp(settings.width, .65, 1.35);
    const gap = (8 + 122 * clamp(pose.jaw * settings.jaw) + round * 36) * (1 - seal);
    return {
      width,
      top: -gap * .22,
      bottom: gap * .78 * (1 - bite * .86),
      lip: (15 + round * 12) * clamp(settings.lips, .5, 1.8),
      corner: -clamp(settings.smile, -.5, .8) * 22 * (1 - round * .8),
      round, seal, bite, tongue: clamp(pose.tongue), teeth: clamp(pose.teeth)
    };
  }

  function draw(ctx, pose, options = defaults) {
    const g = geometry(pose, options);
    const w = g.width;
    const y = g.corner;
    const lip = g.lip;
    const upper = g.top;
    const lower = g.bottom;
    const arc = .58 + g.round * .42;
    const cavity = () => {
      ctx.beginPath();
      ctx.moveTo(-w, y);
      ctx.bezierCurveTo(-w * arc, upper, -w * .36, upper, 0, upper);
      ctx.bezierCurveTo(w * .36, upper, w * arc, upper, w, y);
      ctx.bezierCurveTo(w * arc, lower, w * .36, lower, 0, lower);
      ctx.bezierCurveTo(-w * .36, lower, -w * arc, lower, -w, y);
      ctx.closePath();
    };
    ctx.save();
    // One continuous silhouette and cavity for every viseme, including rounded lips.
    ctx.beginPath();
    ctx.moveTo(-w - 3, y);
    ctx.bezierCurveTo(-w * .7, upper - lip * .7, -w * .28, upper - lip * 1.7, 0, upper - lip);
    ctx.bezierCurveTo(w * .28, upper - lip * 1.7, w * .7, upper - lip * .7, w + 3, y);
    ctx.bezierCurveTo(w * .72, lower + lip, w * .3, lower + lip * 1.65, 0, lower + lip * 1.55);
    ctx.bezierCurveTo(-w * .3, lower + lip * 1.65, -w * .72, lower + lip, -w - 3, y);
    ctx.closePath();
    const material = ctx.createLinearGradient(0, upper - lip * 1.6, 0, lower + lip * 1.6);
    material.addColorStop(0, '#d1899d');
    material.addColorStop(.3, '#ab506c');
    material.addColorStop(.55, '#702f45');
    material.addColorStop(.74, '#c7758c');
    material.addColorStop(1, '#85384f');
    ctx.fillStyle = material;
    ctx.fill();
    cavity();
    ctx.fillStyle = '#170b11';
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (g.teeth > .01 && g.seal < .99) {
      // The teeth remain attached to the upper jaw; the lower lip rises toward them.
      ctx.globalAlpha = g.teeth;
      ctx.fillStyle = '#e9ddd0';
      ctx.beginPath();
      ctx.roundRect(-w * .75, upper - 12, w * 1.5, mix(14 + (lower - upper) * .11, 12 + lower - upper, g.bite), [0, 0, 10, 10]);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (g.seal < .99) {
      ctx.fillStyle = '#a84e67';
      ctx.beginPath();
      const tongueY = mix(lower + 12, upper + 12, g.tongue);
      ctx.moveTo(-w * .4, lower + 16);
      ctx.bezierCurveTo(-w * .5, tongueY - 20, w * .5, tongueY - 20, w * .4, lower + 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#efb7c1';
    ctx.globalAlpha = .52;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * .4, lower + lip * .9);
    ctx.bezierCurveTo(-w * .2, lower + lip * 1.2, w * .2, lower + lip * 1.2, w * .4, lower + lip * .9);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (g.seal > .98) {
      ctx.strokeStyle = '#65273c';
      ctx.lineWidth = 2.2;
      cavity();
      ctx.stroke();
    }
    ctx.restore();
    return g;
  }

  const api = { poses, labels, defaults, studies, validateTrack, cueIndex, sample, poseAt, geometry, draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MouthRig = api;
}(typeof window !== 'undefined' ? window : this));

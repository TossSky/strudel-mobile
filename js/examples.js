/**
 * examples.js — Strudel pattern examples
 */
(function () {
  'use strict';

  window.Examples = {
    "Basics": [
      {
        name: "Simple Beat",
        desc: "Kick and snare",
        code: 's("bd sd [~ bd] sd")'
      },
      {
        name: "Piano Melody",
        desc: "Notes on piano",
        code: 'note("c3 e3 g3 b3 c4 b3 g3 e3")\n  .s("piano")\n  .slow(2)'
      },
      {
        name: "Chords",
        desc: "Minor chords with pads",
        code: 'n("<0 3 5 2>")\n  .scale("C4:minor")\n  .s("sawtooth")\n  .lpf(800)\n  .voicing()\n  .room(0.7)\n  .slow(2)'
      },
      {
        name: "Minimal Drums",
        desc: "Kick + hihat + snare",
        code: 'stack(\n  s("bd*4"),\n  s("~ sd"),\n  s("hh*8").gain(0.6)\n)'
      },
      {
        name: "TR-909 Beat",
        desc: "Classic drum machine",
        code: 's("[bd <hh oh>]*2").bank("RolandTR909").dec(.4)'
      }
    ],
    "Patterns": [
      {
        name: "Euclidean",
        desc: "Euclidean rhythms",
        code: 'stack(\n  s("bd(3,8)"),\n  s("sd(2,8)").late(0.125),\n  s("hh(5,8)").gain(0.5)\n).room(0.3)'
      },
      {
        name: "Polymetry",
        desc: "Layered meters",
        code: 'stack(\n  note("c2 g2 e2 a2").s("sawtooth")\n    .lpf(600).slow(3),\n  s("bd(3,8)"),\n  note("e4 g4 b4 d5 e5").s("triangle")\n    .fast(1.5).gain(0.3)\n)'
      },
      {
        name: "Randomization",
        desc: "Random transforms",
        code: 'n("0 1 2 3 4 5 6 7")\n  .scale("C3:dorian")\n  .s("square")\n  .lpf(1200)\n  .sometimes(x => x.fast(2))\n  .sometimes(x => x.rev())\n  .room(0.5)\n  .clip(0.5)'
      }
    ],
    "Effects": [
      {
        name: "Delay + Reverb",
        desc: "Atmospheric",
        code: 'note("<c3 a2 f2 g2>")\n  .s("sawtooth")\n  .lpf(sine.range(200, 2000).slow(8))\n  .room(0.8).delay(0.5)\n  .gain(0.5)'
      },
      {
        name: "Filter Sweep",
        desc: "Moving LPF",
        code: 'note("c2 c2 c2 c2")\n  .s("sawtooth")\n  .lpf(sine.range(100, 5000).slow(4))\n  .resonance(15)\n  .gain(0.4)'
      },
      {
        name: "Jux Stereo",
        desc: "Stereo effects",
        code: 'note("c3 e3 g3 b3")\n  .s("piano")\n  .jux(rev)\n  .superimpose(x => x.add(note(12)).slow(2))\n  .room(0.5)\n  .slow(2)'
      }
    ],
    "Advanced": [
      {
        name: "Ambient",
        desc: "Atmospheric layers",
        code: 'stack(\n  note("<c3 a2 f2 g2>*2")\n    .s("sawtooth")\n    .lpf(600)\n    .room(0.9).gain(0.4).slow(4),\n  note("c5 e5 g5 b5 c6 b5 g5 e5")\n    .s("triangle")\n    .gain(0.15).delay(0.6)\n    .slow(8),\n  s("hh*4").gain(0.08).pan(sine)\n)'
      },
      {
        name: "DnB",
        desc: "Fast breakbeat",
        code: 'stack(\n  s("<bd bd ~ bd> <~ sd ~ [sd sd]>")\n    .bank("RolandTR909"),\n  s("hh*8").bank("RolandTR909")\n    .gain(".4 .8 .6 .9 .4 .7 .5 1")\n    .pan(sine),\n  note("<c2 [c2 c2] ~ c2>")\n    .s("sawtooth")\n    .lpf(400).gain(0.4)\n).cps(1.4)'
      },
      {
        name: "Arpeggios",
        desc: "Fast arpeggiated",
        code: 'n("0 2 4 7 9 11 12 14")\n  .scale("C3:minor")\n  .s("square")\n  .room(0.4)\n  .lpf(sine.range(500,3000).slow(4))\n  .fast(2)\n  .clip(0.3)'
      }
    ]
  };
})();

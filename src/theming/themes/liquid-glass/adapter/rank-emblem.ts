import type { EnhancementScope } from "../../../../platform/enhancement-scope";
import type { DirtyRoot } from "../../../../foundation/context";
import { normalizeRankLabel, type RankBadgeIdentity } from "../../../../foundation/semantics/rank-identity";

type RankBadgeDefinition = {
  classes: string;
  emblemHtml: string;
};

const RANK_BADGE_DEFINITIONS: Record<string, RankBadgeDefinition> = {
  "undead": {
    classes: "t-undead fx-aura fx-float fx-glow",
    emblemHtml: "<span class=\"disc\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><path class=\"ico-fill\" d=\"M15 4c-4.2 0-7.2 3.4-7.2 8.4 0 3.7 1.3 6.5 1.3 8.6 0 1-.9 1.6-.9 2.7 0 .9.9 1.5 1.7 1 .7-.4 1.1-.4 1.7 0 .7.5 1.5.5 2.2 0 .6-.4 1-.4 1.7 0 .8.5 1.7-.1 1.7-1 0-1.1-.9-1.7-.9-2.7 0-2.1 1.3-4.9 1.3-8.6C22.2 7.4 19.2 4 15 4Z\" opacity=\".9\"></path><circle class=\"ico-core\" cx=\"11.8\" cy=\"12.5\" r=\"1.7\"></circle><circle class=\"ico-core\" cx=\"18.2\" cy=\"12.5\" r=\"1.7\"></circle><circle class=\"ico-deep\" cx=\"11.8\" cy=\"12.7\" r=\".7\"></circle><circle class=\"ico-deep\" cx=\"18.2\" cy=\"12.7\" r=\".7\"></circle></svg> </span>"
  },
  "apprentice-angel": {
    classes: "t-novice fx-aura fx-float fx-glow",
    emblemHtml: "<span class=\"disc\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"8\" rx=\"5\" ry=\"1.9\" class=\"ico-stroke\" stroke-width=\"1.8\"></ellipse><path class=\"ico-fill\" d=\"M15 12c-1.6 1.2-4 1.5-6.4.9 1.7 1.3 3.7 2 6.4 2s4.7-.7 6.4-2c-2.4.6-4.8.3-6.4-.9Z\" opacity=\".8\"></path><path class=\"ico-stroke\" d=\"M15 13.5v7\" stroke-width=\"1.6\" stroke-linecap=\"round\"></path></svg> </span>"
  },
  "angel": {
    classes: "t-angel fx-aura fx-float fx-glow fx-sweep fx-orbit",
    emblemHtml: "<span class=\"disc\"></span><span class=\"ring\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"6.5\" rx=\"4.6\" ry=\"1.8\" class=\"ico-stroke\" stroke-width=\"1.8\"></ellipse><path class=\"ico-fill\" d=\"M14 12C10.5 9.5 6 9.6 3.6 11.4c1.7.1 2.6.8 3 1.6-1.6-.4-2.8-.1-3.6.7 1.6.3 2.5 1 2.9 1.8 2.5-1.7 5-2.1 7.3-1.7Z\"></path><path class=\"ico-fill\" d=\"M16 12c3.5-2.5 8-2.4 10.4-.6-1.7.1-2.6.8-3 1.6 1.6-.4 2.8-.1 3.6.7-1.6.3-2.5 1-2.9 1.8-2.5-1.7-5-2.1-7.3-1.7Z\"></path><path class=\"ico-core\" d=\"M15 11l1.4 3-1.4 7-1.4-7Z\"></path></svg> </span><span class=\"orb\"></span>"
  },
  "archangel": {
    classes: "t-arch fx-aura fx-float fx-glow fx-sweep fx-orbit",
    emblemHtml: "<span class=\"disc\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"6\" rx=\"4.8\" ry=\"1.9\" class=\"ico-stroke\" stroke-width=\"1.9\"></ellipse><path class=\"ico-fill\" d=\"M14 12.5C9.5 9 4 9.2 1.4 11.6c2 0 3 .8 3.5 1.8-1.9-.5-3.2 0-4.1 1 1.9.3 2.9 1.1 3.3 2.1 2.9-2 6-2.6 9-2.2Z\"></path><path class=\"ico-fill\" d=\"M16 12.5c4.5-3.5 10-3.3 12.6-.9-2 0-3 .8-3.5 1.8 1.9-.5 3.2 0 4.1 1-1.9.3-2.9 1.1-3.3 2.1-2.9-2-6-2.6-9-2.2Z\"></path><path class=\"ico-core\" d=\"M15 11l1.6 3.4-1.6 7.5-1.6-7.5Z\"></path></svg> </span><span class=\"orb\"></span><span class=\"orb\"></span>"
  },
  "authority-angel": {
    classes: "t-prin fx-aura fx-float fx-glow fx-sweep fx-orbit",
    emblemHtml: "<span class=\"disc\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"5.6\" rx=\"4.8\" ry=\"1.9\" class=\"ico-stroke\" stroke-width=\"1.9\"></ellipse><path class=\"ico-fill\" d=\"M13.5 13C9 9.6 3.6 9.8 1 12.2c2 0 3 .8 3.5 1.8-1.9-.5-3.2 0-4.1 1 1.9.3 2.9 1.1 3.3 2.1 2.7-1.9 5.6-2.5 8.8-2.1Z\"></path><path class=\"ico-fill\" d=\"M16.5 13c4.5-3.4 9.9-3.2 12.5-.8-2 0-3 .8-3.5 1.8 1.9-.5 3.2 0 4.1 1-1.9.3-2.9 1.1-3.3 2.1-2.7-1.9-5.6-2.5-8.8-2.1Z\"></path><circle class=\"ico-core\" cx=\"15\" cy=\"10.6\" r=\"1.7\"></circle><rect x=\"14.3\" y=\"11.4\" width=\"1.4\" height=\"10\" rx=\".7\" class=\"ico-core\"></rect><rect x=\"12.4\" y=\"14.2\" width=\"5.2\" height=\"1.3\" rx=\".6\" class=\"ico-deep\"></rect></svg> </span><span class=\"orb\" style=\"--c1:#bfe0ff\"></span><span class=\"orb\" style=\"--c1:#bfe0ff\"></span>"
  },
  "energy-angel": {
    classes: "t-power fx-aura fx-float fx-glow fx-sweep fx-orbit",
    emblemHtml: "<span class=\"disc\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"5.4\" rx=\"4.9\" ry=\"1.9\" class=\"ico-stroke\" stroke-width=\"1.9\"></ellipse><path class=\"ico-fill\" d=\"M13.5 12.5C9 9 3.4 9.2.8 11.7c2 0 3.1.8 3.6 1.9-2-.6-3.3 0-4.2 1.1 2 .3 3 1.1 3.4 2.2 2.8-2 5.8-2.6 9.1-2.2Z\"></path><path class=\"ico-fill\" d=\"M16.5 12.5c4.5-3.5 10.1-3.3 12.7-.8-2 0-3.1.8-3.6 1.9 2-.6 3.3 0 4.2 1.1-2 .3-3 1.1-3.4 2.2-2.8-2-5.8-2.6-9.1-2.2Z\"></path><path class=\"ico-core\" d=\"M15 10.6l4.2 1.5v3.1c0 2.5-1.7 4.4-4.2 5.4-2.5-1-4.2-2.9-4.2-5.4v-3.1Z\"></path><path d=\"M12.9 15.2l1.5 1.5 2.6-2.8\" stroke=\"var(--c3)\" stroke-width=\"1.2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></svg> </span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"orb\"></span>"
  },
  "power-angel": {
    classes: "t-virtue fx-aura fx-float fx-glow fx-sweep fx-orbit fx-spark",
    emblemHtml: "<span class=\"disc\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"5.2\" rx=\"5\" ry=\"2\" class=\"ico-stroke\" stroke-width=\"2\"></ellipse><path class=\"ico-fill\" d=\"M13.5 12.5C9 9 3.2 9.2.6 11.7c2.1 0 3.2.8 3.7 1.9-2-.6-3.4 0-4.3 1.1 2 .3 3.1 1.2 3.5 2.3 2.9-2.1 6-2.7 9.5-2.3Z\"></path><path class=\"ico-fill\" d=\"M16.5 12.5c4.5-3.5 10.3-3.3 12.9-.8-2.1 0-3.2.8-3.7 1.9 2-.6 3.4 0 4.3 1.1-2 .3-3.1 1.2-3.5 2.3-2.9-2.1-6-2.7-9.5-2.3Z\"></path><path class=\"ico-core\" d=\"M15 10.2l1.5 4.3 4.3 1.5-4.3 1.5L15 21.8l-1.5-4.3-4.3-1.5 4.3-1.5Z\"></path></svg> </span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "dominion-angel": {
    classes: "t-high fx-aura fx-float fx-glow2 fx-sweep fx-orbit fx-spark",
    emblemHtml: "<span class=\"disc\"></span><span class=\"beam\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"5.5\" rx=\"5\" ry=\"2\" class=\"ico-stroke\" stroke-width=\"2\"></ellipse><path class=\"ico-fill\" d=\"M14 13C9 9 3 9.3.4 11.8c2.2 0 3.3.9 3.8 2-2-.6-3.5 0-4.4 1.1 2 .3 3.1 1.2 3.5 2.3C6.4 15 9.7 14.4 13 14.8Z\"></path><path class=\"ico-fill\" d=\"M16 13c5-4 11-3.7 13.6-1.2-2.2 0-3.3.9-3.8 2 2-.6 3.5 0 4.4 1.1-2 .3-3.1 1.2-3.5 2.3C23.6 15 20.3 14.4 17 14.8Z\"></path><path class=\"ico-core\" d=\"M15 11l1.7 3.6-1.7 8-1.7-8Z\"></path><circle class=\"ico-core\" cx=\"15\" cy=\"20.5\" r=\"1.8\"></circle></svg> </span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "throne-angel": {
    classes: "t-throne fx-aura fx-glow2 fx-sweep fx-orbit fx-spark",
    emblemHtml: "<span class=\"disc\"></span><span class=\"beam\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"ring3\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"5\" rx=\"5\" ry=\"2\" class=\"ico-stroke\" stroke-width=\"2\"></ellipse><path class=\"ico-fill\" d=\"M13 13C8 9 2.4 9.2-.2 11.8c2.2 0 3.3.9 3.8 2-2-.6-3.5 0-4.4 1.1 2 .3 3.1 1.2 3.5 2.3C8.5 15 11.7 14.5 15 14.9Z\" opacity=\".9\"></path><path class=\"ico-fill\" d=\"M17 13c5-4 10.6-3.8 13.2-1.2-2.2 0-3.3.9-3.8 2 2-.6 3.5 0 4.4 1.1-2 .3-3.1 1.2-3.5 2.3C21.5 15 18.3 14.5 15 14.9Z\" opacity=\".9\"></path><circle cx=\"15\" cy=\"15.6\" r=\"4.4\" class=\"ico-stroke\" stroke-width=\"1.4\"></circle><circle cx=\"15\" cy=\"15.6\" r=\"1.7\" class=\"ico-core\"></circle><path class=\"ico-stroke\" d=\"M15 11.4v8.4M10.8 15.6h8.4M12 12.6l6 6M18 12.6l-6 6\" stroke-width=\".9\"></path><g class=\"ico-core\"><circle cx=\"15\" cy=\"11.7\" r=\".7\"></circle><circle cx=\"15\" cy=\"19.5\" r=\".7\"></circle><circle cx=\"11.1\" cy=\"15.6\" r=\".7\"></circle><circle cx=\"18.9\" cy=\"15.6\" r=\".7\"></circle></g></svg> </span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "wisdom-angel": {
    classes: "t-cherub fx-aura fx-glow2 fx-sweep fx-orbit fx-spark",
    emblemHtml: "<span class=\"disc\"></span><span class=\"beam\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"ring3\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><ellipse cx=\"15\" cy=\"4.8\" rx=\"4.6\" ry=\"1.8\" class=\"ico-stroke\" stroke-width=\"1.8\"></ellipse><path class=\"ico-fill\" d=\"M13.5 11C10.5 8.6 6.5 8.7 4.5 10.3c1.5.1 2.3.6 2.7 1.4-1.3-.4-2.3 0-3 .8 2.9-.2 6.3.6 9.3 1.5Z\" opacity=\".68\"></path><path class=\"ico-fill\" d=\"M16.5 11c3-2.4 7-2.3 9-.7-1.5.1-2.3.6-2.7 1.4 1.3-.4 2.3 0 3 .8-2.9-.2-6.3.6-9.3 1.5Z\" opacity=\".68\"></path><path class=\"ico-fill\" d=\"M13.2 14C8.6 10.6 3 10.8.4 13.2c2 0 3 .8 3.5 1.8-1.9-.5-3.2 0-4.1 1 1.9.3 2.9 1.1 3.3 2.1 2.9-2 6.2-2.6 9.6-2.2Z\"></path><path class=\"ico-fill\" d=\"M16.8 14c4.6-3.4 10.2-3.2 12.8-.8-2 0-3 .8-3.5 1.8 1.9-.5 3.2 0 4.1 1-1.9.3-2.9 1.1-3.3 2.1-2.9-2-6.2-2.6-9.6-2.2Z\"></path><path class=\"ico-deep\" d=\"M15 11.4l3 3.1-3 7-3-7Z\"></path><circle cx=\"15\" cy=\"14.6\" r=\"1\" fill=\"#fff\"></circle></svg> </span><span class=\"orb\" style=\"--c1:#bcd8ff\"></span><span class=\"orb\" style=\"--c1:#bcd8ff\"></span><span class=\"orb\" style=\"--c1:#bcd8ff\"></span><span class=\"orb\" style=\"--c1:#bcd8ff\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "seraph": {
    classes: "t-seraph fx-aura fx-glow2 fx-sweep fx-orbit fx-spark",
    emblemHtml: "<span class=\"disc\"></span><span class=\"beam\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"ring3\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><circle cx=\"15\" cy=\"5.5\" r=\"3\" class=\"ico-stroke\" stroke-width=\"2\" style=\"filter:drop-shadow(0 0 3px var(--glow))\"></circle><g class=\"ico-fill\"> <path d=\"M14 13.5C9 9.5 2.5 9.5.5 12.5c2 0 3 .7 3.6 1.7-2.2-.7-3.6-.1-4.4 1.3 2 .2 3 1 3.6 2-2.2-.6-3.2 0-3.8 1.4 2.6-.4 7.6-.6 14.4-1.4Z\"></path> <path d=\"M16 13.5c5-4 11.5-4 13.5-1-2 0-3 .7-3.6 1.7 2.2-.7 3.6-.1 4.4 1.3-2 .2-3 1-3.6 2 2.2-.6 3.2 0 3.8 1.4-2.6-.4-7.6-.6-14.4-1.4Z\"></path> <path d=\"M13 10.5C10 8 6 8 4 9.6c1.6.1 2.4.7 2.8 1.5-1.5-.5-2.6 0-3.3.9 3-.2 6.6.6 9.5 1.5Z\" opacity=\".8\"></path> <path d=\"M17 10.5c3-2.5 7-2.5 9-0.9-1.6.1-2.4.7-2.8 1.5 1.5-.5 2.6 0 3.3.9-3-.2-6.6.6-9.5 1.5Z\" opacity=\".8\"></path> </g><path class=\"ico-core\" d=\"M15 10l1.9 4.2-1.9 8.5-1.9-8.5Z\"></path></svg> </span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "imp": {
    classes: "t-demon fx-aura fx-float fx-glow fx-sweep fx-spark",
    emblemHtml: "<span class=\"disc\"></span><span class=\"ring\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><path class=\"ico-fill\" d=\"M9.5 6.5c-.3 3 .8 5.2 2.4 6.8C9.8 12 8.3 9.8 7.4 6.2c-1.2 1.8-1.6 4.6.6 7.4-2.6-.8-3.7-2.9-4.2-5-.7 3.3 1 7.4 5.6 8.2Z\"></path><path class=\"ico-fill\" d=\"M20.5 6.5c.3 3-.8 5.2-2.4 6.8 2.1-1.3 3.6-3.5 4.5-7.1 1.2 1.8 1.6 4.6-.6 7.4 2.6-.8 3.7-2.9 4.2-5 .7 3.3-1 7.4-5.6 8.2Z\"></path><circle class=\"ico-core\" cx=\"15\" cy=\"18.5\" r=\"5.2\"></circle><circle class=\"ico-deep\" cx=\"13\" cy=\"18\" r=\"1.1\"></circle><circle class=\"ico-deep\" cx=\"17\" cy=\"18\" r=\"1.1\"></circle><path class=\"ico-deep\" d=\"M12.6 21c1.4 1.2 3.4 1.2 4.8 0\" stroke=\"var(--c3)\" stroke-width=\"1.1\" fill=\"none\" stroke-linecap=\"round\"></path></svg> </span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "greater-demon": {
    classes: "t-greater t-overlord elite",
    emblemHtml: `
      <span class="crest eseal">
        <svg viewBox="0 0 44 50" focusable="false" aria-hidden="true">
          <defs>
            <linearGradient id="omchhOverlordGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#fff0c4"></stop><stop offset=".45" stop-color="#f3c155"></stop>
              <stop offset="1" stop-color="#a9681c"></stop>
            </linearGradient>
            <linearGradient id="omchhOverlordGoldEdge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#ffe9ad"></stop><stop offset=".5" stop-color="#e0a338"></stop>
              <stop offset="1" stop-color="#7d4a16"></stop>
            </linearGradient>
            <radialGradient id="omchhOverlordEnamel" cx="50%" cy="30%" r="75%">
              <stop offset="0" stop-color="#c63028"></stop><stop offset=".5" stop-color="#8a161a"></stop>
              <stop offset="1" stop-color="#440a10"></stop>
            </radialGradient>
            <radialGradient id="omchhOverlordGloss" cx="50%" cy="38%" r="55%">
              <stop offset="0" stop-color="#fff" stop-opacity=".7"></stop><stop offset="1" stop-color="#fff" stop-opacity="0"></stop>
            </radialGradient>
            <linearGradient id="omchhOverlordRuby" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ff8a78"></stop><stop offset="1" stop-color="#c2161c"></stop>
            </linearGradient>
            <clipPath id="omchhOverlordShield"><path d="M11 16 H33 Q33.6 24 33 29 Q31.8 38.5 22 44 Q12.2 38.5 11 29 Q10.4 24 11 16 Z"></path></clipPath>
          </defs>
          <g>
            <path d="M12 15 L13.4 6.5 L17.4 11 L22 4.5 L26.6 11 L30.6 6.5 L32 15 Z" fill="url(#omchhOverlordGold)" stroke="url(#omchhOverlordGoldEdge)" stroke-width=".6" stroke-linejoin="round"></path>
            <rect x="12" y="14.2" width="20" height="2.4" rx="1.2" fill="url(#omchhOverlordGold)" stroke="url(#omchhOverlordGoldEdge)" stroke-width=".4"></rect>
            <circle class="e-tw" cx="13.4" cy="6.5" r="1.5" fill="url(#omchhOverlordRuby)"></circle>
            <circle class="e-tw" cx="22" cy="4.5" r="1.8" fill="url(#omchhOverlordRuby)" style="animation-delay:.5s"></circle>
            <circle class="e-tw" cx="30.6" cy="6.5" r="1.5" fill="url(#omchhOverlordRuby)" style="animation-delay:1s"></circle>
          </g>
          <path d="M9.4 14.5 H34.6 Q35.3 24 34.6 29.6 Q33.2 39.8 22 46 Q10.8 39.8 9.4 29.6 Q8.7 24 9.4 14.5 Z" fill="url(#omchhOverlordGoldEdge)"></path>
          <path d="M11 16 H33 Q33.6 24 33 29 Q31.8 38.5 22 44 Q12.2 38.5 11 29 Q10.4 24 11 16 Z" fill="url(#omchhOverlordEnamel)"></path>
          <path d="M12.6 17.4 H31.4 Q31.9 24 31.4 28.4 Q30.4 36.4 22 41.6 Q13.6 36.4 12.6 28.4 Q12.1 24 12.6 17.4 Z" fill="none" stroke="url(#omchhOverlordGold)" stroke-width=".7" opacity=".65"></path>
          <ellipse class="e-gloss" cx="22" cy="22" rx="9" ry="5.5" fill="url(#omchhOverlordGloss)" clip-path="url(#omchhOverlordShield)"></ellipse>
          <g class="e-flame" clip-path="url(#omchhOverlordShield)">
            <path d="M22 23.5 C24.6 26.4 25.6 28.6 24.7 31.2 C24.2 32.7 22.9 33.4 23.1 35.1 C21.4 34.3 20.7 32.6 21.2 30.9 C20 31.6 19.6 32.7 20 34.2 C18.8 32.9 18.5 30.9 19.4 29.2 C20.3 27.4 21.7 26.2 22 23.5 Z" fill="url(#omchhOverlordGold)"></path>
            <path d="M22 27 C23.2 28.6 23.6 30 23 31.4 C22.6 32.4 21.8 32.8 22 33.8 C21 33.2 20.7 32.1 21 31 C20.4 31.8 20.6 30.4 21.2 29.4 C21.7 28.6 21.9 28 22 27 Z" fill="#fff0cf" opacity=".85"></path>
          </g>
        </svg>
      </span>
      <span class="ember"></span><span class="ember"></span><span class="ember"></span>`
  },
  "diablo": {
    classes: "t-envoy fx-aura fx-glow2 fx-sweep fx-orbit fx-spark",
    emblemHtml: "<span class=\"disc\"></span><span class=\"aurora\" style=\"opacity:.4\"></span><span class=\"beam\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><path class=\"ico-fill\" d=\"M15 4l9.5 5.5v11L15 26l-9.5-5.5v-11Z\" opacity=\".25\"></path><path class=\"ico-stroke\" d=\"M15 6.2 22 19h-14Z\" stroke-width=\"1.6\"></path><circle class=\"ico-core\" cx=\"15\" cy=\"15\" r=\"2.4\"></circle><circle class=\"ico-deep\" cx=\"15\" cy=\"15\" r=\"1\"></circle><path class=\"ico-fill\" d=\"M9 8.5c-.2 1.8.6 3 1.6 3.9-1.3-.8-2.3-2.1-2.9-4.1Z\"></path><path class=\"ico-fill\" d=\"M21 8.5c.2 1.8-.6 3-1.6 3.9 1.3-.8 2.3-2.1 2.9-4.1Z\"></path></svg> </span><span class=\"orb\" style=\"--c1:#ffcaa0\"></span><span class=\"orb\" style=\"--c1:#ffcaa0\"></span><span class=\"orb\" style=\"--c1:#ffcaa0\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "lucifer": {
    classes: "t-spirit fx-aura fx-glow2 fx-sweep fx-orbit fx-spark",
    emblemHtml: "<span class=\"disc\"></span><span class=\"aurora\" style=\"opacity:.5\"></span><span class=\"beam\"></span><span class=\"ring\"></span><span class=\"ring2\"></span><span class=\"ring3\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"> <path class=\"ico-core\" d=\"M14 13.5C9.5 9.5 3.5 9.6 1 12.4c2 0 3 .7 3.6 1.7-2-.6-3.4 0-4.2 1.3 2 .2 3 1 3.6 2-2-.6-3 0-3.6 1.4 2.5-.4 7-.6 13.6-1.3Z\" opacity=\".95\"></path> <path class=\"ico-fill\" d=\"M16 13.5c4.6-3.2 9.6-2.6 11.8 0-1.7-.8-3-.4-3.8.4 1.6.2 2.6 1 3 2.2-1.6-.7-2.8-.3-3.5.6 1.5.4 2.3 1.3 2.5 2.6-2.6-2-5.6-3-10-2.4Z\"></path> <path class=\"ico-deep\" d=\"M14 9c-2.5-2-6-2-8 0 1.5 0 2.3.5 2.7 1.2-1.3-.4-2.2 0-2.8.8 2.6-.2 5.6.5 8.1 1.4Z\"></path> <path class=\"ico-core\" d=\"M15 10l1.8 4-1.8 8.5-1.8-8.5Z\"></path> </svg> </span><span class=\"orb\" style=\"--c1:#e6b8ff\"></span><span class=\"orb\" style=\"--c1:#e6b8ff\"></span><span class=\"orb\" style=\"--c1:#e6b8ff\"></span><span class=\"orb\" style=\"--c1:#e6b8ff\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "saint-demon-king": {
    classes: "t-king fx-aura fx-glow2 fx-sweep fx-orbit fx-spark",
    emblemHtml: "<span class=\"aurora\"></span><span class=\"beam\"></span> <span class=\"king-rings\"><span class=\"kr kr1\"></span><span class=\"kr kr2\"></span><span class=\"kr kr3\"></span><span class=\"kr kr4\"></span></span> <span class=\"disc\"></span> <span class=\"crest\"> <svg viewBox=\"0 0 30 30\"> <path class=\"ico-fill\" d=\"M15 17c-4.4-3.3-9.6-3.2-12.4-1 2 0 3 .7 3.6 1.6C4.2 18 3.2 18.5 2.6 19.6c2 .2 3 .9 3.5 1.8C3.8 20.4 2.8 21 2.2 22.2c3.6-.5 9.4-.7 12.8-1.3Z\" opacity=\".95\"></path> <path class=\"ico-fill\" d=\"M15 17c4.4-3.3 9.6-3.2 12.4-1-2 0-3 .7-3.6 1.6.6.4 1.6.9 2.2 2-2-.2-3 .9-3.5 1.8 2.3-1.2 3.3-.6 3.9.6-3.6-.5-9.4-.7-12.8-1.3Z\" opacity=\".95\"></path> <path class=\"ico-core\" d=\"M8 14.5l2.6 3L15 8.5l4.4 9 2.6-3-1.3 7H9.3Z\"></path> <circle cx=\"8\" cy=\"13.5\" r=\"1.5\" class=\"ico-deep\"></circle><circle cx=\"15\" cy=\"7.5\" r=\"1.7\" class=\"ico-deep\"></circle><circle cx=\"22\" cy=\"13.5\" r=\"1.5\" class=\"ico-deep\"></circle> <rect x=\"9.5\" y=\"21\" width=\"11\" height=\"1.6\" rx=\".8\" class=\"ico-fill\"></rect> </svg> </span> <span class=\"orb\"></span><span class=\"orb\"></span><span class=\"orb\"></span><span class=\"orb\"></span> <span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span><span class=\"spk\"></span>"
  },
  "other": {
    classes: "t-other fx-aura fx-float",
    emblemHtml: "<span class=\"disc\"></span><span class=\"crest\"> <svg viewBox=\"0 0 30 30\"><path class=\"ico-stroke\" d=\"M15 4l8 3v7c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V7Z\" stroke-width=\"1.8\"></path><circle class=\"ico-fill\" cx=\"15\" cy=\"13\" r=\"2.2\"></circle><path class=\"ico-fill\" d=\"M11 20c.6-2.4 2.2-3.6 4-3.6s3.4 1.2 4 3.6Z\"></path></svg> </span>"
  }
};

function shouldUseStaticRankBadge(rankElement: Element): boolean {
  const insideHeader = !!rankElement.closest("#chh-lg-header");
  return !insideHeader && document.documentElement.dataset.omchhPerformance === "reduced";
}

function enhanceStaticRankBadge(rankElement: HTMLElement, scope: EnhancementScope, identity: RankBadgeIdentity, displayLabel: string): void {
  scope.setAttr(rankElement, "data-omchh-rank-badge", "static");
  scope.addClass(rankElement, "omchh-rank-host");
  scope.setAttr(rankElement, "aria-label", displayLabel);
  scope.setAttr(rankElement, "title", displayLabel);

  const existingBadge = rankElement.querySelector<HTMLElement>(":scope > .omchh-rank-badge");
  if (existingBadge) {
    existingBadge.className = "omchh-rank-badge omchh-rank-badge--static";
    existingBadge.textContent = displayLabel;
    existingBadge.dataset.omchhRank = identity.rank;
    existingBadge.dataset.omchhRankFamily = identity.family;
    existingBadge.dataset.omchhRankTier = identity.tier;
    existingBadge.dataset.omchhRankEffect = "0";
    return;
  }

  const badge = document.createElement("span");
  badge.className = "omchh-rank-badge omchh-rank-badge--static";
  badge.dataset.omchhRank = identity.rank;
  badge.dataset.omchhRankFamily = identity.family;
  badge.dataset.omchhRankTier = identity.tier;
  badge.dataset.omchhRankEffect = "0";
  badge.textContent = displayLabel;
  scope.replaceChildren(rankElement, badge);
}

export function enhanceRankBadge(rankElement: Element, scope: EnhancementScope, identity: RankBadgeIdentity, rawLabel: string): void {
  if (!(rankElement instanceof HTMLElement)) return;

  const normalizedLabel = normalizeRankLabel(rawLabel);
  if (!normalizedLabel) return;
  const displayLabel = rawLabel.replace(/\s+/g, " ").trim();
  if (shouldUseStaticRankBadge(rankElement)) {
    enhanceStaticRankBadge(rankElement, scope, identity, displayLabel);
    return;
  }
  const definition = RANK_BADGE_DEFINITIONS[identity.rank] ?? RANK_BADGE_DEFINITIONS.other;

  const existingBadge = rankElement.querySelector<HTMLElement>(":scope > .omchh-rank-badge");
  if (existingBadge) {
    rankElement.dataset.omchhRankBadge = "heraldic";
    rankElement.classList.add("omchh-rank-host");
    rankElement.setAttribute("aria-label", displayLabel);
    rankElement.setAttribute("title", displayLabel);
    const existingName = existingBadge.querySelector<HTMLElement>(":scope > .bname");
    if (existingName) existingName.textContent = displayLabel;
    existingBadge.className = `omchh-rank-badge ${definition.classes}`;
    existingBadge.dataset.omchhRank = identity.rank;
    existingBadge.dataset.omchhRankFamily = identity.family;
    existingBadge.dataset.omchhRankTier = identity.tier;
    existingBadge.dataset.omchhRankEffect = identity.effect;
    return;
  }

  scope.setAttr(rankElement, "data-omchh-rank-badge", "heraldic");
  scope.addClass(rankElement, "omchh-rank-host");
  scope.setAttr(rankElement, "aria-label", displayLabel);
  scope.setAttr(rankElement, "title", displayLabel);

  const badge = document.createElement("span");
  badge.className = `omchh-rank-badge ${definition.classes}`;
  badge.dataset.omchhRank = identity.rank;
  badge.dataset.omchhRankFamily = identity.family;
  badge.dataset.omchhRankTier = identity.tier;
  badge.dataset.omchhRankEffect = identity.effect;

  const emblem = document.createElement("span");
  emblem.className = "emblem";
  emblem.setAttribute("aria-hidden", "true");
  emblem.innerHTML = definition.emblemHtml;

  emblem.querySelectorAll<HTMLElement>(".orb").forEach((orb, index) => {
    orb.style.setProperty("--omchh-orbit-delay", `${-1.1 * index}s`);
  });

  const sparkPositions = ["20%", "42%", "62%", "80%"];
  const sparkDurations = ["2.4s", "2.9s", "2.2s", "3.1s"];
  const sparkDelays = ["0s", "0.5s", "1s", "1.5s"];
  emblem.querySelectorAll<HTMLElement>(".spk").forEach((spark, index) => {
    const sparkIndex = index % sparkPositions.length;
    spark.style.setProperty("--omchh-spark-left", sparkPositions[sparkIndex]);
    spark.style.setProperty("--omchh-spark-duration", sparkDurations[sparkIndex]);
    spark.style.setProperty("--omchh-spark-delay", sparkDelays[sparkIndex]);
  });

  const emberPositions = ["30%", "50%", "68%"];
  const emberDurations = ["2.8s", "3.3s", "2.6s"];
  const emberDelays = ["0s", "0.7s", "1.4s"];
  emblem.querySelectorAll<HTMLElement>(".ember").forEach((ember, index) => {
    const emberIndex = index % emberPositions.length;
    ember.style.setProperty("--omchh-ember-left", emberPositions[emberIndex]);
    ember.style.setProperty("--omchh-ember-duration", emberDurations[emberIndex]);
    ember.style.setProperty("--omchh-ember-delay", emberDelays[emberIndex]);
  });

  const name = document.createElement("span");
  name.className = "bname";
  name.textContent = displayLabel;

  badge.append(emblem, name);
  scope.replaceChildren(rankElement, badge);
}

function rankIdentityFromDataset(element: Element): RankBadgeIdentity | null {
  if (!(element instanceof HTMLElement)) return null;
  const { omchhRank, omchhRankFamily, omchhRankTier, omchhRankEffect } = element.dataset;
  if (!omchhRank || !omchhRankFamily || !omchhRankTier) return null;
  if (omchhRankEffect !== "0" && omchhRankEffect !== "1" && omchhRankEffect !== "2" && omchhRankEffect !== "3") return null;
  return {
    rank: omchhRank,
    family: omchhRankFamily as RankBadgeIdentity["family"],
    tier: omchhRankTier,
    effect: omchhRankEffect
  };
}

export function enhanceRankEmblems(root: ParentNode, scope: EnhancementScope, dirtyRoots?: DirtyRoot[]): void {
  const roots = dirtyRoots?.length ? dirtyRoots.map((dirtyRoot) => dirtyRoot.element) : [root];
  roots.forEach((candidateRoot) => {
    const rankElements = candidateRoot instanceof Element && candidateRoot.matches(".omchh-post-author-rank[data-omchh-rank]")
      ? [candidateRoot]
      : Array.from(candidateRoot.querySelectorAll?.(".omchh-post-author-rank[data-omchh-rank]") ?? []);
    rankElements.forEach((rankElement) => {
      const identity = rankIdentityFromDataset(rankElement);
      if (!identity) return;
      const rawLabel = rankElement.getAttribute("aria-label") ?? rankElement.textContent ?? "";
      enhanceRankBadge(rankElement, scope, identity, rawLabel);
    });
  });
}

// Stat curve charts inside Markdown posts: ![Caption](curve:skill-speed) draws that stat's rating curve from 0
// to 800, and ![Caption](curve:skill-speed,skill-recovery) puts several on one chart (lib/statCharts.ts).
// An unknown stat fails the build.
import { defineMdastPlugin } from 'satteri';
import { statChartHtml } from './statCharts';

const ref = /^curve:(.+)$/;

/** Sätteri plugin: swaps each curve reference for its chart. */
export function markdownCharts() {
  return defineMdastPlugin({
    name: 'invokers-charts',
    image(node, ctx) {
      const m = ref.exec(node.url);
      if (!m) return;
      ctx.replaceNode(node, { type: 'html', value: statChartHtml(m[1].split(',').map((k) => k.trim()), node.alt ?? '') });
    },
  });
}

/* ============================================================
   《希望》 · 未来感背景引擎  fx.js
   ------------------------------------------------------------
   星座节点场：节点缓慢漂移 + 邻近连线（「树成林 · 社群」隐喻）
   · 章节情绪：按 [data-mood] 切换强度 / 色温 / 速度（每章独立情绪）
   · 鼠标视差：极轻位移，留住"大气克制"
   · 性能优先：节点限量 · DPR 封顶 1.5 · 隐藏标签页暂停 · 尊重 reduced-motion
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("fx");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d", { alpha: true });
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  var W = 0, H = 0, nodes = [], count = 0, linkDist = 0, raf = 0;

  /* 鼠标视差（缓动）；live=首次移动后才启用追光扰动 */
  var ptr = { x: .5, y: .5, tx: .5, ty: .5, live: false };

  /* 追光扰动（与取景器光标 cursor.js 呼应：光标=追光，照进星座）
     旋钮：CUR_R 影响半径(css px) / CUR_PUSH 最大推开(css px) / CUR_LIT 连线提亮倍率 */
  var CUR_R = 150, CUR_PUSH = 20, CUR_LIT = 1.6;

  /* 章节情绪——目标值，由 IntersectionObserver 设定；每帧向目标缓动 */
  var MOODS = {
    calm:  { i: .34, cold: 0,  rise: 0,    speed: .7 },   // 序 · 标题：暖焰静默
    cold:  { i: .12, cold: 1,  rise: 0,    speed: .35 },  // 绝望：冷钢稀疏
    rise:  { i: .92, cold: 0,  rise: 0,    speed: 1.7 },  // 但 · 反转 · 泉涌：能量汇聚
    works: { i: .56, cold: 0,  rise: 0,    speed: .95 },  // 作品轮：密集连接
    hope:  { i: .74, cold: 0,  rise: .85,  speed: .8 }    // 收尾：余烬上升
  };
  var cur = { i: .34, cold: 0, rise: 0, speed: .7 };
  var tgt = MOODS.calm;

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* 色：朱砂红 (217,52,28) ↔ 冷钢 (110,150,195) 随 cold 插值（暖端与主色 --ac 一致）*/
  function nodeColor(accent, alpha, cold) {
    if (accent) {
      var r = lerp(217, 110, cold), g = lerp(52, 150, cold), b = lerp(28, 195, cold);
      return "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + "," + alpha + ")";
    }
    var v = lerp(255, 150, cold * .5);
    return "rgba(" + (v | 0) + "," + (v | 0) + "," + (v | 0) + "," + alpha + ")";
  }

  function build() {
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - .5) * .12 * DPR,
        vy: (Math.random() - .5) * .12 * DPR,
        r: (Math.random() * 1.3 + .55) * DPR,
        accent: Math.random() < .22,
        ox: 0, oy: 0   // 追光避让位移（弹性缓动）
      });
    }
  }

  function resize() {
    W = canvas.width = Math.floor(innerWidth * DPR);
    H = canvas.height = Math.floor(innerHeight * DPR);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    // 节点数随面积，封顶 110；连线半径随短边
    count = Math.max(36, Math.min(110, Math.round(innerWidth * innerHeight / 15000)));
    linkDist = Math.min(W, H) * .15;
    build();
  }

  function frame() {
    raf = requestAnimationFrame(frame);

    // 缓动情绪与指针
    cur.i     += (tgt.i - cur.i) * .035;
    cur.cold  += (tgt.cold - cur.cold) * .035;
    cur.rise  += (tgt.rise - cur.rise) * .035;
    cur.speed += (tgt.speed - cur.speed) * .035;
    ptr.x += (ptr.tx - ptr.x) * .05;
    ptr.y += (ptr.ty - ptr.y) * .05;

    var px = (ptr.x - .5) * 46 * DPR;
    var py = (ptr.y - .5) * 46 * DPR;
    var pxc = ptr.x * W, pyc = ptr.y * H;        // 光标画布坐标
    var R = CUR_R * DPR, R2 = R * R;

    ctx.clearRect(0, 0, W, H);

    var i, n;
    // 漂移 + 追光避让 + 节点
    for (i = 0; i < count; i++) {
      n = nodes[i];
      n.x += n.vx * cur.speed;
      n.y += (n.vy - cur.rise * .14 * DPR) * cur.speed;   // rise → 整体上升（余烬）
      if (n.x < -60) n.x = W + 60; else if (n.x > W + 60) n.x = -60;
      if (n.y < -60) n.y = H + 60; else if (n.y > H + 60) n.y = -60;

      // 光标推开邻近节点（位移量缓动 → 推开/回弹都柔）
      var ox = 0, oy = 0;
      if (ptr.live) {
        var cdx = n.x + px - pxc, cdy = n.y + py - pyc;
        var cd2 = cdx * cdx + cdy * cdy;
        if (cd2 < R2 && cd2 > .01) {
          var cd = Math.sqrt(cd2);
          var f = 1 - cd / R;
          var k = f * f * CUR_PUSH * DPR / cd;
          ox = cdx * k; oy = cdy * k;
        }
      }
      n.ox += (ox - n.ox) * .12;
      n.oy += (oy - n.oy) * .12;
      n.dx = n.x + px + n.ox;
      n.dy = n.y + py + n.oy;

      ctx.beginPath();
      ctx.arc(n.dx, n.dy, n.r, 0, 6.2832);
      var a = n.accent ? (.15 + .5 * cur.i) : (.05 + .17 * cur.i);
      ctx.fillStyle = nodeColor(n.accent, a, cur.cold);
      ctx.fill();
    }

    // 连线（O(n²)，count≤110 → 安全）；光标邻近连线提亮＝「追光照亮星座」
    var ld2 = linkDist * linkDist;
    var RL2 = R2 * 2.25;   // 提亮半径 = 1.5R
    ctx.lineWidth = .6 * DPR;
    for (i = 0; i < count; i++) {
      var a1 = nodes[i];
      for (var j = i + 1; j < count; j++) {
        var b1 = nodes[j];
        var ddx = a1.x - b1.x, ddy = a1.y - b1.y;
        var d2 = ddx * ddx + ddy * ddy;
        if (d2 < ld2) {
          var t = 1 - Math.sqrt(d2) / linkDist;
          var accent = a1.accent || b1.accent;
          var o = t * (.07 + .2 * cur.i) * (accent ? 1 : .55);
          if (ptr.live) {
            var mx2 = (a1.dx + b1.dx) * .5 - pxc, my2 = (a1.dy + b1.dy) * .5 - pyc;
            var md2 = mx2 * mx2 + my2 * my2;
            if (md2 < RL2) o *= 1 + CUR_LIT * (1 - md2 / RL2);
          }
          ctx.strokeStyle = nodeColor(accent, o, cur.cold);
          ctx.beginPath();
          ctx.moveTo(a1.dx, a1.dy);
          ctx.lineTo(b1.dx, b1.dy);
          ctx.stroke();
        }
      }
    }
  }

  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function stop()  { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  /* ---------- 章节情绪：观察 [data-mood] ---------- */
  function bindMoods() {
    var secs = document.querySelectorAll("[data-mood]");
    if (!secs.length) return;
    var io = new IntersectionObserver(function (entries) {
      // 取最居中可见的那一节作为当前情绪
      var best = null, bestRatio = 0;
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio; best = e.target;
        }
      });
      if (best) {
        var m = MOODS[best.dataset.mood];
        if (m) tgt = m;
      }
    }, { threshold: [.25, .5, .75], rootMargin: "-20% 0px -20% 0px" });
    secs.forEach(function (s) { io.observe(s); });
  }

  /* ---------- 启动 ---------- */
  resize();
  bindMoods();

  if (reduced) {
    // 降级：画一帧静态稀疏星点，不进 rAF
    cur = { i: .3, cold: .2, rise: 0, speed: 0 };
    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < count; k++) {
      var nn = nodes[k];
      ctx.beginPath(); ctx.arc(nn.x, nn.y, nn.r, 0, 6.2832);
      ctx.fillStyle = nodeColor(nn.accent, nn.accent ? .35 : .1, .2); ctx.fill();
    }
    return;
  }

  start();

  addEventListener("resize", function () {
    // 防抖
    clearTimeout(resize._t);
    resize._t = setTimeout(resize, 200);
  }, { passive: true });

  addEventListener("pointermove", function (e) {
    if (!ptr.live) {                       // 首次移动：指针直接就位，避免追光从屏心扫过
      ptr.live = true;
      ptr.x = e.clientX / innerWidth;
      ptr.y = e.clientY / innerHeight;
    }
    ptr.tx = e.clientX / innerWidth;
    ptr.ty = e.clientY / innerHeight;
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  // 暴露给 main.js（可选：让滚动/计数节点联动强度）
  window.__fx = {
    pulse: function (v) { tgt = { i: v, cold: cur.cold, rise: cur.rise, speed: cur.speed }; }
  };
})();

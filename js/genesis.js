/* ============================================================
   《希望》 · 文明诞生 genesis.js（#32）
   ------------------------------------------------------------
   结尾世界观段（接在「无限希望」之后）：
   黑暗中一颗火种亮起 → 十个 → 一百、五百个 → 灯火流动汇聚，
   落进中国版图（**全部领土**：大陆+台湾+海南+南海诸岛 273 个
   岛屿灯点，数据 js/cnmap.js，阿里 DataV 国界抽稀），
   各省星星点点连接成社群网络。
   **不是科技风，是文明诞生感**：暖白/朱砂灯火、黑暗中点灯的
   庄重节奏、细弱星座连线——延续全站 fx 星座美学。
   ------------------------------------------------------------
   驱动：sticky + 自算 progress（无 ScrollTrigger，免疫 refresh 坑），
   位置=纯函数 f(progress) → 任意快滚/倒滚完全可逆，无状态机。
   #36：灯火散布后先「描线勾勒」整个国界轮廓（朱砂笔锋+光点笔尖，
        大陆/台湾/海南/港同步走笔），灯火再飞落，落位瞬间小爆闪；
        轮廓终态退为衬底细线。DPR 提至 2 + sprite 实心亮核（修模糊）。
   降级：reduced-motion 直接呈现终态（轮廓+满图灯火+连线）。
   旋钮：SECTION_VH 段高 / PHASE 阶段断点 / N_LAND 大陆采样点数 /
        LINK_D 连线距离 / 城市表 CITIES / 颜色在 sprite() 与 drawOutline()。
   ============================================================ */
(function () {
  "use strict";

  var sec = document.getElementById("genesis");
  var cv = sec && sec.querySelector(".genesis__cv");
  if (!sec || !cv || !cv.getContext || !window.CN_MAP) return;
  var ctx = cv.getContext("2d");
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // DPR 2：原 1.5 在 3x 手机=半分辨率渲染，整段发糊（#36 清晰度主因之一）
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- 旋钮 ---------- */
  var N_LAND = 470;          // 大陆/大岛内部采样灯点数（+273 岛屿点 ≈ 750）
  var LINK_D = 46;           // 连线距离（css px）
  var LINK_MAX = 4;          // 每点最多连线数
  // 阶段断点：burst 后先描线（trace），灯火再飞落（fly，与描线尾段重叠），落满才结网
  var PHASE = { one: .12, ten: .24, burst: .42, trace0: .44, trace1: .66, fly0: .58, fly1: .88 };
  var CITIES = [             // 亮核城市（朱砂）lng,lat
    [116.4,39.9],[121.5,31.2],[113.3,23.1],[114.05,22.55],[104.1,30.7],
    [106.55,29.56],[114.3,30.6],[108.9,34.3],[120.15,30.27],[118.8,32.06],
    [113.65,34.75],[113,28.2],[123.4,41.8],[126.6,45.75],[87.6,43.8],
    [91.1,29.65],[102.7,25.05],[103.8,36.06],[121.5,25.04],[114.17,22.32]
  ];

  /* ---------- 简化 Albers 投影（标准纬线 25/47，中央经线 105） ---------- */
  var RAD = Math.PI / 180;
  var f1 = 25 * RAD, f2 = 47 * RAD, f0 = 36 * RAD, l0 = 105 * RAD;
  var n = (Math.sin(f1) + Math.sin(f2)) / 2;
  var C = Math.cos(f1) * Math.cos(f1) + 2 * n * Math.sin(f1);
  var r0 = Math.sqrt(C - 2 * n * Math.sin(f0)) / n;
  function proj(lng, lat) {
    var rho = Math.sqrt(C - 2 * n * Math.sin(lat * RAD)) / n;
    var th = n * (lng * RAD - l0);
    // y 取负翻转：Albers 北向上 ↔ canvas y 向下（不翻则版图上下颠倒，实测踩过）
    return [rho * Math.sin(th), -(r0 - rho * Math.cos(th))];
  }

  /* ---------- 版图点阵（init 一次；resize 重算布局映射不重生粒子） ---------- */
  var pts = [];      // {tx,ty 地图位 | sx,sy 散布位 | birth | core | isle}
  var pairs = [];    // 预计算连线 [i,j,d]
  var W = 0, H = 0, fitted = false;

  // 投影所有数据 → bbox 归一
  var rawRings = CN_MAP.rings.map(function (r) { return r.map(function (p) { return proj(p[0], p[1]); }); });
  var rawIsles = CN_MAP.isles.map(function (p) { return proj(p[0], p[1]); });
  var rawCities = CITIES.map(function (p) { return proj(p[0], p[1]); });
  var bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  rawRings.forEach(function (r) { r.forEach(function (p) {
    if (p[0] < bb.x0) bb.x0 = p[0]; if (p[0] > bb.x1) bb.x1 = p[0];
    if (p[1] < bb.y0) bb.y0 = p[1]; if (p[1] > bb.y1) bb.y1 = p[1];
  }); });
  rawIsles.forEach(function (p) {
    if (p[0] < bb.x0) bb.x0 = p[0]; if (p[0] > bb.x1) bb.x1 = p[0];
    if (p[1] < bb.y0) bb.y0 = p[1]; if (p[1] > bb.y1) bb.y1 = p[1];
  });

  function buildPoints() {
    // 离屏 fill 大轮廓 → 网格采样内部点
    var ow = 720, oh = 720;
    var sc = Math.min(ow / (bb.x1 - bb.x0), oh / (bb.y1 - bb.y0));
    var off = document.createElement("canvas");
    off.width = ow; off.height = oh;
    var oc = off.getContext("2d", { willReadFrequently: true });
    oc.fillStyle = "#fff";
    rawRings.forEach(function (r) {
      oc.beginPath();
      r.forEach(function (p, i) {
        var x = (p[0] - bb.x0) * sc, y = (p[1] - bb.y0) * sc;
        i ? oc.lineTo(x, y) : oc.moveTo(x, y);
      });
      oc.closePath(); oc.fill();
    });
    var img = oc.getImageData(0, 0, ow, oh).data;

    var landUV = [];
    var step = 13;                          // 自适应：先粗采→按比例缩放 step 逼近 N_LAND
    for (var pass = 0; pass < 3; pass++) {
      landUV.length = 0;
      for (var gy = step / 2; gy < oh; gy += step)
        for (var gx = step / 2; gx < ow; gx += step) {
          var jx = gx + (Math.random() - .5) * step * .55;
          var jy = gy + (Math.random() - .5) * step * .55;
          var px = Math.max(0, Math.min(ow - 1, Math.round(jx)));
          var py = Math.max(0, Math.min(oh - 1, Math.round(jy)));
          if (img[(py * ow + px) * 4 + 3] > 100) landUV.push([jx / sc + bb.x0, jy / sc + bb.y0]);
        }
      if (Math.abs(landUV.length - N_LAND) / N_LAND < .12) break;
      step = step * Math.sqrt(landUV.length / N_LAND);
    }

    // 岛屿点（全保留=全部领土的星星点点）
    var all = landUV.map(function (p) { return { u: p[0], v: p[1], isle: false }; })
      .concat(rawIsles.map(function (p) { return { u: p[0], v: p[1], isle: true }; }));

    // 城市亮核：找最近的陆地点升级
    rawCities.forEach(function (c) {
      var best = -1, bd = 1e9;
      for (var i = 0; i < all.length; i++) {
        if (all[i].isle) continue;
        var dx = all[i].u - c[0], dy = all[i].v - c[1];
        var d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) all[best].core = true;
    });

    // 出生序：洗牌（核心城市优先早生 → 网络从枢纽长出）
    for (var k = all.length - 1; k > 0; k--) {
      var r = Math.floor(Math.random() * (k + 1));
      var tmp = all[k]; all[k] = all[r]; all[r] = tmp;
    }
    all.sort(function (a, b) { return (a.core ? 0 : 1) - (b.core ? 0 : 1) || 0; });

    pts = all.map(function (p, i) {
      var t = i / all.length;
      // 散布位：围绕屏心的伪随机云（出生时从父点弹出 → 这里直接给环状散布）
      var ang = Math.random() * 6.2832;
      var rad = .06 + Math.pow(Math.random(), .7) * .46;
      return {
        u: p.u, v: p.v, isle: p.isle, core: !!p.core,
        birth: t,
        sa: ang, sr: rad,
        tw: Math.random() * 6.2832          // 闪烁相位
      };
    });
  }
  buildPoints();

  /* ---------- 布局映射（resize 时重算） ---------- */
  var oRings = [];   // 轮廓描线用：屏幕坐标环 {pts, cum 累计弧长, total}
  function layout() {
    W = cv.width = Math.floor(cv.clientWidth * DPR);
    H = cv.height = Math.floor(cv.clientHeight * DPR);
    // 版图 fit：留边 12%，垂直略上移给文案空间
    var pad = .12;
    var sc = Math.min(W * (1 - pad * 2) / (bb.x1 - bb.x0), H * (1 - pad * 2) / (bb.y1 - bb.y0));
    var ox = (W - (bb.x1 - bb.x0) * sc) / 2;
    var oy = (H - (bb.y1 - bb.y0) * sc) / 2 - H * .02;
    // 国界轮廓 → 屏幕坐标 + 弧长表（描线按弧长比例走笔，各环同步收笔）
    oRings = rawRings.map(function (r) {
      var sp = r.map(function (q) { return [ox + (q[0] - bb.x0) * sc, oy + (q[1] - bb.y0) * sc]; });
      sp.push([sp[0][0], sp[0][1]]);             // 闭合
      var cum = [0], tot = 0;
      for (var ci = 1; ci < sp.length; ci++) {
        var dx0 = sp[ci][0] - sp[ci - 1][0], dy0 = sp[ci][1] - sp[ci - 1][1];
        tot += Math.sqrt(dx0 * dx0 + dy0 * dy0);
        cum.push(tot);
      }
      return { pts: sp, cum: cum, total: tot };
    });
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.tx = ox + (p.u - bb.x0) * sc;
      p.ty = oy + (p.v - bb.y0) * sc;
      p.sx = W / 2 + Math.cos(p.sa) * p.sr * Math.min(W, H) * 1.1;
      p.sy = H / 2 + Math.sin(p.sa) * p.sr * Math.min(W, H) * .9;
    }
    // 预计算连线（地图终态、陆地点间）
    pairs.length = 0;
    var LD = LINK_D * DPR, LD2 = LD * LD;
    var cnt = new Array(pts.length).fill(0);
    for (var a = 0; a < pts.length; a++) {
      if (pts[a].isle) continue;
      for (var b = a + 1; b < pts.length; b++) {
        if (cnt[a] >= LINK_MAX) break;
        if (pts[b].isle || cnt[b] >= LINK_MAX) continue;
        var dx = pts[a].tx - pts[b].tx, dy = pts[a].ty - pts[b].ty;
        var d2 = dx * dx + dy * dy;
        if (d2 < LD2) { pairs.push([a, b, Math.sqrt(d2) / LD]); cnt[a]++; cnt[b]++; }
      }
    }
  }

  /* ---------- 灯火 sprite（辉光预渲染，比 shadowBlur 快一个量级） ----------
     #36：加「实心亮核」——原渐变从圆心立刻衰减，灯点通体柔雾观感发虚；
     现在核心段保持全亮（灯丝），外圈才是辉光，点变"亮"而非"糊"。 */
  function sprite(core) {
    var s = document.createElement("canvas");
    var R = (core ? 26 : 15) * DPR;
    s.width = s.height = R * 2;
    var g = s.getContext("2d");
    var grad = g.createRadialGradient(R, R, 0, R, R, R);
    if (core) {
      grad.addColorStop(0, "rgba(255,246,238,1)");
      grad.addColorStop(.16, "rgba(255,236,225,1)");
      grad.addColorStop(.32, "rgba(217,52,28,.85)");
      grad.addColorStop(1, "rgba(217,52,28,0)");
    } else {
      grad.addColorStop(0, "rgba(255,252,247,1)");
      grad.addColorStop(.2, "rgba(255,246,236,.95)");
      grad.addColorStop(.42, "rgba(255,214,190,.32)");
      grad.addColorStop(1, "rgba(255,180,150,0)");
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, R * 2, R * 2);
    return s;
  }
  var SPR = sprite(false), SPRC = sprite(true);

  /* ---------- 阶段函数（纯函数 · 可逆） ---------- */
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }

  /* ---------- 国界描线（#36：先勾勒疆界，灯火再落上去） ----------
     按弧长画 [from,to] 区间（端点段内插值），返回笔尖坐标。 */
  function strokePartial(ring, from, to) {
    if (to <= 0 || to <= from) return null;
    if (from < 0) from = 0;
    var sp = ring.pts, cum = ring.cum, last = null, begun = false;
    ctx.beginPath();
    for (var i = 1; i < sp.length; i++) {
      if (cum[i] < from) continue;
      var seg = cum[i] - cum[i - 1] || 1;
      if (!begun) {
        var f0 = (from - cum[i - 1]) / seg;
        ctx.moveTo(sp[i - 1][0] + (sp[i][0] - sp[i - 1][0]) * f0,
                   sp[i - 1][1] + (sp[i][1] - sp[i - 1][1]) * f0);
        begun = true;
      }
      if (cum[i] >= to) {
        var f1 = (to - cum[i - 1]) / seg;
        last = [sp[i - 1][0] + (sp[i][0] - sp[i - 1][0]) * f1,
                sp[i - 1][1] + (sp[i][1] - sp[i - 1][1]) * f1];
        ctx.lineTo(last[0], last[1]);
        break;
      }
      ctx.lineTo(sp[i][0], sp[i][1]);
      last = sp[i];
    }
    if (begun) ctx.stroke();
    return last;
  }
  function drawOutline(p) {
    var tT = ease((p - PHASE.trace0) / (PHASE.trace1 - PHASE.trace0));
    if (tT <= 0) return;
    var settle = ease((p - PHASE.fly1) / .1);          // 灯火落满后，轮廓退为衬底
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (var ri = 0; ri < oRings.length; ri++) {
      var ring = oRings[ri];
      var target = ring.total * tT;
      // 已描出的主线（朱砂，描线期亮、终态细淡衬底）
      ctx.strokeStyle = "rgba(228,104,66," + (.62 - .36 * settle).toFixed(3) + ")";
      ctx.lineWidth = (1.2 - .3 * settle) * DPR;
      var head = strokePartial(ring, 0, target);
      if (tT < 1) {
        // 笔锋：最近一段更亮 + 笔尖光点（走笔的"火"）
        var tail = Math.min(target, ring.total * .05 + 30 * DPR);
        ctx.strokeStyle = "rgba(255,228,206," + (.85 * (1 - tT * .25)).toFixed(3) + ")";
        ctx.lineWidth = 1.7 * DPR;
        strokePartial(ring, target - tail, target);
        if (head) {
          var hR = 8 * DPR;
          ctx.drawImage(SPR, head[0] - hR, head[1] - hR, hR * 2, hR * 2);
        }
      }
    }
    ctx.restore();
  }
  // 各点在 progress p 下的可见量与位置
  function alive(p, birth) {
    // 出生推进：one 阶段只有 0 号；ten 阶段前 10 个；burst 阶段指数点亮全部
    if (birth === 0) return ease(p / .04);
    var tenT = 10 / pts.length;
    if (birth < tenT) return ease((p - PHASE.one) / (PHASE.ten - PHASE.one) * (tenT / birth) * .35);
    return ease((p - PHASE.ten) / (PHASE.burst - PHASE.ten) - (birth - tenT) * 1.1);
  }

  var time = 0;
  var brandEl = sec.querySelector(".genesis__brand");
  var dimF = 1;            // #38 回扣期灯火退后系数（brand 浮现时全图微暗衬底）
  function render(p) {
    ctx.clearRect(0, 0, W, H);
    time += .016;
    var flyT = ease((p - PHASE.fly0) / (PHASE.fly1 - PHASE.fly0));    // 散布→地图
    var netT = ease((p - PHASE.fly1) / (1 - PHASE.fly1));             // 连线/呼吸
    // #38 回扣（#47b 时序分离版）：灯火先退成余烬微光（.88→.93 压暗到 22%），
    // 名字随后才浮现（.915 起）——白字不再与白灯火黏连，可读性与层次都干净
    var dimT = ease((p - .88) / .05);
    var brandT = ease((p - .915) / .06);
    dimF = 1 - .78 * dimT;
    if (brandEl) {
      brandEl.style.opacity = brandT.toFixed(3);
      brandEl.style.transform = "translate(-50%,-50%) translateY(" + (14 * (1 - brandT)).toFixed(1) +
                                "px) scale(" + (.97 + .03 * brandT).toFixed(4) + ")";
    }

    // 国界描线（最底层：先勾出疆界，灯火落在它上面）
    drawOutline(p);

    // 连线（地图成形后）
    if (netT > .01) {
      ctx.lineWidth = .7 * DPR;
      for (var li = 0; li < pairs.length; li++) {
        var pr = pairs[li];
        var o = (1 - pr[2]) * .3 * netT * dimF;
        ctx.strokeStyle = "rgba(217,72,40," + o + ")";
        ctx.beginPath();
        // 用终位 tx/ty：连线期(netT>0)灯点必已落位，读 pt.x 会在瞬移滚动后
        // 残留上一帧散布位坐标 → 满屏乱线一帧（实测踩中）
        ctx.moveTo(pts[pr[0]].tx, pts[pr[0]].ty);
        ctx.lineTo(pts[pr[1]].tx, pts[pr[1]].ty);
        ctx.stroke();
      }
    }

    for (var i = 0; i < pts.length; i++) {
      var pt = pts[i];
      var a = alive(p, pt.birth);
      if (a <= .003) { pt.x = -99; continue; }
      // 位置：0 号从屏心出发；其余 散布位 → 地图位
      var x, y;
      if (i === 0 && flyT <= 0) { x = W / 2; y = H / 2; }
      else {
        var fx0 = i === 0 ? W / 2 : pt.sx, fy0 = i === 0 ? H / 2 : pt.sy;
        var ft = ease(flyT * 1.25 - pt.birth * .25);   // stagger：先生者先落位
        x = fx0 + (pt.tx - fx0) * ft;
        y = fy0 + (pt.ty - fy0) * ft;
      }
      pt.x = x; pt.y = y;
      // 落地发光（#36）：抵达瞬间小爆闪后回归星点（纯函数 f(flyT)·可逆）
      var arrT = (1 + pt.birth * .25) / 1.25;            // 该点落位时的 flyT
      var lp = (flyT - arrT) / .075;
      var land = (lp > 0 && lp < 1) ? Math.sin(Math.PI * lp) : 0;
      // 尺寸/呼吸：单点阶段大而庄重 → 落位后回归星点；网络期微闪烁
      var solo = i === 0 ? (1 - ease((p - PHASE.one) / .1)) : 0;
      var tw = netT > 0 ? (.82 + .18 * Math.sin(time * 1.4 + pt.tw)) : 1;
      var base = pt.isle ? .32 : pt.core ? .92 : .42;
      var sz = (base + solo * 2.2 + land * (pt.core ? .55 : .42)) * a * tw;
      var sp = pt.core ? SPRC : SPR;
      var R = sp.width * sz / 2;
      ctx.globalAlpha = Math.min(1, a * (pt.isle ? .8 : 1) + land * .5) * dimF;
      ctx.drawImage(sp, x - R, y - R, R * 2, R * 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 文案切换 ---------- */
  var caps = Array.prototype.slice.call(sec.querySelectorAll(".genesis__cap"));
  var CAP_AT = [
    [.015, PHASE.one - .015],
    [PHASE.one + .01, PHASE.ten - .01],
    [PHASE.ten + .01, .56],          // 第三句陪到描线中段
    [PHASE.fly1 + .02, .885]         // 「落满整片土地」让位给 #38 回扣（.90 brand 起）
  ];
  function capState(p) {
    for (var i = 0; i < caps.length; i++) {
      var on = p >= CAP_AT[i][0] && p <= CAP_AT[i][1];
      caps[i].classList.toggle("on", on);
    }
  }

  /* ---------- 驱动：sticky + 自算 progress ---------- */
  var raf = 0, active = false;
  function tick() {
    raf = requestAnimationFrame(tick);
    var r = sec.getBoundingClientRect();
    var span = r.height - innerHeight;
    var p = span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 1;
    render(p);
    capState(p);
  }
  function start() { if (!raf) { layout(); raf = requestAnimationFrame(tick); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  if (reduced) {
    // 降级：静态终态（满图灯火+连线+末行文案）
    layout(); render(1); capState(1);
    addEventListener("resize", function () { layout(); render(1); });
    return;
  }

  var io = new IntersectionObserver(function (es) {
    active = es[0].isIntersecting;
    if (active) start(); else stop();
  }, { rootMargin: "8% 0%" });
  io.observe(sec);

  addEventListener("resize", function () {
    clearTimeout(layout._t);
    layout._t = setTimeout(layout, 200);
  }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else if (active) start();
  });
})();

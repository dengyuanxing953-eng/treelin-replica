/* ============================================================
   《希望》 · 终幕作品旋涡 finale.js（#22 电影帷幕 + #40 星系粒子）
   ------------------------------------------------------------
   在 #ending2（AI 时代 / 年轻人 / 无限希望）背后，让作品以
   「漩涡星系」的形式环绕文案缓缓旋转——素材复用开幕作品墙同一组图：
   开头它们是黑白静止的未知，结尾它们被点亮、环绕着希望旋转（首尾呼应）。

   #40 星系粒子（卡片=星团，粒子=星河，同一时钟共转）：
   · 对数螺旋双臂（θ = arm + WIND·ln r + 高斯散布）+ 30% 场星
   · 差速旋转与卡片同公式 → 旋臂随时间自然剪切缠绕（真实星系感）
   · 缓慢向心流入 + 外缘按臂重生 → 结构持续自我补给不糊成环
   · 景深三件套：z 控大小/亮度，闪烁相位独立，暖白/朱砂/冷灰三色
   · 星云团（大半径低 alpha 软光斑）铺出体积感；偶发朱砂彗星划过
   · additive(lighter) 合成=黑底发光；中心 alpha 衰减+iris 罩护文字

   性能：sprite 预渲染（radialGradient 只画 4 次），每帧 drawImage；
   DPR 封 1.5；离屏 IO 停更；reduced-motion → 静态一帧。
   旋钮：N 卡片数 / OMEGA 角速度 / NS 星数 / ARMS·WIND 旋臂 /
        INFLOW 向心速 / 彗星 COMET_EVERY / 卡片亮度在 css。
   ============================================================ */
(function () {
  "use strict";

  var sec = document.getElementById("ending2");
  var gsap = window.gsap;
  if (!sec || !gsap) return;

  /* 素材：开幕作品墙的静态图（去重） */
  var srcs = [];
  document.querySelectorAll(".reel__cell img").forEach(function (im) {
    var s = im.getAttribute("src");
    if (s && srcs.indexOf(s) === -1) srcs.push(s);
  });
  if (!srcs.length) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = Math.min(innerWidth, innerHeight) < 560;
  var N = small ? 12 : Math.min(20, srcs.length * 2);   // 卡片数
  var OMEGA = (Math.PI * 2) / 130;                      // 外圈基础角速度：130s/圈（电影级慢）
  var GOLD = Math.PI * (3 - Math.sqrt(5));              // 黄金角 ≈137.5°

  /* 图层 */
  var layer = document.createElement("div");
  layer.className = "vortex";
  layer.setAttribute("aria-hidden", "true");
  sec.insertBefore(layer, sec.firstChild);

  /* ---------- #40 星系画布（先 append → 画在卡片之下） ---------- */
  var cv = document.createElement("canvas");
  cv.className = "vortex__stars";
  layer.appendChild(cv);

  var cards = [];
  for (var i = 0; i < N; i++) {
    var rn = Math.sqrt((i + 0.5) / N);                  // 0..1 → 半径占比（向日葵分布）
    var el = document.createElement("div");
    el.className = "vortex__card";
    el.style.backgroundImage = "url('" + srcs[i % srcs.length] + "')";
    layer.appendChild(el);
    cards.push({
      el: el,
      rn: rn,
      a0: i * GOLD,
      sp: Math.pow(1 / (0.38 + 0.62 * rn), 0.6),        // 差速：内圈转得快
      sc: 0.72 + 0.5 * rn,                              // 内小外大（被吸入感）
      op: 0.42 + 0.34 * rn,                             // 内暗外亮（让位中心文字）
      jit: (Math.random() - 0.5) * 1.4
    });
    el.style.opacity = cards[i].op.toFixed(2);
  }

  var theta = 0, spinExtra = 0, visible = false;

  /* 每帧共用几何（卡片与星系同一坐标系） */
  var G = { RMIN: 0, RMAX: 0, EX: 1.16, EY: 0.9, cx: 0, cy: 0 };
  function geo() {
    var vmin = Math.min(innerWidth, innerHeight);
    G.RMIN = vmin * 0.34;                                          // 中心净空（护住文案）
    G.RMAX = Math.hypot(innerWidth, innerHeight) * 0.5 * 0.82;     // 伸向四角
    G.cx = layer.clientWidth / 2;
    G.cy = layer.clientHeight / 2;
  }

  function place() {
    for (var k = 0; k < cards.length; k++) {
      var c = cards[k];
      var a = c.a0 + (theta + spinExtra) * c.sp;
      var r = G.RMIN + (G.RMAX - G.RMIN) * c.rn;
      var x = Math.cos(a) * r * G.EX;
      var y = Math.sin(a) * r * G.EY;
      var rot = Math.sin(a + c.jit) * 10 + c.jit * 4;              // 顺流轻摆（不倒置作品）
      c.el.style.transform = "translate(-50%,-50%) translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) rotate(" + rot.toFixed(2) + "deg) scale(" + c.sc.toFixed(3) + ")";
    }
  }

  /* ---------- #40 星系引擎 ---------- */
  var gx = (function () {
    var ctx = cv.getContext("2d");
    var DPR = Math.min(devicePixelRatio || 1, 1.5);
    function resize() {
      cv.width = layer.clientWidth * DPR;
      cv.height = layer.clientHeight * DPR;
    }

    /* 发光 sprite 预渲染（实心亮核 + 柔光晕） */
    function spr(rgb, core) {
      var s = document.createElement("canvas"); s.width = s.height = 64;
      var g = s.getContext("2d");
      var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, "rgba(" + rgb + "," + core + ")");
      rg.addColorStop(0.3, "rgba(" + rgb + ",.5)");
      rg.addColorStop(1, "rgba(" + rgb + ",0)");
      g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
      return s;
    }
    var S_WARM = spr("255,243,228", 1);     // 暖白（主体）
    var S_RED  = spr("226,74,44", 1);       // 朱砂
    var S_COOL = spr("188,198,214", .9);    // 冷灰（纵深点缀）
    var S_NEB  = spr("255,236,218", .35);   // 星云（暖雾）
    var S_NEBR = spr("222,72,42", .3);      // 星云（朱砂雾）

    function gauss() { return (Math.random() + Math.random() + Math.random()) / 1.5 - 1; }

    var ARMS = 2, WIND = 3.05;              // 旋臂数 / 缠绕度
    var NS = small ? 600 : 1350;            // 星数
    var NN = small ? 12 : 26;               // 星云团数
    var INFLOW = 0.0042;                    // 向心流入（rn/秒，≈4 分钟一轮回）

    function armAngle(rn, jit, armIdx) {
      return armIdx * (Math.PI * 2 / ARMS) + WIND * Math.log(0.22 + rn) + jit;
    }

    var stars = [];
    function spawn(st, atRim) {
      st.armed = Math.random() < 0.72;
      st.rn = atRim ? (1.02 + Math.random() * 0.16)
                    : (0.10 + 1.08 * Math.pow(Math.random(), 0.78));   // 内密外疏
      st.jit = st.armed ? gauss() * 0.17 * (0.55 + st.rn * 0.7) : 0;
      var core = st.armed ? Math.exp(-(st.jit * st.jit) / 0.045) : 0;  // 距臂心越近越亮
      st.ang = st.armed
        ? armAngle(st.rn, st.jit, (Math.random() * ARMS) | 0) + (theta + spinExtra)
        : Math.random() * Math.PI * 2;
      st.sp = Math.pow(1 / (0.38 + 0.62 * Math.min(st.rn, 1)), 0.6);   // 与卡片同公式=共转
      st.z = 0.55 + Math.random() * 0.95;                              // 景深
      st.size = (1.4 + 2.8 * Math.random()) * st.z;
      st.a = (0.16 + 0.5 * Math.random()) * (0.5 + 0.5 * st.z) * (st.armed ? 0.62 + 0.75 * core : 0.5);
      st.tw = 0.4 + Math.random() * 1.7;                               // 闪烁频率
      st.ph = Math.random() * Math.PI * 2;
      var roll = Math.random();
      st.im = roll < 0.82 ? S_WARM : (roll < 0.92 ? S_RED : S_COOL);
      st.fall = INFLOW * (0.6 + Math.random() * 0.9);
    }
    for (var k2 = 0; k2 < NS; k2++) { var st = {}; spawn(st, false); stars.push(st); }

    var nebs = [];
    for (var k3 = 0; k3 < NN; k3++) {
      var nb = {};
      nb.rn = 0.3 + 0.8 * Math.random();
      nb.jit = gauss() * 0.13;
      nb.ang = armAngle(nb.rn, nb.jit, (Math.random() * ARMS) | 0);
      nb.sp = Math.pow(1 / (0.38 + 0.62 * Math.min(nb.rn, 1)), 0.6);
      nb.size = 46 + Math.random() * 110;
      nb.a = 0.035 + Math.random() * 0.05;
      nb.im = Math.random() < 0.78 ? S_NEB : S_NEBR;
      nebs.push(nb);
    }

    /* 彗星：偶发一颗朱砂流光沿涡流划过（呼应火种） */
    var COMET_EVERY = 6.5;                  // 平均间隔秒
    var comet = null, cometTimer = 2.5;
    function spawnComet() {
      var rn = 0.55 + Math.random() * 0.45;
      comet = {
        rn: rn,
        ang: Math.random() * Math.PI * 2,
        life: 0, dur: 1.6 + Math.random() * 0.7,
        trail: []
      };
    }

    var prevClock = 0;
    function draw(dtMS, clockMS) {
      var dt = Math.min(dtMS, 50) / 1000;
      var t = clockMS / 1000;
      var W = cv.width / DPR, H = cv.height / DPR;
      if (!W || !H) return;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      var rot = theta + spinExtra;
      var dRot = rot - prevClock; prevClock = rot;
      var clearR = G.RMIN * 0.88;

      /* 星云（先画=最底层体积） */
      for (var i2 = 0; i2 < nebs.length; i2++) {
        var nb2 = nebs[i2];
        var a2 = nb2.ang + rot * nb2.sp;
        var r2 = nb2.rn * G.RMAX * 0.92;
        var x2 = G.cx + Math.cos(a2) * r2 * G.EX;
        var y2 = G.cy + Math.sin(a2) * r2 * G.EY;
        ctx.globalAlpha = nb2.a * (0.8 + 0.2 * Math.sin(t * 0.3 + i2));
        ctx.drawImage(nb2.im, x2 - nb2.size, y2 - nb2.size, nb2.size * 2, nb2.size * 2);
      }

      /* 星河 */
      for (var i3 = 0; i3 < stars.length; i3++) {
        var s3 = stars[i3];
        s3.ang += dRot * s3.sp;                 // 共转（含滚动耦合）
        s3.rn -= s3.fall * dt;                  // 缓慢向心流入
        if (s3.rn < 0.14) spawn(s3, true);      // 抵达中心 → 外缘按臂重生
        var r3 = s3.rn * G.RMAX * 0.92;
        var x3 = G.cx + Math.cos(s3.ang) * r3 * G.EX;
        var y3 = G.cy + Math.sin(s3.ang) * r3 * G.EY;
        var al = s3.a * (0.72 + 0.28 * Math.sin(t * s3.tw + s3.ph));
        if (r3 < clearR) al *= Math.pow(r3 / clearR, 2);     // 中心净空：文字是唯一主角
        if (al < 0.01) continue;
        ctx.globalAlpha = al;
        var sz = s3.size;
        ctx.drawImage(s3.im, x3 - sz, y3 - sz, sz * 2, sz * 2);
      }

      /* 彗星 */
      cometTimer -= dt;
      if (!comet && cometTimer <= 0) { spawnComet(); cometTimer = COMET_EVERY * (0.6 + Math.random() * 0.8); }
      if (comet) {
        comet.life += dt;
        var p4 = comet.life / comet.dur;
        if (p4 >= 1) { comet = null; }
        else {
          comet.ang += dt * (0.9 + 0.5 * p4);          // 越划越快的弧线
          comet.rn -= dt * 0.10;
          var r4 = comet.rn * G.RMAX * 0.92;
          var x4 = G.cx + Math.cos(comet.ang) * r4 * G.EX;
          var y4 = G.cy + Math.sin(comet.ang) * r4 * G.EY;
          comet.trail.push([x4, y4]);
          if (comet.trail.length > 26) comet.trail.shift();
          var fade = Math.sin(Math.PI * p4);           // 淡入划过淡出
          for (var i5 = 1; i5 < comet.trail.length; i5++) {
            ctx.globalAlpha = fade * 0.5 * (i5 / comet.trail.length);
            ctx.strokeStyle = "rgba(226,74,44,1)";
            ctx.lineWidth = 1.3 * (i5 / comet.trail.length) + 0.3;
            ctx.beginPath();
            ctx.moveTo(comet.trail[i5 - 1][0], comet.trail[i5 - 1][1]);
            ctx.lineTo(comet.trail[i5][0], comet.trail[i5][1]);
            ctx.stroke();
          }
          ctx.globalAlpha = fade * 0.9;
          ctx.drawImage(S_RED, x4 - 4, y4 - 4, 8, 8);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    return { resize: resize, draw: draw };
  })();

  geo(); gx.resize();
  addEventListener("resize", function () { geo(); gx.resize(); });

  /* 降级：减少动态 → 静态星盘（一次排好，不旋转；星系画一帧） */
  if (reduced) {
    place();
    gx.draw(0, 0);
    layer.style.opacity = "0.55";
    return;
  }

  /* 离屏停更新 */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
    }, { rootMargin: "12%" }).observe(sec);
  } else { visible = true; }

  gsap.ticker.add(function (t, deltaMS) {
    if (!visible) return;
    theta += OMEGA * Math.min(deltaMS, 50) / 1000;
    geo();
    place();
    gx.draw(deltaMS, t * 1000);
  });

  /* 滚动耦合：下滑时涡流被轻微带动（活的帷幕） */
  if (window.lenis && window.lenis.on) {
    window.lenis.on("scroll", function (e) {
      var v = Math.max(-60, Math.min(60, e.velocity || 0));
      spinExtra += v * 0.00009;
    });
  }

  /* 入场：进入终幕时帷幕拉开（淡入 + 微缩放落定） */
  if (window.ScrollTrigger) {
    gsap.fromTo(layer, { opacity: 0, scale: 0.94 }, {
      opacity: 1, scale: 1, duration: 1.6, ease: "power2.out",
      scrollTrigger: { trigger: sec, start: "top 75%", once: true }
    });
  } else {
    layer.style.opacity = "1";
  }
})();

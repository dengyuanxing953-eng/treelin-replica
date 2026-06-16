/* ============================================================
   《希望》 · 开幕电影蒙太奇  reel.js —— 整屏震撼 · 点击开启版
   ------------------------------------------------------------
   交互：加载后展示「黑白作品墙（静止）+ 点击进入」；用户【首次点击】才
        让画面开始运动，同时 BGM 起（点击是用户手势，浏览器必放行声音）。
   蒙太奇：黑白作品墙 → 反向瀑布流加速 → 全屏白色光流(整屏水流·运动拖尾)
          → 整屏光流【就地凝结】成「树成林」(粒子长成实心字)
          → 【蓄能】四面八方能量流持续涌入 + 吸收环收拢 + 字渐炽热/吸气收缩/微震
          → 【迸发 #37·涟漪版】吸气暗场半拍 → 字单次回弹 + 中心柔光 +
            「单道涟漪波」向外推进：波过之处整个画面被径向折射顶起再落回
            （环带折射位移）+ 波峰受光/内缘微暗 = 黑色水面的立体涟漪
            （判例 T27：无闪白/无光屑/无震屏/无余烬点点——只有蓄能与一道波）
          → 辉光退尽=纯白实心「树成林」定格 → 副标题印刷擦除浮现 → 左上 lockup 现身
   关键设计：
     · 作品「一开始就黑白」(CSS grayscale + JS 起始 filter)——杜绝彩色→变白闪烁。
     · 「水流」=全屏 canvas 光流：文字粒子 + 额外纯光流粒子竖向奔涌，每帧
       半透明黑覆盖产生运动拖尾 → 整屏白色光柱，而非靠图片提亮的假水流。
     · 「树成林」不先塌缩到中心一点；粒子从全屏四散位置【就地直奔字形】，
       整个画面的能量一起汇集成字 → 整屏震撼。
     · 标题终态=纯白实心平面字（3D 挤出已废弃：canvas 多层 fillText 显廉价）。
       质感由「蓄能→迸发→尘埃落定」的能量过程承担，终态干净无特效残留。
     · 左上 .brand lockup 开幕全程隐身(#23)，蒙太奇收尾随小标语一起现身。
   性能：粒子单 fillStyle 批量 fillRect · 拖尾=每帧 1 次全屏半透明填充 ·
        动画期 DPR 封顶 1.6（定格后 sharpenFinal 按真实 DPR≤2.5 补渲标题）·
        dt 封顶防跳变 · 隐藏标签页停渲染 · 渲染按 pa.v 门控 · 涟漪折射仅迸发期 ~2.4s 运行。
   ============================================================ */
(function () {
  "use strict";

  var reel = document.querySelector("#reel");
  if (!reel) return;

  var stage = reel.querySelector(".reel__stage");
  var cols  = Array.prototype.slice.call(reel.querySelectorAll(".reel__col"));
  var canvas = reel.querySelector(".reel__particles");
  var brand = reel.querySelector(".reel__brand");
  var tag   = reel.querySelector(".reel__tag");
  var skip  = reel.querySelector(".reel__skip");
  var gate  = reel.querySelector(".reel__gate");
  var lockup = document.querySelector(".brand");   // 左上 logo lockup（#23：开幕全程隐身，收尾现身）
  function showLockup() { if (lockup) lockup.classList.add("brand--on"); }

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap;

  /* ---------- 降级：无 GSAP / 减少动态 → 直接静态展示社群名 ---------- */
  if (!gsap || reduced || !canvas || !cols.length) {
    if (stage) stage.style.opacity = ".18";
    if (brand) brand.style.opacity = "1";
    if (tag) tag.style.opacity = "1";
    if (skip) skip.style.display = "none";
    if (gate) gate.style.display = "none";
    showLockup();
    return;
  }

  /* ---------- 开屏未结束前锁滚动（#21）----------
     仅当用户位于页顶附近才锁（刷新恢复滚动位置在页中时不锁，避免困住人）；
     蒙太奇播完(onComplete)或跳过(finish)解锁。 */
  var scrollLocked = false;
  if (window.scrollY < innerHeight * 0.5) {
    scrollLocked = true;
    document.documentElement.classList.add("lock-scroll");
    document.documentElement.classList.add("cur-gate");   // 取景器光标：点击门声呐脉冲
    if (window.lenis && window.lenis.stop) window.lenis.stop();
  }
  function unlockScroll() {
    document.documentElement.classList.remove("cur-gate", "cur-reel");  // 光标恢复常态
    if (!scrollLocked) return;
    scrollLocked = false;
    document.documentElement.classList.remove("lock-scroll");
    if (window.lenis && window.lenis.start) window.lenis.start();
  }
  if (!scrollLocked) showLockup();   // 页中刷新：开幕不在视野，lockup 直接就位

  var ctx = canvas.getContext("2d");
  var DPR = Math.min(window.devicePixelRatio || 1, 1.6);
  var W = 0, H = 0, cx = 0, cy = 0;
  var P = [];                          // 文字粒子（凝结成「树成林」）
  var F = [];                          // 纯光流粒子（增厚水流，成字时淡出）
  var running = true, canvasDirty = false;
  // （旧瀑布流积分位移 s / flow 已废弃——#47 改为 fall.v 纯函数驱动，见下）
  var conv = { fp: 0 };                // 凝结进度 0(全屏光流)→1(成字)
  var pa = { v: 0 };                   // 粒子整体透明度（同时作渲染门控）
  var txt = { a: 0 };                  // 清晰文字 alpha：同一画布渲染，桥接「粒子→实心字」
  var FS = 0, LSP = 0, FONT = "";      // 文字字号/字距/字体（粒子采样与清晰字共用，保证完全重合）
  var TG = [];                         // 字形采样点（蓄能目标 / 迸发喷射源）
  var C = [];                          // 蓄能能量流：从画面外四周【循环】涌向字形（持续吸收感）
  var chg = { t: 0 };                  // 蓄能进度 0→1（驱动能量流强度 + 吸收环）
  var heat = { v: 0 };                 // 字的炽热度（辉光/泛光/末段微震）
  var scl = { s: 1 };                  // 字的呼吸缩放（蓄能吸气收缩 → 迸发回弹释放）
  var burst = { t: 0, e: 1 };          // 主冲击波（光屑/泛光/字心光带都挂它）
  var dim   = { a: 0 };                // 迸发前「吸气暗场」（对比度=冲击的一半）
  var rip = document.createElement("canvas"), ripx = rip.getContext("2d");  // 涟漪折射离屏快照

  var DIR = ["down", "up", "down"];    // 左下 · 中上 · 右下

  function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function waveRadius(t) { return FS * .45 + t * Math.max(W, H) * .95; }   // 冲击波半径（出屏才熄）

  function measure() {
    return cols.map(function (c) {
      var k = c.children, half = k.length / 2 | 0;
      return (k[half] && k[0]) ? (k[half].offsetTop - k[0].offsetTop) || 1 : 1;
    });
  }
  var setH = measure();

  function flowDir(x) { return DIR[x < W / 3 ? 0 : (x < 2 * W / 3 ? 1 : 2)] === "up" ? -1 : 1; }

  /* ---------- 把「树成林」渲染成粒子目标点 + 全屏光流出生位 ---------- */
  function buildTargets() {
    W = canvas.width = Math.floor(innerWidth * DPR);
    H = canvas.height = Math.floor(innerHeight * DPR);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    cx = W / 2;
    // cy 对齐 DOM 真名中心（布局位、忽略 transform）→ 清晰文字与 DOM 字完全重合，最终交接隐形
    cy = brand ? (brand.offsetTop + brand.offsetHeight / 2) * DPR : H * 0.46;

    FS = Math.min(W * 0.205, H * 0.40);   // 与 CSS .reel__brand 同尺寸
    LSP = FS * 0.06;                       // 与 CSS letter-spacing:.06em 一致
    FONT = '900 ' + FS + 'px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';  // 真·黑体900（子集含「树成林」，T5）

    var off = document.createElement("canvas");
    off.width = W; off.height = H;
    var o = off.getContext("2d");
    o.fillStyle = "#fff";
    o.textAlign = "center";
    o.textBaseline = "middle";
    if ("letterSpacing" in o) { try { o.letterSpacing = LSP + "px"; } catch (e) {} }
    o.font = FONT;
    o.fillText("树成林", cx, cy);

    var data = o.getImageData(0, 0, W, H).data;
    var step = Math.max(3, Math.round(3.6 * DPR));   // 采样更密 → 凝结后更接近实心字
    var targets = [];
    for (var y = 0; y < H; y += step) {
      for (var x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) targets.push([x, y]);
      }
    }
    if (targets.length > 4200) {
      var keep = [], r = targets.length / 4200;
      for (var i = 0; i < 4200; i++) keep.push(targets[Math.floor(i * r)]);
      targets = keep;
    }

    // 文字粒子：全屏四散出生 → 就地直奔字形目标（不塌缩到中心）
    P = targets.map(function (t) {
      var hx = Math.random() * W;
      return {
        tx: t[0], ty: t[1],
        hx: hx, hy: Math.random() * H,
        vy: flowDir(hx) * (520 + Math.random() * 640) * DPR,
        br: 0.5 + Math.random() * 0.5
      };
    });

    // 纯光流粒子：竖向奔涌增厚水流，成字时淡出（密度按屏面积，封顶）
    var nF = Math.min(1800, Math.round((W * H) / (5200 * DPR)));
    F = [];
    for (var k = 0; k < nF; k++) {
      var fx = Math.random() * W;
      F.push({
        hx: fx, hy: Math.random() * H,
        vy: flowDir(fx) * (560 + Math.random() * 720) * DPR,
        br: 0.32 + Math.random() * 0.5
      });
    }

    TG = targets;

    // 蓄能能量流：从画面外四周涌向字形，到达即重生（respawnCharge）→ 持续不断的吸收
    C = [];
    for (var c2 = 0; c2 < 540; c2++) {
      var cp0 = {};
      respawnCharge(cp0);
      cp0.e = Math.random();             // 初始相位打散：蓄能一开始就满屏在途
      C.push(cp0);
    }

    // 迸发光屑：从字形采样点沿径向（字中心→外）喷射，带少量散射角
  }
  // 蓄能流粒子（重）生成：画面外随机方位 → 随机字形点；缓存单位方向供拖尾用
  function respawnCharge(c) {
    var ang = Math.random() * Math.PI * 2;
    var diag = Math.sqrt(W * W + H * H);
    var rad = diag * (0.55 + Math.random() * 0.30);      // 屏幕外
    var tg = TG[(Math.random() * TG.length) | 0] || [cx, cy];
    c.sx = cx + Math.cos(ang) * rad; c.sy = cy + Math.sin(ang) * rad;
    c.tx = tg[0]; c.ty = tg[1];
    var dx = c.sx - c.tx, dy = c.sy - c.ty, L = Math.sqrt(dx * dx + dy * dy) || 1;
    c.ux = dx / L; c.uy = dy / L;                         // 指向来路（拖尾方向）
    c.br = 0.45 + Math.random() * 0.55;
    c.sp = 0.7 + Math.random() * 0.9;                     // 单程速度差异
    c.red = Math.random() < 0.22;                         // 少量朱砂流丝点缀
    c.e = 0;
  }
  buildTargets();

  /* ---------- 瀑布流（#47 重生）：纯函数 f(progress)，不在 ticker 里手写积分 ----------
     旧实现 s += vel*dt 在 ticker 里积分：s 一旦被异常帧污染成 NaN 就永久中毒，
     transform 全帧写非法值被浏览器静默忽略 → 瀑布流整段消失（实测踩中）。
     改为 tween 驱动 fall.v 0→1，行程=纯函数 → 免疫 dt/NaN、seek/倒放安全。 */
  var fall = { v: 0 };
  var FALL_TRAVEL = 3200;                  // 总位移 px（加速感旋钮：越大尾段越快）
  function applyFall() {
    var sPos = fall.v * FALL_TRAVEL;
    for (var i = 0; i < cols.length; i++) {
      var h = setH[i] || 1, raw = sPos % h;
      var y = (DIR[i] === "up") ? raw : (h - raw);
      cols[i].style.transform = "translate3d(0," + (-y).toFixed(2) + "px,0)";
    }
  }

  /* ---------- 渲染循环：全屏光流 + 凝结成字 ---------- */
  gsap.ticker.add(function (time, delta) {
    if (!running) return;
    var dt = Math.min(delta / 1000, 0.05);
    if (!isFinite(dt)) dt = 1 / 60;        // 某些帧 ticker 会给 undefined/NaN delta

    // 渲染门控：粒子与清晰字都不可见时才停（清一次残留）。清晰字成形后一直留在画布上＝最终标题。
    if (pa.v <= 0.002 && txt.a <= 0.002) {
      if (canvasDirty) { ctx.clearRect(0, 0, W, H); canvasDirty = false; }
      return;
    }
    canvasDirty = true;

    var fp = conv.fp;
    // 运动拖尾：每帧半透明黑覆盖；凝结越深覆盖越实 → 最终字形清晰锐利。
    var veil = 0.15 + 0.85 * Math.min(1, fp / 0.92);
    ctx.fillStyle = "rgba(10,10,10," + veil.toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);

    if (pa.v > 0.002) {
      var e = easeInOut(Math.min(1, fp));
      var sz = (1.7 + 1.2 * e) * DPR;        // 凝结时粒子变大、相互交叠 → 接近实心字
      var streak = (1 - e) * 5 * DPR;        // 光流期竖向拉长成光柱，成字时收成方点

      // 纯光流粒子（成字时整体淡出，让位给清晰字形）
      var fa = pa.v * (1 - Math.min(1, fp / 0.85));
      if (fa > 0.004) {
        for (var k = 0; k < F.length; k++) {
          var q = F[k];
          q.hy += q.vy * dt; if (q.hy > H) q.hy -= H; else if (q.hy < 0) q.hy += H;
          ctx.fillStyle = "rgba(255,255,255," + (fa * q.br).toFixed(3) + ")";
          ctx.fillRect(q.hx, q.hy, sz, sz + 6 * DPR);
        }
      }

      // 文字粒子：全屏奔涌 → 就地插值奔向字形目标（临近成形抖动收敛，稳稳落位）
      var jit = fp > 0.9 ? (1 - fp) / 0.1 : 1;
      for (var j = 0; j < P.length; j++) {
        var p = P[j];
        p.hy += p.vy * dt; if (p.hy > H) p.hy -= H; else if (p.hy < 0) p.hy += H;
        var px = p.hx + (p.tx - p.hx) * e;
        var py = p.hy + (p.ty - p.hy) * e;
        if (fp > 0.9) { px += (Math.random() - .5) * 0.7 * DPR * jit; py += (Math.random() - .5) * 0.7 * DPR * jit; }
        ctx.fillStyle = "rgba(255,255,255," + (pa.v * p.br).toFixed(3) + ")";
        ctx.fillRect(px, py, sz, sz + streak);
      }

    }

    // —— 蓄能：四面八方能量流持续涌入字形（迸发零点戛然而止＝能量已释放） ——
    var I = burst.t > 0.02 ? 0 : chg.t;
    if (I > 0.004) {
      var Ie = Math.min(1, I * 1.4);
      ctx.save();
      ctx.lineCap = "round";
      for (var ci = 0; ci < C.length; ci++) {
        var cp = C[ci];
        cp.e += dt * cp.sp * (0.55 + 0.85 * Ie);          // 蓄能越深，吸入越快
        if (cp.e >= 1) respawnCharge(cp);
        var k = cp.e * cp.e;                               // 加速吸入（越近越快）
        var px2 = cp.sx + (cp.tx - cp.sx) * k, py2 = cp.sy + (cp.ty - cp.sy) * k;
        var ca = cp.br * Ie * Math.min(1, cp.e * 6) * (1 - Math.max(0, (k - 0.92) / 0.08));
        if (ca <= 0.004) continue;
        var tail = ((12 + 26 * cp.e) * (1 - k) + 3) * DPR; // 拖尾朝来路，临近吸入收短
        ctx.strokeStyle = cp.red ? "rgba(217,52,28," + ca.toFixed(3) + ")" : "rgba(255,255,255," + ca.toFixed(3) + ")";
        ctx.lineWidth = (cp.red ? 1.7 : 1.3) * DPR;
        ctx.beginPath(); ctx.moveTo(px2, py2); ctx.lineTo(px2 + cp.ux * tail, py2 + cp.uy * tail); ctx.stroke();
      }
      // 吸收环 ×2：从屏外向字收拢的两道波（与迸发的扩散环互为镜像——吸气/呼气）
      if (burst.t <= 0.01) {
        var maxWH0 = Math.max(W, H);
        for (var ri2 = 0; ri2 < 2; ri2++) {
          var rt = chg.t * 1.35 - ri2 * 0.35;
          if (rt <= 0 || rt >= 1) continue;
          var rr = maxWH0 * 0.62 + (FS * 0.85 - maxWH0 * 0.62) * easeInOut(rt);
          var ra = 0.16 * Math.sin(Math.PI * rt) * Ie;
          if (ra <= 0.004) continue;
          ctx.strokeStyle = "rgba(255,255,255," + ra.toFixed(3) + ")";
          ctx.lineWidth = 1.2 * DPR;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 文字：同画布渐显填实(flat·与粒子无缝桥接)；蓄能期炽热辉光+微震，终态纯白实心
    if (txt.a > 0.002) drawTitle();

    // —— 迸发中心柔光：能量释放的辉光（无闪白/无光屑，呼气式退散） ——
    if (burst.t > 0.001 && burst.t < 0.999) {
      var fall = 1 - burst.t;
      var gA = fall * 0.35 * Math.min(1, burst.t * 5);
      if (gA > 0.004) {
        var grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, FS * 1.7);
        grd.addColorStop(0, "rgba(255,255,255," + gA.toFixed(3) + ")");
        grd.addColorStop(0.35, "rgba(217,52,28," + (gA * 0.45).toFixed(3) + ")");
        grd.addColorStop(1, "rgba(217,52,28,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(cx - FS * 1.8, cy - FS * 1.8, FS * 3.6, FS * 3.6);
      }
    }

    // —— 涟漪波（#37 迭代二·单道）：波过之处整个画面径向折射顶起再落回 ——
    //    ① 折射位移：把当前帧（含标题）拷到离屏，按波带分 9 个环带向外
    //       轻微缩放重绘 → 内容被波"顶起"经过后复位 = 背景随波起伏的立体感；
    //    ② 波峰受光：内缘微暗(凹) → 波峰暖白高光(凸·受光) → 朱砂折射余晖。
    //    无白环线条、无点点残留——黑色水面上一圈涌过去的浪。
    if (burst.t > 0.001 && burst.t < 0.999) {
      var wt = burst.t, wfall = 1 - wt;
      var WR = waveRadius(wt);
      var span = (90 + 150 * wt) * DPR;                       // 波带越传越宽、越缓
      var amp = 15 * DPR * Math.pow(wfall, 1.15);             // 折射强度随传播衰减
      if (rip.width !== W || rip.height !== H) { rip.width = W; rip.height = H; }
      ripx.clearRect(0, 0, W, H);
      ripx.drawImage(canvas, 0, 0);
      var BANDS = 9;
      for (var bi = 0; bi < BANDS; bi++) {
        var r0 = WR - span / 2 + span * bi / BANDS;
        var r1 = r0 + span / BANDS + 1.2 * DPR;
        if (r1 <= 2) continue;
        var mid = (r0 + r1) / 2;
        var disp = amp * Math.sin(Math.PI * (bi + .5) / BANDS);  // 带中央位移最大
        var s = (mid + disp) / mid;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, r1), 0, Math.PI * 2);
        ctx.arc(cx, cy, Math.max(0, r0), 0, Math.PI * 2, true);
        ctx.clip();
        ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
        ctx.drawImage(rip, 0, 0);
        ctx.restore();
      }
      var lg = ctx.createRadialGradient(cx, cy, Math.max(0, WR - span * .55), cx, cy, WR + span * .55);
      lg.addColorStop(0, "rgba(0,0,0,0)");
      lg.addColorStop(.40, "rgba(0,0,0," + (.18 * wfall).toFixed(3) + ")");
      lg.addColorStop(.58, "rgba(255,242,230," + (.20 * Math.pow(wfall, 1.25)).toFixed(3) + ")");
      lg.addColorStop(.72, "rgba(217,52,28," + (.08 * wfall).toFixed(3) + ")");
      lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
    }

    // 吸气暗场（#37）：迸发前 0.2s 全场压暗一拍——静默之后的释放才响
    if (dim.a > 0.004) {
      ctx.fillStyle = "rgba(6,6,6," + (dim.a * .8).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  });

  /* ---------- 初始：黑白作品墙（静止）淡入，等首次点击 ---------- */
  var heroes = [];
  cols.forEach(function (c) {
    var cs = c.querySelectorAll(".reel__cell");
    for (var i = 0; i < Math.min(2, cs.length); i++) heroes.push(cs[i]);
  });
  var imgs = stage.querySelectorAll(".reel__cell img");
  gsap.set(heroes, { opacity: 1, scale: 1, filter: "blur(0px)" });
  gsap.set(imgs, { filter: "grayscale(1) brightness(1) blur(0px)" });   // 黑白起步
  gsap.set(brand, { opacity: 0, y: 0 });   // 真名不做位移入场：要在「同位」的清晰文字上隐形淡入
  gsap.set(tag, { opacity: 0, y: 0 });     // 小标语由「印刷擦除」登场，不做位移
  var tagInner = tag ? tag.querySelector(".reel__tag-inner") : null;
  var tagWiper = tag ? tag.querySelector(".reel__tag-wiper") : null;
  if (tagInner) tagInner.style.clipPath = "inset(-35% 100% -35% -8%)";   // 初始：全部裁掉，等印刷头擦出
  gsap.set(stage, { opacity: 0 });
  if (skip) skip.style.display = "none";
  // 作品墙缓缓浮现（仅淡入，非"运动"；运动留给点击后）
  gsap.to(stage, { opacity: 1, duration: 1.0, ease: "power2.out", delay: 0.25 });
  if (gate) gsap.fromTo(gate, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", delay: 0.9 });

  /* ---------- 点击后的运动时间线（暂停，等手势播放） ---------- */
  /* 标题绘制（唯一介质·canvas 字即最终标题，不叠 DOM 大字）：纯白实心平面字。
     3D 挤出已废弃（判例：canvas 多层 fillText 立体显廉价，T1 力量靠纯度不靠特效）。
     质感由过程承担：桥接辉光(成形) → 炽热辉光+泛光+微震(蓄能) → 回弹(迸发) → 干净定格。 */
  function drawTitle() {
    var a = Math.min(1, txt.a);
    var glow = Math.max((1 - a) * 18, heat.v * 34) * DPR;   // 成形桥接辉光 / 蓄能炽热辉光
    var j = heat.v * heat.v * heat.v * 1.8 * DPR;           // 蓄能末段微震（rumble）
    ctx.save();
    if (heat.v > 0.02) {                                    // 蓄能泛光：字后能量晕（白心→朱砂）
      var hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, FS * 1.15);
      hg.addColorStop(0, "rgba(255,255,255," + (0.16 * heat.v).toFixed(3) + ")");
      hg.addColorStop(0.5, "rgba(217,52,28," + (0.10 * heat.v).toFixed(3) + ")");
      hg.addColorStop(1, "rgba(217,52,28,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(cx - FS * 1.3, cy - FS * 1.3, FS * 2.6, FS * 2.6);
    }
    ctx.translate(cx + (Math.random() - .5) * 2 * j, cy + (Math.random() - .5) * 2 * j);
    ctx.scale(scl.s, scl.s);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) { try { ctx.letterSpacing = LSP + "px"; } catch (e) {} }
    ctx.font = FONT;
    ctx.globalAlpha = a; ctx.fillStyle = "#fff";
    if (glow > 0.01) { ctx.shadowColor = "rgba(255,255,255,.55)"; ctx.shadowBlur = glow; }
    ctx.fillText("树成林", 0, 0);
    ctx.restore();
  }
  // 最终定格：清掉粒子/特效残留，画上纯白实心「树成林」（此时 heat=0/scl=1 → 无辉光无抖动）
  function drawFinalTitle() {
    ctx.clearRect(0, 0, W, H);
    drawTitle();
  }
  // 终帧补渲：蒙太奇期间 DPR 封 1.6 保性能；定格标题是常驻 hero 字，
  // 按设备真实 DPR（≤2.5）重建画布再画一次 → 3x 手机上字缘不再发虚
  function sharpenFinal() {
    var d2 = Math.min(window.devicePixelRatio || 1, 2.5);
    if (d2 > DPR) { DPR = d2; buildTargets(); }
    drawFinalTitle();
  }
  var tl = gsap.timeline({ paused: true, onComplete: function () { running = false; sharpenFinal(); unlockScroll(); showLockup(); if (skip) skip.style.display = "none"; } });
  // ② 反向瀑布流加速（#47：tween 纯函数驱动，power3.in=越滚越快，墙隐没前正好冲到峰值）
  tl.to(fall, { v: 1, duration: 3.9, ease: "power3.in", onUpdate: applyFall }, 0);
  // ③ 作品提亮 + 竖向模糊（黑白，不变色 → 无闪烁），融入光流
  tl.to(imgs, { filter: "grayscale(1) brightness(1.9) blur(12px)", duration: 1.4, ease: "power2.in" }, 1.7);
  // ④ 全屏光流点亮，图片让位
  tl.to(pa, { v: 1, duration: 1.0, ease: "power1.out" }, 2.4);
  tl.to(stage, { opacity: 0, duration: 1.2, ease: "power2.inOut" }, 2.6);
  // —— 峰值：整屏白色光流奔涌 ~3.4–3.9 ——
  // ⑤ 整屏光流，就地凝结成「树成林」
  tl.to(conv, { fp: 1, duration: 2.5, ease: "power2.inOut" }, 3.9);
  // ⑥ 丝滑桥接：清晰文字在粒子缝隙间「同画布」渐显填实（颗粒长成实心字·flat）
  //    #48：桥接拉长（1.2→1.9s、提前起步、inOut）——「字慢慢显示、塑造成标题」，不要钝感
  tl.to(txt, { a: 1, duration: 1.9, ease: "power1.inOut" }, 5.7);
  // 光流被吸干：背景粒子在蓄能中被字吸收殆尽
  tl.to(pa, { v: 0, duration: 1.6, ease: "power1.inOut" }, 6.6);
  // ⑦ 蓄能（crescendo）：四面八方能量流涌入 + 吸收环收拢 + 字渐炽热/吸气收缩/末段微震
  tl.to(chg, { t: 1, duration: 2.2, ease: "power1.in" }, 6.8);
  tl.to(heat, { v: 1, duration: 2.2, ease: "power2.in" }, 6.8);
  tl.to(scl, { s: 0.982, duration: 2.2, ease: "power1.inOut" }, 6.8);
  // ⑧ 迸发（9.0 零点 · #37 迭代二·涟漪版）：吸气暗场半拍 → 字单次回弹+中心柔光
  //    + 单道涟漪波向外推进（背景被径向折射顶起再落回 = 立体水波）→ 尘埃落定
  //    无闪白/无光屑/无放射光芒/无震屏/无余烬点点/无余波。
  tl.to(dim, { a: 1, duration: .2, ease: "power3.in" }, 8.78);              // 吸气：全场压暗一拍
  tl.to(scl, { s: .972, duration: .22, ease: "power2.in", overwrite: "auto" }, 8.78);
  tl.set(dim, { a: 0 }, 9.0);
  tl.to(burst, { t: 1, duration: 2.4, ease: "power2.out" }, 9.0);           // 单道涟漪波（折射+受光）
  tl.to(scl, { s: 1.025, duration: .13, ease: "power4.out", overwrite: "auto" }, 9.0);  // 字回弹（单次）
  tl.to(scl, { s: 1, duration: .8, ease: "power2.inOut", overwrite: "auto" }, 9.13);    // 平滑落定，无余摆
  tl.to(heat, { v: 0, duration: 1.0, ease: "power2.out" }, 9.06);
  // ⑨ 小标语「印刷擦除」：发光长条(印刷头)从左到右扫过，像擦黑板一样把字"擦出来"
  //    （承接迸发的能量——印刷头就是一粒凝缩的光）
  var wipe = { p: 0 };
  tl.add(function () { if (tag) { tag.style.opacity = "1"; tag.style.transform = "none"; } }, 10.15);
  if (tagInner && tagWiper) {
    tl.to(tagWiper, { opacity: 1, duration: 0.18, ease: "power1.out" }, 10.2);
    tl.to(wipe, {
      p: 1, duration: 1.15, ease: "power2.inOut",
      onUpdate: function () {
        var pct = wipe.p * 100;
        tagInner.style.clipPath = "inset(-35% " + (100 - pct) + "% -35% -8%)";
        tagWiper.style.left = pct + "%";
      }
    }, 10.25);
    tl.to(tagWiper, { opacity: 0, duration: 0.3, ease: "power1.in" }, 11.35);
  }
  // ⑩ 印刷完成后：电流脉冲 + 两侧细线亮起 + 左上 lockup 现身（#23：开幕收尾才出现）。
  //    滚动也在这里提前交还（时间线尾巴只剩余烬熄灭，不让用户白等）
  tl.add(function () {
    if (tag) { tag.classList.add("reel__tag--electric"); tag.classList.add("lines-on"); }
    showLockup();
    unlockScroll();
    if (skip) skip.style.display = "none";
  }, 11.55);

  /* ---------- 首次点击：开始运动 + 起 BGM（同一手势，天然同步） ---------- */
  var started = false;
  function start() {
    if (started) return; started = true;
    document.documentElement.classList.remove("cur-gate");
    if (scrollLocked) document.documentElement.classList.add("cur-reel");  // 蒙太奇：环隐身只留点（T22）
    buildTargets();   // 点击时 Noto 900 子集多半已就绪 → 重采样让粒子字形/标题用上真·黑体（失败回退系统字）
    if (gate) gsap.to(gate, { opacity: 0, duration: 0.4, ease: "power2.out", onComplete: function () { gate.style.display = "none"; } });
    if (skip) skip.style.display = "";
    tl.play();
    if (window.__bgmPlay) window.__bgmPlay();   // 与运动同一时刻起音乐
    detach();
  }
  var startEvents = ["pointerdown", "touchstart", "keydown", "click"];
  function detach() { startEvents.forEach(function (ev) { window.removeEventListener(ev, start); }); }
  startEvents.forEach(function (ev) { window.addEventListener(ev, start, { passive: true }); });

  /* ---------- 跳过（点击后才出现） ---------- */
  function finish() {
    tl.progress(1);            // 跑到结尾（progress 跳转抑制回调，下面手动补齐终态）
    running = false;
    unlockScroll();
    showLockup();
    sharpenFinal();            // 直接定格纯白实心「树成林」（高 DPR 补渲，canvas 字＝标题）
    if (tag) {
      tag.classList.remove("reel__tag--electric");
      tag.classList.add("lines-on");
      tag.style.opacity = "1"; tag.style.transform = "none";
      if (tagInner) tagInner.style.clipPath = "none";
      if (tagWiper) tagWiper.style.opacity = "0";
    }
    gsap.set(stage, { opacity: 0 });
    if (skip) skip.style.display = "none";
  }
  if (skip) skip.addEventListener("click", function (e) { e.stopPropagation(); finish(); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) gsap.ticker.lagSmoothing(0);
  });

  window._reelMotion = tl;   // QA 调试用（完成后移除）
})();

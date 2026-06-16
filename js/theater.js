/* ============================================================
   《希望》 · 网站篇章剧场 theater.js（#31 · #35 · #41）
   ------------------------------------------------------------
   把「网站」轮从滚动列表改成 **pin 锁滚剧场**：
   滚动条被钉住，滚动量驱动原地换幕。每幕节拍——
     ① 刷新波把画面盖住（暗场）——旧画面同步「死亡」（压暗/挤压/过曝）
        = 整个画面都在形变，不是一条线扫过（#35）
     ② 暗场上打字机敲出作品名大字 + 说明
     ③ 大字「变形引出」：整行飞向左上角落定成场记牌
     ④ #41 过场：纯黑一拍（空间真空）→ 媒体先行起播 → 换片光斑闪一帧
        → 刷新波揭开时世界已在运转 = 硬切进入下一个空间（零下滑）
   五种刷新波按幕轮换（#35：删激光；圆环系被用户否决后全面改波浪型）：
     mosaic 倾斜马赛克（对角扩散瓦阵吞噬画面）
     blinds 百叶翻转（横向板条交替合拢，画面被纵向挤压）
     falls  瀑布帘（竖条倾泻，画面被冲糊）
     ocean  海浪扫覆（正弦浪沿整幅扫过+朱砂浪尖，揭幕＝浪退）
     tide   双浪合幕（上下两道浪边夹合，揭幕＝向两侧分开）
   尾接 #belt 潮汐衔接段（整幅波带随 scrub 扫过视口）。
   ------------------------------------------------------------
   降级：reduced-motion / 无 GSAP → main.js 渲染旧列表，本文件不跑；
        #belt 无动画时保持 CSS 静态外观。
   旋钮：SCENE_VH 每幕滚动行程 / 节拍常量 BEAT（cut=黑场一拍时长）/
        瓦片网格 GRID / 百叶数 BLIND_N / 烧蚀斑 BURN_N / 打字步进 TYPE_STEP /
        潮汐衔接几何在 initBelt（SEG/FREQ/带厚/行程）。
   ============================================================ */
(function () {
  "use strict";

  var gsap = window.gsap, ST = window.ScrollTrigger;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var box = document.querySelector('[data-works="websites"][data-theater]');

  /* ---------- 旋钮 ---------- */
  var SCENE_VH  = 86;     // 每幕滚动行程（vh）
  var TYPE_STEP = .062;   // 打字机步进（秒/字）
  var GRID_R = 9, GRID_C = 16;          // 马赛克行列
  var FALL_N = 14;                      // 瀑布竖条数
  var BLIND_N = 10;                     // 百叶板条数
  var WAVE_PTS = 26;                    // 浪沿采样点数（越多越圆滑）
  var BEAT = { cover: .62, hold: .4, fly: .55, cut: .18, uncover: .72 };

  /* ================= #34 潮汐衔接（整幅波带扫过视口，替代传送带·P34v2） =================
     前浪(deep+foam) 与 背浪(back) 差速推进=纵深视差；clip-path 正弦双边带，
     纯函数 f(progress) 完全可逆。无轨道无标题——章节交界是一道涌过去的浪。 */
  function initBelt() {
    var belt = document.getElementById("belt");
    if (!belt || !gsap || !ST || reduced) return;
    var deep = belt.querySelector(".belt__deep"),
        foam = belt.querySelector(".belt__foam"),
        back = belt.querySelector(".belt__back");
    if (!deep || !foam) return;
    var SEG = 26, FREQ = 1.15;
    function edge(pts, base, A, ph, dir) {       // 一条正弦边（dir=1 左→右 / -1 右→左）
      for (var i = 0; i <= SEG; i++) {
        var x = dir > 0 ? i / SEG : 1 - i / SEG;
        var y = base + A * Math.sin(6.2832 * (x * FREQ + ph));
        pts.push((x * 100).toFixed(2) + "% " + y.toFixed(2) + "%");
      }
    }
    function band(lead, th, A, ph, parallel) {   // 上下两条正弦边围成的波带
      var pts = [];
      edge(pts, lead, A, ph, 1);
      // parallel=等宽（泡沫细线必须同相，否则相位差让"线"胀成色块，实测踩中）
      if (parallel) edge(pts, lead + th, A, ph, -1);
      else edge(pts, lead + th, A * .8, ph + .42, -1);
      return "polygon(" + pts.join(",") + ")";
    }
    function place(el2, lead, th) {              // 受光渐变跟随波带（顶=波峰上方 9% 余量）
      var sizeH = th + 18;
      el2.style.backgroundSize = "100% " + sizeH + "%";
      var denom = 100 - sizeH;
      el2.style.backgroundPosition = "0 " + (denom ? ((lead - 9) / denom * 100).toFixed(2) : "0") + "%";
    }
    function render(p) {
      var drift = p * 1.7;                       // 相位横流：浪一边推进一边横涌
      var breathe = 1 + .45 * Math.sin(p * Math.PI);  // 中段振幅呼吸
      var lead = 112 - 200 * p;                  // 前浪波峰：视口下方 → 越过顶部
      var leadB = 118 - 186 * p;                 // 背浪慢半拍 → 纵深
      var A = 4.4 * breathe;                     // #46 行程变短，振幅补存在感
      deep.style.clipPath = band(lead, 58, A, drift);
      place(deep, lead, 58);
      foam.style.clipPath = band(lead - .35, 1.25, A, drift, true);
      if (back) {
        back.style.clipPath = band(leadB, 64, 5.2 * breathe, -drift * .7 + .3);
        place(back, leadB, 64);
      }
    }
    render(0);
    belt.classList.add("on");                    // CSS 门控：JS 活了才显形（降级=空白呼吸段）
    ST.create({ trigger: belt, start: "top bottom", end: "bottom top", scrub: true,
      onUpdate: function (self) { render(self.progress); } });
  }

  /* ================= 剧场 ================= */
  if (!box || !gsap || !ST || reduced || !window.__theaterMode) { initBelt(); return; }
  var works = (window.WORKS || {}).websites || [];
  if (!works.length) { initBelt(); return; }
  var N = works.length;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function isVideo(src) { return /\.(mp4|webm|mov)$/i.test(src || ""); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function slug(name) {
    return (name || "site").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "shuchenglin";
  }

  /* ---------- 搭台 ---------- */
  box.classList.add("theater");
  var stage = el("div", "theater__stage");

  // 舞台中央：浏览器框（复用全站样式）
  var viewer = el("div", "theater__viewer");
  var browser = el("div", "browser");
  var bar = el("div", "browser__bar");
  bar.appendChild(el("i")); bar.appendChild(el("i")); bar.appendChild(el("i"));
  var url = el("div", "browser__url", "");
  bar.appendChild(url);
  var view = el("div", "browser__view theater__view");
  browser.appendChild(bar); browser.appendChild(view);
  viewer.appendChild(browser);

  // 打字机大字层（暗场主角）
  var type = el("div", "theater__type");
  var tKick = el("p", "theater__type-kick", "");
  var tName = el("p", "theater__type-name", "");
  var tSub  = el("p", "theater__type-sub", "");
  type.appendChild(tKick); type.appendChild(tName); type.appendChild(tSub);

  // 场记牌（大字的落点 · 左上）
  var slate = el("div", "theater__slate");
  var sNo = el("span", "theater__slate-no", "");
  var sName = el("span", "theater__slate-name", "");
  slate.appendChild(sNo); slate.appendChild(sName);

  // 五种刷新波 overlay
  var wave = el("div", "theater__wave");
  var mosaic = el("div", "wv wv--mosaic");
  for (var i = 0; i < GRID_R * GRID_C; i++) {
    var b = el("b");
    if (Math.random() < .06) b.className = "ac";   // 少量朱砂瓦点缀
    mosaic.appendChild(b);
  }
  var falls = el("div", "wv wv--falls");
  for (var j = 0; j < FALL_N; j++) falls.appendChild(el("b"));
  var blinds = el("div", "wv wv--blinds");
  for (var k = 0; k < BLIND_N; k++) blinds.appendChild(el("b"));
  var ocean = el("div", "wv wv--ocean");
  var sea = el("b", "wv-sea"), foam = el("i", "wv-foam");
  ocean.appendChild(sea); ocean.appendChild(foam);
  var tide = el("div", "wv wv--tide");
  var seaT = el("b", "wv-sea"), seaB = el("b", "wv-sea");
  var foamT = el("i", "wv-foam"), foamB = el("i", "wv-foam");
  tide.appendChild(seaT); tide.appendChild(seaB);
  tide.appendChild(foamT); tide.appendChild(foamB);
  wave.appendChild(mosaic); wave.appendChild(falls); wave.appendChild(blinds);
  wave.appendChild(ocean); wave.appendChild(tide);

  // 换片光斑（#41：揭幕瞬间闪一帧，放映机换片的光痕）
  var leak = el("i", "theater__leak");

  // 进度点 + 滚动提示
  var prog = el("div", "theater__progress");
  var dots = works.map(function (_, k2) { var d = el("i"); prog.appendChild(d); return d; });
  var cue = el("div", "theater__cue", "滚动 · 继续放映 ↓");

  stage.appendChild(viewer); stage.appendChild(wave); stage.appendChild(leak);
  // #46b 场记牌挂在浏览器框自身的左上角外侧（像搭在画框上的场记板）——
  // 跟随框定位，任何视口比例都不会再压到作品上（旧方案钉在 stage 左上，矮视口必重叠）
  viewer.appendChild(slate);
  stage.appendChild(type); stage.appendChild(prog); stage.appendChild(cue);
  box.appendChild(stage);

  // viewer 定位交给 GSAP（与 CSS translate(-50%,-50%) 等价），后续 scale/filter 干净叠加
  gsap.set(viewer, { xPercent: -50, yPercent: -50, x: 0, y: 0 });

  /* ---------- 媒体（单 buffer：换片都发生在暗场盖幕下） ---------- */
  var media = null;
  function setMedia(idx) {
    if (media) { if (media.tagName === "VIDEO") media.pause(); media.remove(); }
    var src = works[idx].src;
    if (isVideo(src)) {
      media = el("video");
      media.muted = true; media.loop = true; media.playsInline = true;
      media.setAttribute("muted", ""); media.setAttribute("playsinline", "");
      media.poster = src.replace(/\.(mp4|webm|mov)$/i, ".poster.jpg");   // 慢网：揭幕时数据未到先亮静帧
      media.preload = "auto"; media.src = src;
    } else {
      media = el("img");
      media.alt = works[idx].name || ""; media.src = src;
    }
    media.className = "theater__media";
    view.appendChild(media);
    url.textContent = "https://" + slug(works[idx].name);
  }
  function playMedia() { if (media && media.tagName === "VIDEO") { var p = media.play(); if (p && p.catch) p.catch(function () {}); } }
  function pauseMedia() { if (media && media.tagName === "VIDEO") media.pause(); }
  // 预热下一幕素材
  var warmed = {};
  function warm(idx) {
    if (idx < 0 || idx >= N || warmed[idx]) return;
    warmed[idx] = true;
    var src = works[idx].src;
    if (isVideo(src)) {
      var v = document.createElement("video"); v.preload = "auto"; v.muted = true; v.src = src;
      var pim = new Image(); pim.src = src.replace(/\.(mp4|webm|mov)$/i, ".poster.jpg");   // 海报帧一并预热
    }
    else { var im = new Image(); im.src = src; }
  }

  /* ---------- 打字机（visibility 拆字 + 朱砂光标条） ---------- */
  var typebar = el("i", "theater__typebar");
  function buildType(idx, tl, at) {
    tl.call(function () {
      tKick.textContent = "NO." + pad2(idx + 1) + " / WEBSITE";
      tSub.textContent = works[idx].highlight || "";
      if (window.__cjkWbr) { delete tSub.dataset.cjk; window.__cjkWbr(tSub); }   // #42 词级断行（每幕换文案后重跑）
      tName.innerHTML = "";
      String(works[idx].name || "").split("").forEach(function (ch) {
        var s = el("span", "tch", ch === " " ? "&nbsp;" : ch);
        tName.appendChild(s);
      });
      tName.appendChild(typebar);
      gsap.set(type, { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" });
      gsap.set([tKick, tSub], { opacity: 0, y: 12 });
      gsap.set(tName.querySelectorAll(".tch"), { visibility: "hidden" });
      gsap.set(typebar, { opacity: 1 });
    }, null, at);
    tl.to(tKick, { opacity: 1, y: 0, duration: .4, ease: "power2.out" }, at + .05);
    // 逐字步进（visibility 占位不抖行）
    var nameLen = String(works[idx].name || "").length;
    for (var k2 = 0; k2 < nameLen; k2++) {
      (function (k3) {
        tl.call(function () {
          var chs = tName.querySelectorAll(".tch");
          if (chs[k3]) { chs[k3].style.visibility = "visible"; tName.appendChild(typebar); }
        }, null, at + .3 + k3 * TYPE_STEP);
      })(k2);
    }
    var tEnd = at + .3 + nameLen * TYPE_STEP;
    tl.to(tSub, { opacity: 1, y: 0, duration: .5, ease: "power2.out" }, tEnd + .12);
    return tEnd + .12 + .35;
  }

  /* ---------- 变形引出：大字整行飞向左上场记牌 ----------
     全部内联主时间线（无嵌套 timeline）：函数式取值在播放时刻才量测落点，
     progress(1) 快进时也能瞬间到达正确终态（竞态安全）。 */
  function flyToSlate(idx, tl, at) {
    var sc = .3;
    tl.call(function () { gsap.set(typebar, { opacity: 0 }); }, null, at);
    tl.to(tSub, { opacity: 0, y: -8, duration: .25, ease: "power2.in" }, at);
    tl.to(tKick, { opacity: 0, duration: .2 }, at);
    tl.to(type, {
      x: function () {
        var tr = tName.getBoundingClientRect(), sr = slate.getBoundingClientRect();
        return sr.left - tr.left - tr.width * (1 - sc) / 2;
      },
      y: function () {
        var tr = tName.getBoundingClientRect(), sr = slate.getBoundingClientRect();
        return sr.top - tr.top - tr.height * (1 - sc) / 2;
      },
      scale: sc, duration: BEAT.fly, ease: "power3.inOut"
    }, at + .02);
    tl.to(type, { filter: "blur(3px)", duration: BEAT.fly * .5, yoyo: true, repeat: 1 }, at + .02);
    tl.to(type, { opacity: 0, duration: .12 }, at + .02 + BEAT.fly - .1);
    tl.call(function () {
      sNo.textContent = "NO." + pad2(idx + 1);
      sName.textContent = works[idx].name || "";
      slate.classList.add("on");
    }, null, at + .02 + BEAT.fly - .08);
    return at + BEAT.fly + .1;
  }

  /* ---------- 五种刷新波 ----------
     #35 原则：盖场不是「遮住」而是「画面死亡」——每种波同步给 viewer 一段
     形变（frameDie），让整幅画面参与转场；揭幕侧的入场统一交给 #41 过场。 */
  /* 浪沿几何：用 clip-path polygon 实时算正弦浪边（q=行程 0..1）。
     sea = 从画面顶部盖到浪沿的黑幕；foam = 跟着浪沿走的朱砂浪尖细带。 */
  function wavePoly(q, flip) {
    var base = -14 + q * 128;                       // 浪基线 -14% → 114%（保证全盖/全离场）
    if (flip) base = 114 - q * 128;                 // 翻转：从底部往上
    var A = 5.5 * (1 - Math.abs(2 * q - 1) * .3);   // 振幅随行程呼吸
    var ph = q * 4.6;                               // 相位推进＝浪在横向流动
    var edge = [], crestA = [], crestB = [];
    for (var x = 0; x <= WAVE_PTS; x++) {
      var px = x / WAVE_PTS * 100;
      var py = base + A * Math.sin(px / 100 * Math.PI * 3.1 + ph);
      edge.push(px.toFixed(1) + "% " + py.toFixed(2) + "%");
      crestA.push(px.toFixed(1) + "% " + (py - 1.5).toFixed(2) + "%");
      crestB.push(px.toFixed(1) + "% " + (py + 1.5).toFixed(2) + "%");
    }
    var seaPoly = flip
      ? "polygon(0% 120%, 100% 120%, " + edge.slice().reverse().join(",") + ")"
      : "polygon(0% -20%, 100% -20%, " + edge.slice().reverse().join(",") + ")";
    var foamPoly = "polygon(" + crestA.join(",") + "," + crestB.slice().reverse().join(",") + ")";
    return [seaPoly, foamPoly];
  }
  function setWave(seaEl, foamEl, q, flip) {
    var p = wavePoly(q, flip);
    seaEl.style.clipPath = p[0]; seaEl.style.webkitClipPath = p[0];
    foamEl.style.clipPath = p[1]; foamEl.style.webkitClipPath = p[1];
  }
  // 浪行程代理（模块级·硬复位可 killTweensOf）
  var oceanP = { q: 0 }, tideP = { q: 0 };

  function frameDie(tl, at, kind) {
    var to = { duration: BEAT.cover, ease: "power2.in", overwrite: "auto" };
    if (kind === "mosaic")      { to.scale = .982; to.filter = "brightness(.5) saturate(.65)"; }
    else if (kind === "falls")  { to.scaleY = 1.05; to.filter = "brightness(.55) blur(5px)"; }
    else if (kind === "blinds") { to.scaleY = .952; to.filter = "brightness(.5) contrast(1.12)"; }
    else if (kind === "ocean")  { to.y = 14; to.scaleY = 1.05; to.filter = "brightness(.5) blur(4px)"; }   // 被浪卷走
    else                        { to.scaleY = .94; to.filter = "brightness(.5)"; }                          // tide：被上下夹合
    tl.to(viewer, to, at);
  }

  // a. 马赛克：对角扩散瓦阵吞噬画面
  function coverMosaic(tl, at) {
    tl.set(mosaic, { display: "grid" }, at);
    frameDie(tl, at, "mosaic");
    tl.fromTo(mosaic.children, { scale: 0 },
      { scale: 1.04, duration: .4, ease: "power2.out",
        stagger: { each: .012, grid: [GRID_R, GRID_C], from: 0 } }, at);
    return at + BEAT.cover + .35;
  }
  function uncoverMosaic(tl, at) {
    tl.to(mosaic.children, { scale: 0, duration: .4, ease: "power2.in",
      stagger: { each: .012, grid: [GRID_R, GRID_C], from: GRID_R * GRID_C - 1 } }, at);
    tl.set(mosaic, { display: "none" }, at + BEAT.uncover + .4);
    return at + BEAT.uncover + .4;
  }
  function presetMosaic() {
    gsap.set(mosaic, { display: "grid" });
    gsap.set(mosaic.children, { scale: 1.04 });
  }

  // b. 瀑布帘：竖条倾泻，画面被冲糊
  function coverFalls(tl, at) {
    tl.set(falls, { display: "flex" }, at);
    frameDie(tl, at, "falls");
    tl.fromTo(falls.children, { yPercent: -101 },
      { yPercent: 0, duration: .5, ease: "power2.in",
        stagger: { each: .035, from: "random" } }, at);
    return at + BEAT.cover + .4;
  }
  function uncoverFalls(tl, at) {
    tl.to(falls.children, { yPercent: 101, duration: .55, ease: "power2.in",
      stagger: { each: .035, from: "random" } }, at);
    tl.set(falls, { display: "none" }, at + BEAT.uncover + .5);
    return at + BEAT.uncover + .5;
  }

  // c. 百叶翻转：横向板条交替合拢，画面被纵向挤压（新 · #35）
  function coverBlinds(tl, at) {
    tl.set(blinds, { display: "flex" }, at);
    frameDie(tl, at, "blinds");
    tl.fromTo(blinds.children, { scaleY: 0 },
      { scaleY: 1.02, duration: .42, ease: "power3.out",
        transformOrigin: function (i2) { return i2 % 2 ? "50% 0%" : "50% 100%"; },
        stagger: { each: .045, from: "center" } }, at);
    return at + BEAT.cover + .35;
  }
  function uncoverBlinds(tl, at) {
    tl.to(blinds.children, { scaleY: 0, duration: .5, ease: "power3.inOut",
      transformOrigin: function (i2) { return i2 % 2 ? "50% 100%" : "50% 0%"; },
      stagger: { each: .05, from: "edges" } }, at);
    tl.set(blinds, { display: "none" }, at + BEAT.uncover + .5);
    return at + BEAT.uncover + .5;
  }

  // d. 海浪扫覆：正弦浪沿从上扫覆整幅画面，揭幕＝浪退（#35 波浪型）
  function coverOcean(tl, at) {
    tl.set(ocean, { display: "block" }, at);
    tl.call(function () { oceanP.q = 0; setWave(sea, foam, 0, false); }, null, at);
    frameDie(tl, at, "ocean");
    tl.to(oceanP, { q: 1, duration: .68, ease: "power2.inOut",
      onUpdate: function () { setWave(sea, foam, oceanP.q, false); } }, at + .02);
    return at + BEAT.cover + .3;
  }
  function uncoverOcean(tl, at) {
    tl.call(function () { oceanP.q = 1; setWave(sea, foam, 1, false); }, null, at);
    tl.to(oceanP, { q: 0, duration: .78, ease: "power2.inOut",
      onUpdate: function () { setWave(sea, foam, oceanP.q, false); } }, at + .02);
    tl.set(ocean, { display: "none" }, at + .85);
    return at + .85;
  }

  // e. 双浪合幕：上下两道浪边夹合，揭幕＝向上下分开（#35 波浪型）
  function setTide(q) {
    var qq = Math.max(0, Math.min(1, q));
    var pT = wavePoly(qq * .54, false);          // 上浪：基线推进到 ~55%
    var pB = wavePoly(qq * .54, true);           // 下浪：从底部往上推进
    seaT.style.clipPath = pT[0]; seaT.style.webkitClipPath = pT[0];
    foamT.style.clipPath = pT[1]; foamT.style.webkitClipPath = pT[1];
    seaB.style.clipPath = pB[0]; seaB.style.webkitClipPath = pB[0];
    foamB.style.clipPath = pB[1]; foamB.style.webkitClipPath = pB[1];
  }
  function coverTide(tl, at) {
    tl.set(tide, { display: "block" }, at);
    tl.call(function () { tideP.q = 0; setTide(0); }, null, at);
    frameDie(tl, at, "tide");
    tl.to(tideP, { q: 1.02, duration: .62, ease: "power2.inOut",
      onUpdate: function () { setTide(tideP.q); } }, at + .02);
    return at + BEAT.cover + .25;
  }
  function uncoverTide(tl, at) {
    tl.call(function () { tideP.q = 1.02; setTide(1.02); }, null, at);
    tl.to(tideP, { q: 0, duration: .72, ease: "power2.inOut",
      onUpdate: function () { setTide(tideP.q); } }, at + .02);
    tl.set(tide, { display: "none" }, at + .8);
    return at + .8;
  }

  var WAVES = [
    { key: "mosaic", preset: presetMosaic, cover: coverMosaic, uncover: uncoverMosaic },
    { key: "blinds", cover: coverBlinds, uncover: uncoverBlinds },
    { key: "falls",  cover: coverFalls,  uncover: uncoverFalls },
    { key: "ocean",  cover: coverOcean,  uncover: uncoverOcean },
    { key: "tide",   cover: coverTide,   uncover: uncoverTide }
  ];

  /* ---------- 幕状态机 ---------- */
  var cur = -1, playing = null, pending = null;

  function playScene(idx, first) {
    var w = WAVES[idx % WAVES.length];

    // 硬复位（必须在本幕 tl 构建之前！killTweensOf 会连未播放的同目标子 tween 一起杀，
    // 放进 tl 的 call 里会把本幕自己的飞行/刷新波全部杀掉——实测踩坑 L22）
    gsap.killTweensOf([type, viewer, leak, oceanP, tideP]);
    gsap.killTweensOf(mosaic.children); gsap.killTweensOf(falls.children);
    gsap.killTweensOf(blinds.children);
    mosaic.classList.remove("curtain");   // #45 开演：幕布态朱砂暗纹渐变回满血（css transition .8s）
    gsap.set([mosaic, falls, blinds, ocean, tide], { display: "none" });
    gsap.set(leak, { opacity: 0 });
    gsap.set(viewer, { scale: 1, scaleY: 1, x: 0, y: 0, filter: "none" });
    // type 层归位也必须在硬复位里做（不能只靠 buildType 的 tl.call）——
    // 否则被快进/杀掉的幕会留下飞行残留 transform，下一幕打字机会在场记牌位置打字（实测踩中）
    gsap.set(type, { opacity: 0, x: 0, y: 0, scale: 1, filter: "blur(0px)" });
    gsap.set(typebar, { opacity: 0 });

    var tl = gsap.timeline({ onComplete: function () {
      playing = null;
      if (pending != null && pending !== cur) { var p = pending; pending = null; playScene(p); }
      else pending = null;
    }});
    playing = tl;

    var t = 0;
    tl.call(function () { slate.classList.remove("on"); pauseMedia(); }, null, 0);
    if (first) {
      // 首幕：直接以满盖状态起步（无旧画面可擦）
      tl.call(function () { WAVES[0].preset(); }, null, 0);
      t = .1;
    } else {
      t = w.cover(tl, 0);
    }
    tl.call(function () { setMedia(idx); warm(idx + 1); warm(idx - 1); }, null, t - .05);
    t = buildType(idx, tl, t + .05);
    t += BEAT.hold;
    var tFly = flyToSlate(idx, tl, t);

    /* —— #41 标题→作品过渡 ——
       场记牌落定 → 纯黑一拍（BEAT.cut，空间真空）→ 媒体先行起播（揭开时世界
       已在运转）→ 换片光斑闪一帧 → 刷新波揭幕 + viewer 从 1.028/暗 沉降到位。
       全程无任何 y 位移（#41：下滑有顿感，禁用）。 */
    var tCut = tFly + BEAT.cut;
    tl.call(playMedia, null, tCut - .08);
    tl.fromTo(leak, { opacity: 0 }, { opacity: .2, duration: .07, ease: "power1.in" }, tCut);
    tl.to(leak, { opacity: 0, duration: .32, ease: "power2.out" }, tCut + .07);
    tl.fromTo(viewer, { scale: 1.028, y: 0, filter: "brightness(.7)" },
      { scale: 1, y: 0, filter: "brightness(1)", duration: .75, ease: "power3.out",
        onComplete: function () { gsap.set(viewer, { clearProps: "filter" }); } }, tCut);
    var wUn = first ? WAVES[0] : w;
    var tUn = wUn.uncover(tl, tCut);
    tl.call(function () {
      dots.forEach(function (d, k4) { d.classList.toggle("on", k4 === idx); });
      if (idx === 0) gsap.to(cue, { opacity: .9, duration: .6, delay: .4 });
      else gsap.set(cue, { opacity: 0 });
    }, null, tUn);
    cur = idx;
  }

  function requestScene(idx) {
    if (idx === cur && !playing) return;
    if (playing) {
      if (idx === cur && pending == null) return;
      pending = idx;
      playing.progress(1, false);   // 快进当前幕；L4：必须传 suppressEvents=false，否则 call()（换片/场记牌）全被吞
      return;
    }
    playScene(idx, cur === -1);
  }

  /* ---------- pin + 滚动驱动 ---------- */
  ST.create({
    trigger: box,
    start: "top top",
    // 注意：ST 的 end 字符串不解析 vh 单位（"+=602vh"→602px！）→ 必须函数算 px（L20）
    end: function () { return "+=" + Math.round(N * SCENE_VH / 100 * window.innerHeight); },
    invalidateOnRefresh: true,
    pin: stage,
    anticipatePin: 1,
    onUpdate: function (self) {
      var raw = self.progress * N;
      var idx = Math.max(0, Math.min(N - 1, Math.floor(raw)));
      if (cur === -1) { requestScene(idx); return; }
      if (idx === cur) return;
      // 迟滞带：越过幕边界 6% 幕宽才真切换（免疫 ST.refresh/微滚动的 progress 抖动，L21）
      if (idx > cur && raw < idx + .06) return;
      if (idx < cur && raw > idx + .94) return;
      requestScene(idx);
    },
    // ⚠️ 不可硬编码 requestScene(0)：快速滚动深入 pin 区时 onUpdate（按 progress 算出真实幕号）
    // 与 onEnter 同帧先后触发，硬编码 0 会与之互相快进 → 连环 FF 级联（实测踩中）
    onEnter: function (self) {
      var idx = Math.max(0, Math.min(N - 1, Math.floor(self.progress * N)));
      requestScene(idx);
    },
    onLeave: function () { pauseMedia(); },
    onEnterBack: function () { playMedia(); },
    onLeaveBack: function () { pauseMedia(); }
  });
  warm(0); warm(1);

  /* #45 开演前的「幕布」：剧场未开演时不是一屏黑洞滑上来，而是盖好的瓦片幕布
     （朱砂瓦退成暗纹=curtain 态，避免静止大色块）；接近 pin 的过程中幕布渐亮
     （=灯光亮起，亮度而非透明度——半透明会让底下的空浏览器框透出来），
     首幕打字机直接在幕布上开打，标题段→剧场全程连续，没有"画面直接切了"的断口。 */
  presetMosaic();
  mosaic.classList.add("curtain");
  gsap.fromTo(mosaic, { filter: "brightness(.55)" }, {
    filter: "brightness(1)", ease: "none",
    scrollTrigger: { trigger: box, start: "top 95%", end: "top top", scrub: true }
  });

  // QA 调试句柄（无副作用，只读）
  window.__theaterDebug = {
    get cur() { return cur; },
    get playing() { return !!playing; },
    get progress() { return playing ? playing.progress() : 1; }
  };

  /* 懒加载素材完成会撑高上游文档 → pin 起点漂移；捕获 load/loadeddata 防抖 refresh。
     ⚠️ 必须过滤不占文档流高度的区域（剧场/胶卷流/旋涡）——尤其剧场自己换片的 load
     会触发 refresh → progress 跳变 → 再切幕 → 再换片……自激振荡（用户实测踩中，L21）。 */
  var refT = null;
  function lazyRefresh(e) {
    var t = e.target;
    if (t && t.closest && t.closest("[data-theater], .film, .vortex, .reel")) return;
    clearTimeout(refT);
    refT = setTimeout(function () {
      if (playing) { lazyRefresh(e); return; }   // 转场播放中不动 pin，停稳再算
      ST.refresh();
    }, 350);
  }
  document.addEventListener("load", lazyRefresh, true);        // img（capture 捕非冒泡事件）
  document.addEventListener("loadeddata", lazyRefresh, true);  // video

  initBelt();
})();

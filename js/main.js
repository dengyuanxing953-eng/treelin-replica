/* ============================================================
   《希望》驱动引擎
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);

  /* ---------- 工具 ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function isVideo(src) { return /\.(mp4|webm|mov)$/i.test(src || ""); }
  function isImg(src)   { return /\.(jpe?g|png|webp|gif|avif)$/i.test(src || ""); }
  function pad2(n)      { return (n < 10 ? "0" : "") + n; }

  /* ---------- #42 中文断行（词级）----------
     拆字特效把每个字变成 inline-block 后，中文禁则（标点不上行首）和
     词的完整性全部失效；普通段落也可能在词中间断开（「写真」→「写/真」）。
     方案：Intl.Segmenter 按词切分——
       · splitChars()  拆字特效改「词组(nowrap) > 字」两层，断行只发生在词边界
       · cjkWbr()      普通段落按词插 <wbr> + keep-all，词内不断、词间可断 */
  var CJK_SEG = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter("zh", { granularity: "word" }) : null;
  var CJK_PUNCT = /^[，。？！、；：…—·）》〉」』”’%‰]+$/;
  function cjkWords(text) {
    var parts = CJK_SEG
      ? Array.from(CJK_SEG.segment(text)).map(function (s) { return s.segment; })
      : Array.from(text);                                   // 兜底：逐字（标点仍并入前字=禁则可用）
    var out = [];
    parts.forEach(function (w) {
      if (out.length && CJK_PUNCT.test(w)) out[out.length - 1] += w;
      else out.push(w);
    });
    return out;
  }
  function splitChars(line, cls) {
    // 三层：子句(chcl·整体换行,宽过整行才内部折) > 词组(chgrp·nowrap) > 字(ch)
    // 断行优先级 = 标点后 > 词边界 > 永不词中断
    var words = cjkWords(line.textContent);
    line.textContent = "";
    var clause = null;
    words.forEach(function (wd) {
      if (!clause) { clause = el("span", "chcl"); line.appendChild(clause); }
      if (!wd.trim()) { clause.appendChild(document.createTextNode(" ")); return; }
      var g = el("span", "chgrp");
      Array.from(wd).forEach(function (ch) {
        var s = el("span", cls);
        s.textContent = ch;
        g.appendChild(s);
      });
      clause.appendChild(g);
      if (/[，。？！；：…—、]$/.test(wd)) clause = null;   // 子句在标点后收口
    });
  }
  function cjkWbr(node) {
    if (!CJK_SEG || !node || node.dataset.cjk) return;
    node.dataset.cjk = "1";
    node.classList.add("cjk");
    Array.prototype.slice.call(node.childNodes).forEach(function (tn) {
      if (tn.nodeType !== 3 || !/[一-鿿]/.test(tn.data)) return;
      var frag = document.createDocumentFragment();
      var prev = "";
      cjkWords(tn.data).forEach(function (wd, i) {
        // NBSP( ) 是手工粘连（如「公众号·小红书」），接缝处不给 <wbr>
        if (i && wd.trim() && !/\u00A0$/.test(prev) && !/^\u00A0/.test(wd)) frag.appendChild(document.createElement("wbr"));
        frag.appendChild(document.createTextNode(wd));
        prev = wd;
      });
      node.replaceChild(frag, tn);
    });
  }
  window.__cjkWbr = cjkWbr;   // theater.js 的 type-sub 也用

  /* 占位图 */
  function placeholder(label, idx) {
    var ph = el("div", "ph");
    ph.appendChild(el("span", "ph__num", pad2(idx)));
    var box = el("div", "", "");
    box.style.position = "relative";
    box.appendChild(el("div", "ph__dot"));
    box.appendChild(el("div", "ph__label", label || "敬请期待"));
    ph.appendChild(box);
    return ph;
  }

  /* 懒加载媒体：<img>/<video>/<iframe>，src 存 data-src
     视频带海报帧（XX.poster.jpg 与视频同名同目录）：慢网下数据未到先看到作品静帧，
     海报也走 data-poster 懒加载（随 loadObs 一起设置），不抢首屏带宽 */
  function media(src, opts) {
    opts = opts || {};
    var node;
    if (isVideo(src)) {
      node = el("video");
      node.muted = true; node.loop = true; node.playsInline = true;
      node.setAttribute("playsinline", ""); node.setAttribute("muted", "");
      node.preload = "none";
      node.dataset.poster = src.replace(/\.(mp4|webm|mov)$/i, ".poster.jpg");
      node.dataset.src = src;
      node.dataset.video = "1";
    } else {
      node = el("img");
      node.alt = opts.alt || "";
      node.loading = "lazy";
      node.dataset.src = src;
    }
    if (opts.ratio) node.style.aspectRatio = opts.ratio;   // 自由尺寸瓦片：加载前锁占位高度
    return node;
  }

  /* ---------- 渲染四轮 ---------- */
  var W = window.WORKS || {};

  // 轮1 视觉（瀑布流）
  (function renderVisual() {
    var box = document.querySelector('[data-works="visual"]');
    if (!box) return;
    (W.visual || []).forEach(function (it, i) {
      var tile = el("div", "tile");
      if (it.span === "full") tile.classList.add("tile--full");   // #43 独占整行放大（影像档案馆压轴）
      if (it.src) tile.appendChild(media(it.src, { alt: it.name, ratio: it.ratio }));
      else { var p = placeholder(it.name, i + 1); tile.appendChild(p); }
      if (it.name || it.caption) {
        var cap = el("div", "cap");
        if (it.name) cap.appendChild(el("b", "", it.name));
        if (it.caption) cap.appendChild(el("span", "", it.caption));
        tile.appendChild(cap);
      }
      box.appendChild(tile);
    });
  })();

  // 轮2 网站（浏览器框）
  // #31：正常环境由 theater.js 剧场接管（pin 锁滚原地刷新）；此处仅作降级列表
  window.__theaterMode = hasGSAP && !prefersReduced;
  (function renderSites() {
    var box = document.querySelector('[data-works="websites"]');
    if (!box) return;
    if (window.__theaterMode && box.hasAttribute("data-theater")) return;   // 容器留给剧场
    (W.websites || []).forEach(function (it, i) {
      var row = el("div", "site");

      var browser = el("div", "browser");
      var bar = el("div", "browser__bar");
      bar.appendChild(el("i")); bar.appendChild(el("i")); bar.appendChild(el("i"));
      var url = el("div", "browser__url", it.iframe ? (it.name || "本地预览") : "https://" + slug(it.name));
      bar.appendChild(url);
      browser.appendChild(bar);

      var view = el("div", "browser__view");
      if (it.iframe) {
        view.appendChild(el("div", "browser__live", "LIVE"));
        var f = el("iframe");
        f.dataset.src = it.iframe;
        f.setAttribute("scrolling", "no");
        f.setAttribute("loading", "lazy");
        f.style.pointerEvents = "none";
        view.appendChild(f);
      } else if (it.src) {
        view.appendChild(media(it.src, { alt: it.name }));
      } else {
        view.appendChild(placeholder(it.name, i + 1));
      }
      browser.appendChild(view);
      row.appendChild(browser);

      var txt = el("div", "site__txt");
      txt.appendChild(el("div", "n", pad2(i + 1)));
      txt.appendChild(el("h3", "", it.name || ""));
      if (it.highlight) txt.appendChild(el("p", "", it.highlight));
      if (it.url) {
        var a = el("a", "visit");
        a.href = it.url; a.target = "_blank"; a.rel = "noopener";
        a.innerHTML = "访问 <i>→</i>";
        txt.appendChild(a);
      }
      row.appendChild(txt);
      box.appendChild(row);
    });
  })();

  // 轮3 产品（手机框）
  (function renderProducts() {
    var box = document.querySelector('[data-works="products"]');
    if (!box) return;
    (W.products || []).forEach(function (it, i) {
      var wide = !!it.wide;
      var wrap = el("div", wide ? "pwide" : "");
      if (wide) {
        // 横屏「游戏屏」卡片：16:9，承载网页游戏录屏，不裁画面
        var card = el("div", "gamecard");
        if (it.src) card.appendChild(media(it.src, { alt: it.name }));
        else card.appendChild(placeholder(it.name, i + 1));
        wrap.appendChild(card);
      } else {
        var phone = el("div", "phone");
        phone.appendChild(el("div", "phone__notch"));
        var screen = el("div", "phone__screen");
        if (it.src) screen.appendChild(media(it.src, { alt: it.name }));
        else screen.appendChild(placeholder(it.name, i + 1));
        phone.appendChild(screen);
        wrap.appendChild(phone);
      }

      var meta = el("div", "product__meta");
      if (it.tag) meta.appendChild(el("span", "tag", it.tag));
      meta.appendChild(el("b", "", it.name || ""));
      if (it.caption) meta.appendChild(el("span", "", it.caption));
      wrap.appendChild(meta);
      box.appendChild(wrap);
    });
  })();

  // 轮4 自动化（宽卡片）
  (function renderAutomation() {
    var box = document.querySelector('[data-works="automation"]');
    if (!box) return;
    (W.automation || []).forEach(function (it, i) {
      var card = el("div", "auto");
      var info = el("div", "auto__info");
      info.appendChild(el("div", "auto__n", pad2(i + 1)));
      var txt = el("div", "auto__txt");
      txt.appendChild(el("h3", "", it.title || ""));
      if (it.description) txt.appendChild(el("p", "", it.description));
      info.appendChild(txt);
      card.appendChild(info);
      var m = el("div", "auto__media");
      if (it.src) m.appendChild(media(it.src, { alt: it.title }));
      else m.appendChild(placeholder("", i + 1));
      card.appendChild(m);
      box.appendChild(card);
    });
  })();

  // #42：作品区全部说明文字按词断行（标题防孤字、词不拆断、「·」不落行首）
  document.querySelectorAll(
    ".cap b, .cap span, .site__txt h3, .site__txt p, .product__meta b, .product__meta span, .auto__txt h3, .auto__txt p"
  ).forEach(cjkWbr);

  function slug(name) {
    return (name || "site").replace(/\s+/g, "").toLowerCase() + ".treelin.dev";
  }

  /* ---------- 懒加载观察器 ----------
     rootMargin 1200px：慢网（大陆访问海外节点）下提前约一屏半开始下载，
     用户读叙事段的时间正好给媒体当下载窗口 */
  var loadObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var n = e.target, src = n.dataset.src;
      if (src) {
        if (n.tagName === "VIDEO") {
          if (n.dataset.poster) { n.poster = n.dataset.poster; n.removeAttribute("data-poster"); }
          n.src = src; n.load();
        }
        else { n.src = src; }
        n.removeAttribute("data-src");
      }
      loadObs.unobserve(n);
    });
  }, { rootMargin: "1200px 0px" });

  var playObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else v.pause();
    });
  }, { threshold: 0.2 });

  document.querySelectorAll("[data-src]").forEach(function (n) { loadObs.observe(n); });
  document.querySelectorAll("[data-video]").forEach(function (v) { playObs.observe(v); });

  // 活预览 iframe 滚离视口时暂停渲染（停掉它持续的动画开销，回到视口再恢复，不重载）
  // 注意：观察「容器」而非 iframe 本身——iframe 一旦 display:none 尺寸塌成 0，会永远无法再次进入视口
  var liveViews = document.querySelectorAll(".browser__view");
  if (liveViews.length) {
    var frameObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var f = e.target.querySelector("iframe");
        if (f) f.style.display = e.isIntersecting ? "" : "none";
      });
    }, { rootMargin: "200px 0px" });
    liveViews.forEach(function (v) { if (v.querySelector("iframe")) frameObs.observe(v); });
  }

  /* ============================================================
     无动效降级
     ============================================================ */
  if (!hasGSAP || prefersReduced) {
    document.querySelectorAll(".reveal,.reveal-but,.surge span,.surge__tail,.hope").forEach(function (n) {
      n.style.opacity = 1; n.style.transform = "none";
    });
    initSound();
    initProgressFallback();
    return;
  }

  document.documentElement.classList.add("js");
  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);

  /* ---------- Lenis 平滑滚动 ---------- */
  var lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.9 });
  window.lenis = lenis;   // 暴露给 reel.js（开屏锁滚动 stop/start）
  window.__lenis = lenis;
  lenis.on("scroll", ST.update);
  gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
  gsap.ticker.lagSmoothing(0);

  /* ---------- 特殊文字入场 ①：绝望段大句「逐字浮现」（拆字 + blur 渐显，特殊处理） ---------- */
  (function charEntrance() {
    var lines = gsap.utils.toArray("#void .line.big, #despair .line.big");
    lines.forEach(function (line) {
      line.classList.add("chsplit");                       // 标记：跳过通用整行揭示
      gsap.set(line, { opacity: 1 });                      // 父行翻开（覆盖 .js .reveal{opacity:0}），隐藏交给逐字
      splitChars(line, "ch");                              // #42：按词分组，断行只在词边界
    });
    if (!lines.length) return;
    gsap.set("#void .ch, #despair .ch", { opacity: 0, y: "0.5em", rotate: 2.5, filter: "blur(5px)" });
    ["#void", "#despair"].forEach(function (sec) {
      var secLines = gsap.utils.toArray(sec + " .line.big");
      if (!secLines.length) return;
      var tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 72%" } });
      secLines.forEach(function (l, i) {
        tl.to(l.querySelectorAll(".ch"), { opacity: 1, y: 0, rotate: 0, filter: "blur(0px)", duration: .85, ease: "power3.out", stagger: .05 }, i === 0 ? 0 : "-=0.35");
      });
    });
  })();

  /* ---------- 特殊文字特效 ②：「不再公布」朱砂封禁条扫过 ---------- */
  document.querySelectorAll(".redact").forEach(function (el) {
    ST.create({
      trigger: el, start: "top 72%", once: true,
      onEnter: function () { setTimeout(function () { el.classList.add("on"); }, 700); }
    });
  });

  /* ---------- 特殊文字入场 ③：章节标题「打字机 + 长条光标」 ----------
     进入新章节：标题先放大"冲到眼前"（scale 1.5），随后平稳缩回落定为章节标题；
     同时逐字打出（瞬显＝打字机），朱砂长条光标贴着最后一个字右移，打完闪两下隐去。 */
  (function chapterType() {
    document.querySelectorAll(".round .intro").forEach(function (intro) {
      var lines = gsap.utils.toArray(intro.querySelectorAll(".line.big"));
      if (!lines.length) return;
      var bar = document.createElement("span");
      bar.className = "typebar";
      lines.forEach(function (line) {
        line.classList.add("chsplit");                 // 跳过通用整行揭示
        gsap.set(line, { opacity: 1 });                // 父行翻开（.js .reveal{opacity:0} 的坑）
        splitChars(line, "ch tch");                    // #42：按词分组，断行只在词边界
      });
      gsap.set(intro.querySelectorAll(".tch"), { visibility: "hidden" });   // 占位不偏移，瞬显=打字
      var tl = gsap.timeline({ scrollTrigger: { trigger: intro, start: "top 62%" } });
      var t = 0;
      lines.forEach(function (line) {
        var chs = line.querySelectorAll(".tch");
        var typeDur = chs.length * 0.055;
        // 冲脸 → 平稳缩回（打字进行中同步落定）
        tl.set(line, { scale: 1.5, transformOrigin: "50% 55%" }, t);
        tl.to(line, { scale: 1, duration: Math.max(0.85, typeDur + 0.3), ease: "power3.out" }, t);
        // 长条光标进场 + 逐字打出
        tl.call(function () { line.insertBefore(bar, line.firstChild); gsap.set(bar, { opacity: 1 }); }, null, t + 0.05);
        Array.prototype.forEach.call(chs, function (c, i) {
          tl.call(function () { c.style.visibility = "visible"; c.after(bar); }, null, t + 0.12 + i * 0.055);
        });
        t += 0.12 + typeDur + 0.32;   // 行间停顿
      });
      // 收尾：光标闪两下后隐去
      tl.to(bar, { opacity: 0, duration: 0.09, repeat: 3, yoyo: true, ease: "none" }, t)
        .set(bar, { opacity: 0 }, t + 0.4);
    });
  })();

  /* ---------- 叙事揭示（逐行 stagger） ---------- */
  document.querySelectorAll(".copy, .cta__list").forEach(function (group) {
    if (group.closest("#open")) return;   // 序·希望单独编排（慢·有明显间隔），见下
    var items = Array.prototype.filter.call(group.querySelectorAll(".reveal"), function (n) { return !n.classList.contains("chsplit"); });
    if (!items.length) return;
    var stageEl = group.closest(".stage");
    var slow = !!(stageEl && stageEl.classList.contains("stage--tall"));
    gsap.set(items, { opacity: 0, y: 36 });
    gsap.to(items, {
      opacity: 1, y: 0, duration: slow ? 1.4 : 1.05, ease: "power3.out",
      stagger: slow ? 0.6 : 0.34,
      scrollTrigger: { trigger: group, start: "top 80%" }
    });
  });

  /* ---------- 序：分段、慢慢浮现、有明显时间间隔（#29 文案已换冷峻反问） ----------
     黑暗背景 + 远处漂浮微弱粒子（由 fx.js 星座场提供，mood=calm）。
     大学生？（巨大·慢浮现）→ 间隔 → 似乎是廉价的代名词。 */
  var openCopy = document.querySelector("#open .copy");
  if (openCopy) {
    var L = openCopy.querySelectorAll(".reveal");   // [大学生？, 似乎是廉价的代名词。]
    gsap.set(L, { opacity: 0, y: 28 });
    var otl = gsap.timeline({ scrollTrigger: { trigger: "#open", start: "top 72%" } });
    otl.fromTo(L[0], { opacity: 0, y: 22, scale: .985 },
                     { opacity: 1, y: 0, scale: 1, duration: 2.4, ease: "power2.out" }, 0);   // 大学生？·慢浮现
    if (L[1]) otl.to(L[1], { opacity: 1, y: 0, duration: 1.5, ease: "power3.out" }, 2.05);    // 间隔→似乎是廉价的代名词。
    if (L[2]) otl.to(L[2], { opacity: 1, y: 0, duration: 1.7, ease: "power3.out" }, 3.75);    // （备用第三行）
  }

  // 独立 reveal（滚动提示、CTA 落款等）
  document.querySelectorAll(".reveal").forEach(function (n) {
    if (n.closest(".copy") || n.closest(".cta__list")) return;
    gsap.set(n, { opacity: 0, y: 24 });
    gsap.to(n, {
      opacity: 1, y: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: n, start: "top 88%" }
    });
  });

  // “但” —— 缓慢庄重地升起（克制 · 无炫光）
  var but = document.querySelector(".reveal-but");
  if (but) {
    gsap.set(but, { opacity: 0, y: 70, scale: 1.06 });
    gsap.to(but, {
      opacity: 1, y: 0, scale: 1, duration: 1.8, ease: "power2.out",
      scrollTrigger: { trigger: "#but", start: "top 60%" }
    });
    // 极轻视差，留住"大气"
    gsap.to(but, {
      yPercent: -6, ease: "none",
      scrollTrigger: { trigger: "#but", start: "top top", end: "bottom top", scrub: true }
    });
  }

  // 泉涌主句（#29b：词云已撤，丰富度交给胶卷流 film.js；只揭示收束句）
  var tail = document.querySelector(".surge__tail");
  if (tail) {
    gsap.set(tail, { opacity: 0, y: 26 });
    var stl = gsap.timeline({ scrollTrigger: { trigger: "#surge", start: "top 62%" } });
    stl.to(tail, { opacity: 1, y: 0, duration: 1.1, ease: "power3.out" }, .2);
    stl.add(function () { var g = document.querySelector(".surge__tail .uline"); if (g) g.classList.add("on"); }, "+=0.1");   // 关键词下划线扫入
  }

  // “希望” 收尾点亮（克制 · 缓升）
  var hope = document.querySelector(".hope");
  if (hope) {
    gsap.set(hope, { opacity: 0, y: 44, scale: .98 });
    gsap.to(hope, {
      opacity: 1, y: 0, scale: 1, duration: 1.7, ease: "power3.out",
      scrollTrigger: { trigger: hope, start: "top 76%" }
    });
  }

  /* ---------- #35/#41 作品入场「波浪刷新显影」 ----------
     作品不再滑入（#41：下滑进入画面有顿感，禁用）——黑幕从一开始就挂在画框上，
     进入聚焦区时按四种波型把画面「刷新显影」出来（与剧场刷新波同一 DNA）：
       blinds 百叶展开 / mosaic 瓦片溶出 / ocean 浪退显影 / split 中缝拉幕
     文字说明（产品 meta / 自动化 info）仅 opacity 淡入，零位移；
     bento 的 cap 维持 hover 显示不参与。网站轮由 theater.js 剧场接管，不在此列。
     旋钮：KINDS 轮换表 / 各 rig 的 kindOffset（让每轮首个波型不同）/ stagger .14。 */
  (function initWaveReveals() {
    var KINDS = ["blinds", "mosaic", "ocean", "split"];

    function buildOverlay(host, kind) {
      var ov = el("div", "wvr wvr--" + kind);
      if (kind === "blinds") {
        for (var i = 0; i < 7; i++) ov.appendChild(el("b"));
      } else if (kind === "mosaic") {
        for (var j = 0; j < 40; j++) { var b = el("b"); if (Math.random() < .07) b.className = "ac"; ov.appendChild(b); }
      } else if (kind === "ocean") {
        ov.appendChild(el("b", "sea")); ov.appendChild(el("i", "foam"));
      } else {
        ov.appendChild(el("b", "l")); ov.appendChild(el("b", "r"));
      }
      host.appendChild(ov);
      return ov;
    }

    // 迷你浪沿（与剧场 wavePoly 同形，幅度收小适配画框）
    function miniWave(q) {
      var base = -12 + q * 124, A = 4.2, ph = q * 4.2;
      var edge = [], ca = [], cb = [];
      for (var x = 0; x <= 16; x++) {
        var px = x / 16 * 100;
        var py = base + A * Math.sin(px / 100 * Math.PI * 2.6 + ph);
        edge.push(px.toFixed(1) + "% " + py.toFixed(2) + "%");
        ca.push(px.toFixed(1) + "% " + (py - 2).toFixed(2) + "%");
        cb.push(px.toFixed(1) + "% " + (py + 2).toFixed(2) + "%");
      }
      return [
        "polygon(0% -20%, 100% -20%, " + edge.slice().reverse().join(",") + ")",
        "polygon(" + ca.join(",") + "," + cb.slice().reverse().join(",") + ")"
      ];
    }

    function openOverlay(job) {
      var ov = job.ov, kind = job.kind;
      var tl = gsap.timeline({ onComplete: function () { ov.remove(); } });
      if (kind === "blinds") {
        tl.to(ov.children, { scaleY: 0, duration: .55, ease: "power3.inOut",
          transformOrigin: function (i) { return i % 2 ? "50% 100%" : "50% 0%"; },
          stagger: { each: .055, from: "center" } }, 0);
      } else if (kind === "mosaic") {
        tl.to(ov.children, { scale: 0, duration: .4, ease: "power2.in",
          stagger: { each: .014, grid: [5, 8], from: "random" } }, 0);
      } else if (kind === "ocean") {
        var sea = ov.querySelector(".sea"), foam = ov.querySelector(".foam"), pr = { q: 1 };
        var apply = function () {
          var p = miniWave(pr.q);
          sea.style.clipPath = p[0]; sea.style.webkitClipPath = p[0];
          foam.style.clipPath = p[1]; foam.style.webkitClipPath = p[1];
        };
        apply();
        tl.to(pr, { q: 0, duration: .72, ease: "power2.inOut", onUpdate: apply }, 0);
      } else {
        tl.to(ov.querySelector(".l"), { xPercent: -101, duration: .6, ease: "power3.inOut" }, 0);
        tl.to(ov.querySelector(".r"), { xPercent: 101, duration: .6, ease: "power3.inOut" }, 0);
      }
      // 显影同时画框极轻沉降（无位移，只有"到位"的呼吸）
      gsap.fromTo(job.host, { scale: 1.012 }, { scale: 1, duration: .65, ease: "power2.out" });
      if (job.txt) workText(job.txt, .25);
    }

    /* #44 作品文字「特殊入场」：标题印刷擦除（clip 擦出 + 朱砂划线走过隐去）、
       说明行 blur 浮现——与画面波浪显影同拍，每件作品=文字+画面双动效 */
    function workText(txt, delay) {
      var isCap = txt.classList.contains("cap");
      if (isCap) {                                  // 海报说明卡：入场亮相 3s 后回到 hover 模式
        txt.classList.add("cap--show");
        gsap.delayedCall(3.2, function () { txt.classList.remove("cap--show"); });
      } else {
        gsap.to(txt, { opacity: 1, duration: .3, ease: "power1.out", delay: delay });
      }
      var title = txt.querySelector("b, h3");
      var rest = Array.prototype.filter.call(txt.children, function (n) {
        return n !== title && n.tagName !== "I";
      });
      if (title) {
        var line = el("i", "wline");
        title.appendChild(line);
        gsap.fromTo(title, { clipPath: "inset(-15% 100% -15% -2%)" },
          { clipPath: "inset(-15% -2% -15% -2%)", duration: .65, ease: "power2.inOut", delay: delay,
            onComplete: function () { gsap.set(title, { clearProps: "clipPath" }); } });
        gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: .65, ease: "power2.inOut", delay: delay });
        gsap.to(line, { opacity: 0, duration: .5, delay: delay + .9,
          onComplete: function () { line.remove(); } });
      }
      if (rest.length) gsap.fromTo(rest, { opacity: 0, y: 10, filter: "blur(4px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: .6, ease: "power2.out",
          delay: delay + .22, stagger: .09, clearProps: "filter" });
    }

    function rig(itemSel, hostSel, txtSel, kindOffset, start) {
      var items = gsap.utils.toArray(itemSel);
      if (!items.length) return;
      items.forEach(function (item, i) {
        var host = (hostSel && item.querySelector(hostSel)) || item;
        var kind = KINDS[(i + (kindOffset || 0)) % KINDS.length];
        var txt = txtSel ? item.querySelector(txtSel) : null;
        if (txt && !txt.classList.contains("cap")) gsap.set(txt, { opacity: 0 });   // cap 的显隐归 CSS 类管
        item.__wv = { host: host, ov: buildOverlay(host, kind), kind: kind, txt: txt, done: false };
      });
      ST.batch(items, {
        start: start || "top 75%",   // 恰到好处：作品上沿进入下方 1/4 视区才显影
        onEnter: function (batch) {
          batch.forEach(function (item, bi) {
            var job = item.__wv;
            if (!job || job.done) return;
            job.done = true;
            gsap.delayedCall(bi * .14, function () { openOverlay(job); });
          });
        }
      });
    }
    rig(".bento .tile", null, ".cap", 2);                                // 海报：ocean 浪退先行（显影感）+ 说明卡亮相
    rig(".products > *", ".phone__screen, .gamecard", ".product__meta", 0); // 产品：blinds 先行（屏幕点亮感）
    rig(".automation .auto", ".auto__media", ".auto__txt", 1);           // 自动化：mosaic 先行（数据重组感）；文字容器取 auto__txt（h3+p）
  })();

  /* 幕间分界：进入视口时细线从中心向两侧划出、菱形点亮 */
  document.querySelectorAll(".divider").forEach(function (el) {
    ST.create({ trigger: el, start: "top 80%", once: true, onEnter: function () { el.classList.add("on"); } });
  });

  /* ---------- 超大数字：滚动计数（成长可视化） ---------- */
  document.querySelectorAll("[data-count]").forEach(function (node) {
    var end = parseInt(node.dataset.count, 10) || 0;
    var box = { v: 0 };
    node.textContent = "0";
    gsap.to(box, {
      v: end, duration: 1.9, ease: "power2.out",
      scrollTrigger: { trigger: node, start: "top 84%" },
      onUpdate: function () { node.textContent = Math.round(box.v); }
    });
  });

  /* ---------- 章节巨型数字：视差（背景慢移，立体层级） ---------- */
  gsap.utils.toArray(".chapter__no[data-par]").forEach(function (n) {
    var host = n.closest(".chapter") || n.parentElement;
    gsap.fromTo(n, { yPercent: 16 }, {
      yPercent: -16, ease: "none",
      scrollTrigger: { trigger: host, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  /* ---------- 进度金线 ---------- */
  var bar = document.getElementById("progressBar");
  lenis.on("scroll", function (e) {
    var max = document.documentElement.scrollHeight - innerHeight;
    var p = max > 0 ? (e.scroll || scrollY) / max : 0;
    if (bar) bar.style.width = (Math.min(1, Math.max(0, p)) * 100).toFixed(2) + "%";
  });

  /* ---------- 作品磁吸（#阻尼感）：滚动停稳后，把最近的作品行轻轻拉到视觉中心 ----------
     原则：只在「停稳 + 离作品行中心 < 34vh」时介入一次，绝不抢正在滚动的控制权（无 CSS snap 的"滚不动"感）。
     行目标=四轮容器的直接子元素（同顶并排的去重为一行：两海报/两手机=一个焦点），吸附时实时测量（懒加载高度变化免疫）。
     旋钮：吸附范围 0.34、动画 0.85s、停稳阈值 v<0.12、武装地板 v>1.4。仅鼠标指针设备，尊重 reduced-motion。 */
  (function initWorkMagnet() {
    if (prefersReduced || !matchMedia("(pointer: fine)").matches) return;
    var snapping = false, armed = false, settleTimer = null;

    function collectRowCenters() {
      var sel = ".bento > *, .sites > *, .products > *, .automation > *";
      var rows = [];
      document.querySelectorAll(sel).forEach(function (el) {
        if (!el.offsetParent) return;                   // display:none 守卫
        if (el.closest("[data-theater]")) return;       // #31 剧场区 pin 自管滚动，磁吸禁入
        var r = el.getBoundingClientRect();
        if (r.height < 40) return;
        var top = r.top + scrollY, c = top + r.height / 2;
        for (var i = 0; i < rows.length; i++) {
          if (Math.abs(rows[i].top - top) < 60) {        // 同顶并排 → 合并为一行
            rows[i].c = (rows[i].c + c) / 2; return;
          }
        }
        rows.push({ top: top, c: c });
      });
      return rows.map(function (r) { return r.c; });
    }

    function trySnap() {
      settleTimer = null;
      if (!armed || snapping) return;
      armed = false;
      var vh = innerHeight, target = null, bestD = Infinity;
      collectRowCenters().forEach(function (c) {
        var d = c - (scrollY + vh / 2);
        if (Math.abs(d) < Math.abs(bestD)) { bestD = d; target = c; }
      });
      if (target == null || Math.abs(bestD) > vh * 0.34 || Math.abs(bestD) < 12) return;
      snapping = true;
      lenis.scrollTo(target - vh / 2, {
        duration: 0.85,
        easing: function (t) { return 1 - Math.pow(1 - t, 3); },
        onComplete: function () { snapping = false; }
      });
      setTimeout(function () { snapping = false; }, 1100);   // 用户中途接管时 onComplete 不触发的兜底
    }

    // 停稳判定：事件流可能在速度降到阈值前就停发（长距离滚动尤甚），
    // 所以低速后改为轮询 lenis.velocity，真正归零才吸附（坑见 LESSONS L17）。
    function checkSettled() {
      settleTimer = null;
      if (snapping || !armed) return;
      if (Math.abs(lenis.velocity || 0) > 0.15) {        // 还在滑 → 继续等
        settleTimer = setTimeout(checkSettled, 120);
        return;
      }
      trySnap();
    }
    lenis.on("scroll", function (e) {
      if (snapping) return;
      var v = Math.abs(e.velocity || 0);
      if (v > 1.4) {                                     // 真实滚动中：武装磁吸、撤销待定吸附
        armed = true;
        if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
      } else if (armed && !settleTimer) {                // 进入减速尾段：开始轮询停稳
        settleTimer = setTimeout(checkSettled, 120);
      }
    });
  })();

  ST.refresh();
  initSound();
  initCTA();
  initDamp();
  initStreamVelocity();

  /* #48b 走马灯滚动耦合：滚得快流得快（与胶卷流 P32 同语汇）。
     用 Web Animations 的 playbackRate 调速——纯倍率无积分，免 L27 中毒。 */
  function initStreamVelocity() {
    var track = document.querySelector(".stream__track");
    if (!track || !track.getAnimations || !window.lenis) return;
    var rate = 1, target = 1;
    window.lenis.on("scroll", function (e) {
      target = 1 + Math.min(Math.abs(e.velocity || 0) / 45, 2.4);
    });
    gsap.ticker.add(function () {
      target += (1 - target) * 0.025;            // 停止滚动后缓慢回落
      rate += (target - rate) * 0.12;
      var an = track.getAnimations()[0];
      if (an && isFinite(rate)) an.playbackRate = rate;
    });
  }

  /* ============================================================
     #38 收尾阻尼：接近 CTA 时滚动输入减半——灯火版图看完不至于
     轻轻一拨就冲到底部联系方式（离开区间即恢复原手感）
     ============================================================ */
  function initDamp() {
    var cta = document.getElementById("cta");
    if (!cta || !window.lenis || !ST) return;
    var base = {
      wheel: lenis.options.wheelMultiplier == null ? 1 : lenis.options.wheelMultiplier,
      touch: lenis.options.touchMultiplier == null ? 1 : lenis.options.touchMultiplier
    };
    // 实时测 rect 判定（ST 缓存的 start/end 会被 theater pin 后加的滚动长度搞旧，实测踩中）
    var damped = false;
    function update() {
      var r = cta.getBoundingClientRect();
      var inZone = r.top < innerHeight && r.bottom > 0;   // CTA 任一部分可见
      if (inZone === damped) return;
      damped = inZone;
      var k = inZone ? .5 : 1;
      lenis.options.wheelMultiplier = base.wheel * k;
      lenis.options.touchMultiplier = base.touch * k;
    }
    lenis.on("scroll", update);
    update();
  }

  /* ============================================================
     CTA：点击行手风琴展开（互斥），关注行点公众号名复制
     ============================================================ */
  function initCTA() {
    var lis = document.querySelectorAll(".cta__list li");
    lis.forEach(function (li) {
      var row = li.querySelector(".cta__row");
      if (!row) return;
      row.addEventListener("click", function () {
        var was = li.classList.contains("open");
        lis.forEach(function (o) { o.classList.remove("open"); });
        if (!was) li.classList.add("open");
      });
    });
    function copyWithTip(text, sub) {
      var copied = function () {
        if (!sub || sub.dataset.lock) return;
        sub.dataset.lock = "1";
        var old = sub.textContent;
        sub.textContent = sub.dataset.tip || "已复制";
        sub.style.color = "var(--ac)";
        setTimeout(function () { sub.textContent = old; sub.style.color = ""; delete sub.dataset.lock; }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(text).then(copied, function () {});
      else { // 兜底：execCommand
        var ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta);
        ta.select(); try { document.execCommand("copy"); copied(); } catch (err) {}
        document.body.removeChild(ta);
      }
    }
    var name = document.getElementById("mpName");
    if (name) name.addEventListener("click", function (e) {
      e.stopPropagation();
      copyWithTip(name.textContent, name.closest(".cta__panel-in").querySelector(".cta__sub"));
    });
    // 分享入口：移动端优先系统分享面板，其余复制正式链接（微信 webview 两个 API 都可能受限，execCommand 兜底）
    var share = document.getElementById("shareLink");
    if (share) share.addEventListener("click", function (e) {
      e.stopPropagation();
      var url = "https://dengyuanxing953-eng.github.io/treelin-replica/";
      var sub = share.closest(".cta__panel-in").querySelector(".cta__sub");
      if (navigator.share)
        navigator.share({ title: document.title, url: url }).catch(function (err) {
          if (!err || err.name !== "AbortError") copyWithTip(url, sub); // 用户取消不打扰
        });
      else copyWithTip(url, sub);
    });
  }

  /* ============================================================
     声音
     ============================================================ */
  function initSound() {
    var audio = document.getElementById("bgm");
    var btn = document.getElementById("sound");
    if (!audio || !btn) return;
    audio.volume = 0;
    var targetVol = 0.7, started = false;

    function fadeIn() {
      var step = function () {
        if (audio.volume < targetVol - 0.02) {
          audio.volume = Math.min(targetVol, audio.volume + 0.04);
          requestAnimationFrame(step);
        } else audio.volume = targetVol;
      };
      step();
    }
    function play() {
      var p = audio.play();
      if (p && p.then) {
        p.then(function () {
          started = true;
          btn.classList.add("playing");
          btn.classList.remove("blocked");
          fadeIn();
        }).catch(function () {
          btn.classList.add("blocked"); // 被拦截：等手势
        });
      }
    }
    // BGM 与开幕「首次点击」绑定：reel.js 在用户首次点击时调用 window.__bgmPlay()，
    // 让音乐与画面运动同一手势同时开始（点击是用户手势，浏览器必放行声音，
    // 故不在加载时 eager 自动播放——否则要么被拦截、要么音乐先于画面响）。
    window.__bgmPlay = play;
    // 兜底：万一没有开幕(reel)，首次点击/触摸/按键也能起音乐
    //（只绑点击类手势，不绑 hover/scroll，避免「还没点击就出声」）
    var unlockEvents = ["pointerdown", "touchstart", "keydown", "click"];
    function unlock() {
      if (!started) play();
      if (started) unlockEvents.forEach(function (ev) { window.removeEventListener(ev, unlock); });
    }
    unlockEvents.forEach(function (ev) { window.addEventListener(ev, unlock, { passive: true }); });
    // 手动开关
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (audio.paused) { play(); }
      else { audio.pause(); btn.classList.remove("playing"); }
    });
  }

  function initProgressFallback() {
    var bar = document.getElementById("progressBar");
    if (!bar) return;
    addEventListener("scroll", function () {
      var max = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (max > 0 ? Math.min(100, scrollY / max * 100) : 0) + "%";
    }, { passive: true });
  }

})();

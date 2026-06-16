/* ============================================================
   《希望》 · 斜向电影胶卷流  film.js（#29b）
   ------------------------------------------------------------
   语义（T9）：「一切东西，如泉涌般出现」——不再用干巴巴的词云，
   而是把作品本身装进电影胶片，三条胶卷斜向流过画面：
   内容的丰富度让观众"看见"，而不是"读到"。
   · 素材：复用开幕作品墙同组静图（works/reel/，零新增资产，
     与开幕/终幕旋涡同一组图＝全片首尾呼应）
   · 三条反向交替 + 速差；滚动速度耦合（滚得快→胶卷快放）
   · 胶片格：齿孔带 + 黑白低亮图 + mono 小标签（原词云 9 词上墙）
   · 若隐若现：条两端水平淡出 + 整域上下垂直淡出（双层 mask）
   · IO 离屏暂停；reduced-motion / 无 GSAP → 静态三条
   ------------------------------------------------------------
   旋钮：STRIPS 每条速度(秒/半程)与帧序 / TILT 倾角 /
        速度耦合强度 VEL_K、上限 VEL_MAX（想更狂改这俩）/
        图片明暗在 css .film__frame img 的 filter。
   ============================================================ */
(function () {
  "use strict";

  var host = document.querySelector("#surge .film");
  if (!host) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap;

  /* ---------- 旋钮 ---------- */
  var TILT = -9;          // 整体倾角 deg
  var VEL_K = 1 / 60;     // lenis.velocity → 加速换算
  var VEL_MAX = 2.6;      // 快放上限（倍速）
  var R = (window.MEDIA_BASE || "") + "works/reel/";   // 媒体基址跟随 data.js（OSS 直链）

  /* 三条胶卷：dur=半程秒数（小=快），帧序交错避免同图同屏；
     标签=原词云 9 词分布上墙（写真/海报/网站/小程序/软件/游戏/音乐/视频/自动化工作流） */
  var STRIPS = [
    { dur: 44, dir: -1, frames: [
      { img: R + "01_poster.jpg",          tag: "海报" },
      { img: R + "10_mother.jpg",          tag: "写真" },
      { img: R + "04_personal.jpg",        tag: "网站" },
      { img: R + "06_game.jpg",            tag: "游戏" }
    ]},
    { dur: 58, dir: 1, frames: [
      { img: R + "05_car.jpg",             tag: "软件" },
      { img: R + "02_poster2.jpg",         tag: "海报" },
      { img: R + "_unused/12_auto.jpg",    tag: "自动化工作流" },
      { img: R + "08_novel.jpg",           tag: "视频" }
    ]},
    { dur: 50, dir: -1, frames: [
      { img: R + "07_pixel.jpg",           tag: "小程序" },
      { img: R + "03_fx.jpg",              tag: "音乐" },
      { img: R + "11_special.jpg",         tag: "写真" },
      { img: R + "_unused/09_tastelens.jpg", tag: "网站" }
    ]}
  ];

  /* ---------- 构建 DOM ---------- */
  var tilt = document.createElement("div");
  tilt.className = "film__tilt";
  var belts = [];

  STRIPS.forEach(function (s) {
    var strip = document.createElement("div");
    strip.className = "film__strip";
    var belt = document.createElement("div");
    belt.className = "film__belt";
    for (var dup = 0; dup < 2; dup++) {           // 双份 set → 无缝循环（P13 机制）
      var set = document.createElement("div");
      set.className = "film__set";
      s.frames.forEach(function (f) {
        var fig = document.createElement("figure");
        fig.className = "film__frame";
        var img = document.createElement("img");
        img.src = f.img; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
        fig.appendChild(img);
        if (f.tag) {
          var cap = document.createElement("figcaption");
          cap.textContent = f.tag;
          fig.appendChild(cap);
        }
        set.appendChild(fig);
      });
      belt.appendChild(set);
    }
    strip.appendChild(belt);
    tilt.appendChild(strip);
    belts.push({ el: belt, dir: s.dir, dur: s.dur });
  });
  host.appendChild(tilt);

  /* ---------- 降级：静态三条（不滚动，仍有胶片质感） ---------- */
  if (!gsap || reduced) {
    belts.forEach(function (b) { b.el.style.transform = "translate3d(-25%,0,0)"; });
    return;
  }

  /* ---------- 无缝循环 + 滚动速度耦合 ---------- */
  var tweens = belts.map(function (b) {
    var from = b.dir < 0 ? 0 : -50;
    var to   = b.dir < 0 ? -50 : 0;
    return gsap.fromTo(b.el, { xPercent: from },
      { xPercent: to, duration: b.dur, ease: "none", repeat: -1, paused: true });
  });

  var ts = 1;
  function tickVel() {
    var v = (window.lenis && window.lenis.velocity) || 0;
    var target = 1 + Math.min(Math.abs(v) * VEL_K, VEL_MAX - 1);
    ts += (target - ts) * .08;
    for (var i = 0; i < tweens.length; i++) tweens[i].timeScale(ts);
  }

  var active = false;
  var io = new IntersectionObserver(function (entries) {
    var on = entries[0].isIntersecting;
    if (on === active) return;
    active = on;
    if (on) { tweens.forEach(function (t) { t.play(); }); gsap.ticker.add(tickVel); }
    else    { tweens.forEach(function (t) { t.pause(); }); gsap.ticker.remove(tickVel); }
  }, { rootMargin: "12% 0%" });
  io.observe(host);
})();

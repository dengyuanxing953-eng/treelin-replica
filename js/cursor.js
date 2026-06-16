/* ============================================================
   《希望》 · 取景器光标  cursor.js
   ------------------------------------------------------------
   语义（T9 特效演出含义）：这是一部「滚动短片」，
   光标 = 摄影机的取景系统。
   · 白点（difference 反色）即时跟手 + 朱砂细环惯性滞后（速度挤压形变）
   · hover 作品 → 环让位，四个 L 角标飞到作品边框「咔」对焦锁定
   · hover 链接/按钮 → 环放大（外链出 ↗ 提示）
   · 点击门阶段：环声呐脉冲邀请点击；蒙太奇播放：环隐身只留点（T22）
   · 磁吸（#sound / .visit）：小控件轻微吸向光标
   · 仅 pointer:fine；尊重 reduced-motion；触屏完全不启用
   ------------------------------------------------------------
   旋钮：想调环大小改 RING；对焦框贴边松紧改 PAD；
        跟随手感改 K_RING/K_FRAME；挤压幅度改 SQUASH/S_MAX；
        磁吸力度改 MAG_K、捕获范围改 MAG_REACH。
   ============================================================ */
(function () {
  "use strict";

  if (!matchMedia("(pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ---------- 旋钮 ---------- */
  var RING      = 34;     // 环直径 px
  var PAD       = 10;     // 对焦框相对作品边框的外扩 px
  var CORNER    = 14;     // 对焦角标边长 px（css 同步）
  var K_RING    = .16;    // 环跟随系数（小=更拖）
  var K_FRAME   = .26;    // 对焦框吸附系数
  var SQUASH    = .010;   // 速度→挤压 换算
  var S_MAX     = .32;    // 挤压上限
  var MAG_REACH = 1.55;   // 磁吸捕获 = 控件外接框放大倍数
  var MAG_K     = .30;    // 磁吸强度（位移 = 距中心 × K）
  var MAG_MAX   = 10;     // 磁吸位移上限 px

  var FOCUS_SEL = ".tile, .browser, .phone, .gamecard, .auto__media";
  var LINK_SEL  = "a, button";
  var MAG_SEL   = "#sound, .visit";

  var docEl = document.documentElement;
  docEl.classList.add("has-cur");

  /* ---------- DOM ---------- */
  var root = document.createElement("div");
  root.className = "cur";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML =
    '<div class="cur__dot"><i></i></div>' +
    '<div class="cur__ring"><i></i><span class="cur__tip"></span></div>' +
    '<div class="cur__frame"><b></b><b></b><b></b><b></b></div>';
  document.body.appendChild(root);

  var dot   = root.querySelector(".cur__dot");
  var ring  = root.querySelector(".cur__ring");
  var tip   = root.querySelector(".cur__tip");
  var frame = root.querySelector(".cur__frame");

  /* ---------- 状态 ---------- */
  var mx = innerWidth / 2, my = innerHeight / 2;  // 指针真位置
  var rx = mx, ry = my;                           // 环滞后位置
  var vx = 0, vy = 0, sq = 0;                     // 速度 / 平滑后挤压量
  var live = false;                               // 首次移动前不显示
  var mode = "free";                              // free | link | focus
  var focusEl = null;
  var fr = { x: 0, y: 0, w: RING, h: RING };      // 对焦框当前几何

  /* ---------- 指针 ---------- */
  addEventListener("pointermove", function (e) {
    vx = e.clientX - mx; vy = e.clientY - my;
    mx = e.clientX; my = e.clientY;
    if (!live) {
      live = true;
      rx = mx; ry = my;            // 首帧直接就位，避免从角落飞入
      root.classList.add("on");
    }
  }, { passive: true });

  addEventListener("pointerdown", function () { root.classList.add("cur--press"); }, { passive: true });
  addEventListener("pointerup",   function () { root.classList.remove("cur--press"); }, { passive: true });

  /* 离开窗口隐藏（mouseout 到 null = 出窗） */
  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget) { root.classList.remove("on"); live = false; }
  });
  addEventListener("blur", function () { root.classList.remove("on"); live = false; });

  /* ---------- 模式（事件委托） ---------- */
  document.addEventListener("pointerover", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var f = t.closest(FOCUS_SEL);
    if (f) { setFocus(f); return; }
    var l = t.closest(LINK_SEL);
    if (l) { setLink(l); return; }
    setFree();
  });

  function setFocus(el) {
    if (mode === "focus" && focusEl === el) return;
    if (mode !== "focus") {
      // 从环的当前位置「张开」到作品四角 → 对焦感
      fr.x = rx - RING / 2; fr.y = ry - RING / 2; fr.w = RING; fr.h = RING;
    }
    mode = "focus"; focusEl = el;
    root.classList.add("cur--focus");
    root.classList.remove("cur--link");
  }
  function setLink(el) {
    mode = "link"; focusEl = null;
    tip.textContent = el.dataset.cur != null ? el.dataset.cur
                    : (el.target === "_blank" ? "↗" : "");
    root.classList.add("cur--link");
    root.classList.remove("cur--focus");
  }
  function setFree() {
    if (mode === "free") return;
    mode = "free"; focusEl = null;
    root.classList.remove("cur--link", "cur--focus");
  }

  /* ---------- 磁吸 ---------- */
  var magEls = [];
  function collectMagnets() {
    magEls = Array.prototype.slice.call(document.querySelectorAll(MAG_SEL))
      .map(function (el) { return { el: el, x: 0, y: 0 }; });
  }
  collectMagnets();

  function magnetStep() {
    for (var i = 0; i < magEls.length; i++) {
      var m = magEls[i], el = m.el;
      var tx = 0, ty = 0;
      if (live) {
        // 注意：不能用 offsetParent 判可见（fixed 元素恒为 null）；r.width=0 即隐藏
        var r = el.getBoundingClientRect();
        if (r.width) {
          var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
          var hw = r.width / 2 * MAG_REACH + 14, hh = r.height / 2 * MAG_REACH + 14;
          var dx = mx - cx, dy = my - cy;
          if (dx > -hw && dx < hw && dy > -hh && dy < hh) {
            tx = Math.max(-MAG_MAX, Math.min(MAG_MAX, dx * MAG_K));
            ty = Math.max(-MAG_MAX, Math.min(MAG_MAX, dy * MAG_K));
          }
        }
      }
      m.x += (tx - m.x) * .18; m.y += (ty - m.y) * .18;
      if (Math.abs(m.x) < .05 && Math.abs(m.y) < .05 && !tx && !ty) {
        if (el.style.transform) el.style.transform = "";
      } else {
        el.style.transform = "translate3d(" + m.x.toFixed(2) + "px," + m.y.toFixed(2) + "px,0)";
      }
    }
  }

  /* ---------- 主循环 ---------- */
  var raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);

    // 点：即时跟手
    dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";

    // 环：惯性滞后 + 速度挤压（仅自由态；hover 态回正避免标签倾斜）
    rx += (mx - rx) * K_RING;
    ry += (my - ry) * K_RING;
    var sTgt = 0, ang = 0;
    if (mode === "free") {
      var sp = Math.sqrt(vx * vx + vy * vy);
      sTgt = Math.min(sp * SQUASH, S_MAX);
      ang = Math.atan2(vy, vx);
    }
    sq += (sTgt - sq) * .14;
    vx *= .8; vy *= .8;   // 没新事件时速度衰减
    ring.style.transform =
      "translate3d(" + rx + "px," + ry + "px,0) rotate(" + ang.toFixed(3) + "rad)" +
      " scale(" + (1 + sq).toFixed(3) + "," + (1 - sq * .65).toFixed(3) + ")";

    // 对焦框：实时量测目标（滚动/磁吸期间贴住不掉队）
    if (mode === "focus" && focusEl) {
      if (!focusEl.isConnected) { setFree(); }
      else {
        var r = focusEl.getBoundingClientRect();
        fr.x += (r.x - PAD - fr.x) * K_FRAME;
        fr.y += (r.y - PAD - fr.y) * K_FRAME;
        fr.w += (r.width + PAD * 2 - fr.w) * K_FRAME;
        fr.h += (r.height + PAD * 2 - fr.h) * K_FRAME;
        frame.style.transform = "translate3d(" + fr.x.toFixed(1) + "px," + fr.y.toFixed(1) + "px,0)";
        frame.style.width = fr.w.toFixed(1) + "px";
        frame.style.height = fr.h.toFixed(1) + "px";
      }
    }

    magnetStep();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) raf = requestAnimationFrame(tick);
  });
  raf = requestAnimationFrame(tick);
})();

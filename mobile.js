/* 手机端强制横屏 v5
   - 优先：全屏 + screen.orientation.lock('landscape')（安卓 Chrome 等）
   - 不支持时：CSS 旋转画布 90°，并把触摸/鼠标坐标重映射后转发给画布
   - 右下角常驻「横屏 / 还原」按钮，点两次可来回切换
   - 测试钩子：?rotate=1 强制显示按钮；?forceRotate=1 在横屏视口下也强制旋转 */
(function () {
  "use strict";

  var forceShow = /[?&]rotate=1/.test(location.search);
  var forceRotate = /[?&]forceRotate=1/.test(location.search);
  var rotated = false;   // 是否处于 CSS 旋转兜底模式
  var locked = false;    // 是否成功锁了系统方向
  var busy = false;

  function isPhone() {
    var ua = navigator.userAgent || "";
    if (/Android|iPhone|iPod|Windows Phone|Mobile|HarmonyOS|OpenHarmony/i.test(ua)) return true;
    if (navigator.maxTouchPoints > 1) {
      var w = Math.min(screen.width || 9999, screen.height || 9999);
      if (w < 820) return true;
    }
    return false;
  }

  function isPortrait() {
    try {
      if (window.matchMedia) {
        if (window.matchMedia("(orientation: portrait)").matches) return true;
        if (window.matchMedia("(orientation: landscape)").matches) return false;
      }
    } catch (e) {}
    var w = window.innerWidth || 0, h = window.innerHeight || 0;
    return h >= w;
  }

  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function nudgeResize() {
    try { window.dispatchEvent(new Event("resize")); } catch (e) {}
  }

  function canvasEl() { return document.getElementById("canvas"); }

  var btn = null, hint = null, toastEl = null, hintShown = false, toastTimer = null;

  function injectStyle() {
    var s = document.createElement("style");
    s.textContent =
      "#rpyFs{position:fixed;right:calc(10px + env(safe-area-inset-right,0px));" +
      "bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:none;" +
      "align-items:center;justify-content:center;min-width:52px;height:40px;padding:0 12px;border-radius:10px;" +
      "box-sizing:border-box;background:rgba(12,16,22,.66);border:1px solid rgba(217,180,94,.6);color:#d9b45e;" +
      "font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;font-size:12px;line-height:1;letter-spacing:.5px;" +
      "-webkit-user-select:none;user-select:none;touch-action:manipulation;box-shadow:0 4px 14px rgba(0,0,0,.4)}" +
      "#rpyFs.show{display:flex}" +
      "#rpyFs:active{background:rgba(217,180,94,.3)}" +
      "#rpyHint{position:fixed;left:50%;bottom:calc(60px + env(safe-area-inset-bottom,0px));" +
      "transform:translateX(-50%);z-index:2147483000;display:none;max-width:calc(100vw - 28px);" +
      "padding:8px 14px;border-radius:999px;box-sizing:border-box;background:rgba(12,16,22,.9);" +
      "border:1px solid rgba(217,180,94,.5);color:#e8e2d4;font-size:13px;white-space:nowrap;" +
      "font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;pointer-events:none;opacity:0;transition:opacity .4s}" +
      "#rpyHint.show{display:block;opacity:1}" +
      "#rpyToast{position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:2147483001;display:none;" +
      "max-width:calc(100vw - 40px);padding:10px 16px;border-radius:10px;box-sizing:border-box;" +
      "background:rgba(20,26,34,.96);border:1px solid rgba(255,255,255,.18);color:#f2efe6;font-size:13px;" +
      "line-height:1.5;text-align:center;font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;" +
      "box-shadow:0 8px 26px rgba(0,0,0,.5);pointer-events:none}" +
      "#rpyToast.show{display:block}" +
      "html.rpy-rot,html.rpy-rot body{overflow:hidden!important;height:100%!important;background:#000!important}" +
      "html.rpy-rot #presplash{display:none!important}" +
      "html.rpy-rot #canvas{position:fixed!important;left:50%!important;top:50%!important;" +
      "width:100vh!important;height:100vw!important;max-width:none!important;max-height:none!important;" +
      "transform:translate(-50%,-50%) rotate(90deg)!important;transform-origin:center center!important;" +
      "margin:0!important;z-index:1}";
    document.head.appendChild(s);
  }

  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "rpyToast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, ms || 4000);
  }

  function setBtn() {
    if (!btn) return;
    btn.textContent = (rotated || locked) ? "还原" : "横屏";
  }

  /* ---------- CSS 旋转兜底：输入重映射 ---------- */

  // 画布 CSS 盒为 (100vh, 100vw)，绕中心顺时针旋转 90°，铺满 (W,H) 视口：
  // 视觉点 (x,y) 对应的画布内坐标是 (H - y, x)
  function mapPoint(x, y) {
    var H = window.innerHeight;
    return { cx: H - y, cy: x };
  }

  function remapTouchList(list, c, rect) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var p = mapPoint(t.clientX, t.clientY);
      var clientX = rect.left + p.cx * (rect.width / c.width);
      var clientY = rect.top + p.cy * (rect.height / c.height);
      try {
        out.push(new Touch({
          identifier: t.identifier,
          target: c,
          clientX: clientX,
          clientY: clientY,
          pageX: clientX + window.scrollX,
          pageY: clientY + window.scrollY,
          screenX: t.screenX,
          screenY: t.screenY,
          radiusX: t.radiusX || 1,
          radiusY: t.radiusY || 1,
          rotationAngle: 0,
          force: t.force || 1
        }));
      } catch (e) {
        return null;
      }
    }
    return out;
  }

  function isOwnUi(target) {
    if (!target) return false;
    if (target === btn || target === hint || target === toastEl) return true;
    return !!(btn && btn.contains && btn.contains(target));
  }

  function makeTouchHandler(type) {
    return function (ev) {
      if (!rotated) return;
      if (isOwnUi(ev.target)) return;
      var c = canvasEl();
      if (!c) return;
      ev.preventDefault();
      ev.stopPropagation();
      var rect = c.getBoundingClientRect();
      var touches = remapTouchList(ev.touches || [], c, rect);
      var changed = remapTouchList(ev.changedTouches || [], c, rect);
      if (!touches || !changed) return;
      var synth;
      try {
        synth = new TouchEvent(type, {
          bubbles: true, cancelable: true,
          touches: touches, targetTouches: touches, changedTouches: changed
        });
      } catch (e) {
        return;
      }
      c.dispatchEvent(synth);
    };
  }

  function makeMouseHandler(type) {
    return function (ev) {
      if (!rotated) return;
      if (isOwnUi(ev.target)) return;
      var c = canvasEl();
      if (!c) return;
      ev.preventDefault();
      ev.stopPropagation();
      var rect = c.getBoundingClientRect();
      var p = mapPoint(ev.clientX, ev.clientY);
      var clientX = rect.left + p.cx * (rect.width / c.width);
      var clientY = rect.top + p.cy * (rect.height / c.height);
      var synth = new MouseEvent(type, {
        bubbles: true, cancelable: true,
        clientX: clientX, clientY: clientY,
        screenX: ev.screenX, screenY: ev.screenY,
        button: ev.button, buttons: ev.buttons
      });
      c.dispatchEvent(synth);
    };
  }

  var touchTypes = ["touchstart", "touchmove", "touchend", "touchcancel"];
  var mouseTypes = ["mousedown", "mousemove", "mouseup"];

  function bindRemap(on) {
    var method = on ? "addEventListener" : "removeEventListener";
    touchTypes.forEach(function (t) {
      window[method](t, makeTouchHandler(t), { capture: true, passive: false });
    });
    mouseTypes.forEach(function (t) {
      window[method](t, makeMouseHandler(t), true);
    });
  }

  function enableCssRotate() {
    document.documentElement.classList.add("rpy-rot");
    rotated = true;
    bindRemap(true);
    setBtn();
    setTimeout(nudgeResize, 300);
  }

  function disableCssRotate() {
    document.documentElement.classList.remove("rpy-rot");
    if (rotated) bindRemap(false);
    rotated = false;
    setBtn();
    setTimeout(nudgeResize, 300);
  }

  /* ---------- 主流程 ---------- */

  function tryLock() {
    if (!(screen.orientation && screen.orientation.lock)) return Promise.reject(new Error("no-lock-api"));
    try {
      return Promise.resolve(screen.orientation.lock("landscape"));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function enterLandscape() {
    if (busy) return;
    busy = true;

    function fallback() {
      locked = false;
      busy = false;
      if (!isPortrait() && !forceRotate) {
        toast("已经是横屏了", 2000);
        return;
      }
      enableCssRotate();
      toast("已用旋转模式横屏显示（部分浏览器不支持锁屏）。点「还原」可退出", 5000);
    }

    var el = document.documentElement;
    if (!fsElement()) {
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        try {
          var p = req.call(el);
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      }
    }

    tryLock().then(function () {
      locked = true;
      rotated = false;
      setBtn();
      busy = false;
      toast("已横屏", 2500);
      setTimeout(nudgeResize, 400);
    }).catch(fallback);
  }

  function exitLandscape() {
    if (busy) return;
    busy = true;
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    locked = false;
    disableCssRotate();
    if (fsElement()) {
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) { try { ex.call(document); } catch (e) {} }
    }
    setTimeout(function () { busy = false; nudgeResize(); }, 400);
    toast("已还原", 1800);
  }

  function build() {
    injectStyle();

    btn = document.createElement("button");
    btn.id = "rpyFs";
    btn.type = "button";
    btn.setAttribute("aria-label", "横屏");
    btn.textContent = "横屏";
    document.body.appendChild(btn);

    hint = document.createElement("div");
    hint.id = "rpyHint";
    hint.textContent = "点右下角「横屏」可以强制横屏";
    document.body.appendChild(hint);

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (rotated || locked) exitLandscape();
      else enterLandscape();
    });

    function layout() {
      if (forceShow || isPhone()) btn.classList.add("show");
      else btn.classList.remove("show");
      // 手机自己转成横屏后，不再需要 CSS 旋转兜底
      if (rotated && !isPortrait() && !busy && !forceRotate) disableCssRotate();
      if ((forceShow || isPhone()) && isPortrait() && !hintShown) {
        hintShown = true;
        hint.classList.add("show");
        setTimeout(function () { hint.classList.remove("show"); }, 6000);
      }
    }

    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("orientationchange", function () {
      setTimeout(function () { layout(); nudgeResize(); }, 300);
    });
    document.addEventListener("fullscreenchange", function () { setTimeout(nudgeResize, 350); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();

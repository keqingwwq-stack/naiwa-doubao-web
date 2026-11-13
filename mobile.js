/* 手机端：强制横屏按钮（全屏 + orientation.lock）+ 一次性提示。
   v4：单个「横屏」按钮，点一次强制横屏并全屏，再点一次还原；
   失败时给出明确文案，不再假装成功。 */
(function () {
  "use strict";

  var forceShow = /[?&]rotate=1/.test(location.search);
  var locked = false;
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

  var btn = null, hint = null, toastEl = null, hintShown = false, toastTimer = null;

  function injectStyle() {
    var style = document.createElement("style");
    style.textContent =
      "#rpyFs{position:fixed;right:calc(10px + env(safe-area-inset-right,0px));" +
      "bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:none;" +
      "align-items:center;justify-content:center;min-width:44px;height:40px;padding:0 12px;border-radius:10px;" +
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
      "#rpyToast{position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:2147483001;display:none;" +
      "max-width:calc(100vw - 40px);padding:10px 16px;border-radius:10px;box-sizing:border-box;" +
      "background:rgba(20,26,34,.96);border:1px solid rgba(255,255,255,.18);color:#f2efe6;font-size:13px;" +
      "line-height:1.5;text-align:center;font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;" +
      "box-shadow:0 8px 26px rgba(0,0,0,.5);pointer-events:none}" +
      "#rpyToast.show{display:block}";
    document.head.appendChild(style);
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
    btn.textContent = locked ? "还原" : "横屏";
  }

  function tryLock() {
    if (!(screen.orientation && screen.orientation.lock)) return Promise.reject(new Error("no-lock-api"));
    return screen.orientation.lock("landscape");
  }

  function enterLandscape() {
    if (busy) return;
    busy = true;
    var el = document.documentElement;
    var fs = fsElement();
    var goLock = function () {
      tryLock().then(function () {
        locked = true;
        setBtn();
        toast("已横屏。点右下角「还原」可以退出", 3000);
      }).catch(function (err) {
        locked = false;
        setBtn();
        var name = (err && (err.name || err.message)) || "unknown";
        if (name === "no-lock-api") {
          toast("这个浏览器不支持强制横屏。请打开手机的「自动旋转」，再把手机横过来", 6000);
        } else {
          toast("强制横屏被系统拒绝了（" + name + "）。请打开手机「自动旋转」后把手机横过来", 6000);
        }
      }).then(function () {
        busy = false;
        setTimeout(nudgeResize, 400);
      });
    };

    if (fs) { goLock(); return; }

    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) {
      // 没有全屏 API（如微信内置浏览器）：直接试锁方向
      goLock();
      return;
    }
    try {
      var p = req.call(el);
      if (p && p.then) p.then(goLock).catch(function () { goLock(); });
      else goLock();
    } catch (e) {
      goLock();
    }
  }

  function exitLandscape() {
    if (busy) return;
    busy = true;
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    locked = false;
    setBtn();
    if (fsElement()) {
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) { try { ex.call(document); } catch (e) {} }
    }
    setTimeout(function () { busy = false; nudgeResize(); }, 400);
    toast("已还原", 2000);
  }

  function build() {
    injectStyle();

    btn = document.createElement("button");
    btn.id = "rpyFs";
    btn.type = "button";
    btn.setAttribute("aria-label", "强制横屏");
    btn.textContent = "横屏";
    document.body.appendChild(btn);

    hint = document.createElement("div");
    hint.id = "rpyHint";
    hint.textContent = "点右下角「横屏」可强制横屏";
    document.body.appendChild(hint);

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (locked) exitLandscape();
      else enterLandscape();
    });

    function layout() {
      if (forceShow || isPhone()) btn.classList.add("show");
      else btn.classList.remove("show");
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
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener("change", function () {
        // 方向变化后同步按钮状态
        locked = !isPortrait();
        setBtn();
        setTimeout(nudgeResize, 300);
      });
    }
    document.addEventListener("fullscreenchange", function () { setTimeout(nudgeResize, 350); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();

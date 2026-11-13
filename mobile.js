/* 手机端：常驻全屏小按钮 + 一次性横屏提示（v3，不锁方向、不遮游戏、不做状态记忆） */
(function () {
  "use strict";

  var forceShow = /[?&]rotate=1/.test(location.search);

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

  var btn = null, hint = null, hintShown = false;

  function build() {
    var style = document.createElement("style");
    style.textContent =
      "#rpyFs{position:fixed;right:calc(10px + env(safe-area-inset-right,0px));" +
      "bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:none;" +
      "align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;box-sizing:border-box;" +
      "background:rgba(12,16,22,.62);border:1px solid rgba(217,180,94,.55);color:#d9b45e;" +
      "font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;font-size:11px;line-height:1;" +
      "-webkit-user-select:none;user-select:none;touch-action:manipulation}" +
      "#rpyFs.show{display:flex}" +
      "#rpyFs:active{background:rgba(217,180,94,.25)}" +
      "#rpyHint{position:fixed;left:50%;bottom:calc(58px + env(safe-area-inset-bottom,0px));" +
      "transform:translateX(-50%);z-index:2147483000;display:none;max-width:calc(100vw - 28px);" +
      "padding:8px 14px;border-radius:999px;box-sizing:border-box;background:rgba(12,16,22,.9);" +
      "border:1px solid rgba(217,180,94,.5);color:#e8e2d4;font-size:13px;white-space:nowrap;" +
      "font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;pointer-events:none;" +
      "transition:opacity .4s;opacity:0}" +
      "#rpyHint.show{display:block;opacity:1}";
    document.head.appendChild(style);

    btn = document.createElement("button");
    btn.id = "rpyFs";
    btn.type = "button";
    btn.setAttribute("aria-label", "全屏");
    btn.textContent = "全屏";
    document.body.appendChild(btn);

    hint = document.createElement("div");
    hint.id = "rpyHint";
    hint.textContent = "把手机横过来玩，画面更大";
    document.body.appendChild(hint);

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (fsElement()) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) { try { ex.call(document); } catch (err) {} }
        setTimeout(nudgeResize, 400);
        return;
      }
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) { btn.classList.remove("show"); return; }
      try {
        var p = req.call(el);
        if (p && p.then) { p.then(function () { setTimeout(nudgeResize, 400); }).catch(function () {}); }
        else { setTimeout(nudgeResize, 400); }
      } catch (err) {}
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
    // 注意：这里不能调用 nudgeResize()，否则会 dispatch resize 造成无限递归
    window.addEventListener("resize", layout);
    window.addEventListener("orientationchange", function () {
      setTimeout(function () { layout(); nudgeResize(); }, 300);
    });
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener("change", function () { setTimeout(nudgeResize, 300); });
    }
    document.addEventListener("fullscreenchange", function () { setTimeout(nudgeResize, 350); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();

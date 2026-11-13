/* 手机横屏提示（v2）：只在竖屏时弹一条不挡游戏的小横条，可关闭、可全屏。 */
(function () {
  "use strict";

  var forceShow = /[?&]rotate=1/.test(location.search);
  var DISMISS_KEY = "rpyRotateDismissedAt";
  var DISMISS_MS = 12 * 60 * 60 * 1000; // 关掉后 12 小时内不再弹

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
      if (window.matchMedia && window.matchMedia("(orientation: portrait)").matches) return true;
      if (window.matchMedia && window.matchMedia("(orientation: landscape)").matches) return false;
    } catch (e) {}
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var h = window.innerHeight || document.documentElement.clientHeight || 0;
    return h > w;
  }

  function dismissedRecently() {
    try {
      var t = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
      return t > 0 && (Date.now() - t) < DISMISS_MS;
    } catch (e) {
      return false;
    }
  }

  var bar = null, hideTimer = null;

  function build() {
    var style = document.createElement("style");
    style.textContent =
      "#rpyHint{position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));" +
      "transform:translateX(-50%);z-index:2147483000;display:none;align-items:center;gap:10px;" +
      "max-width:calc(100vw - 24px);padding:9px 10px 9px 14px;border-radius:999px;box-sizing:border-box;" +
      "background:rgba(12,16,22,.92);border:1px solid rgba(217,180,94,.55);box-shadow:0 6px 22px rgba(0,0,0,.45);" +
      "font-family:'Microsoft YaHei UI','PingFang SC','Noto Sans CJK SC',sans-serif;color:#e8e2d4;" +
      "-webkit-user-select:none;user-select:none;touch-action:manipulation}" +
      "#rpyHint.show{display:flex}" +
      "#rpyHint .txt{font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#rpyHint .go{flex:0 0 auto;font:inherit;font-size:13px;padding:6px 14px;border-radius:999px;" +
      "border:1px solid #d9b45e;background:rgba(217,180,94,.14);color:#d9b45e}" +
      "#rpyHint .go:active{background:rgba(217,180,94,.3)}" +
      "#rpyHint .x{flex:0 0 auto;width:26px;height:26px;line-height:24px;text-align:center;border-radius:50%;" +
      "border:0;background:transparent;color:#8b98a5;font-size:17px;padding:0}" +
      "#rpyHint .x:active{color:#e8e2d4}";
    document.head.appendChild(style);

    bar = document.createElement("div");
    bar.id = "rpyHint";
    bar.innerHTML =
      '<span class="txt">手机横过来玩，画面更大</span>' +
      '<button class="go" type="button">全屏横屏</button>' +
      '<button class="x" type="button" aria-label="关闭">×</button>';
    document.body.appendChild(bar);

    bar.querySelector(".go").addEventListener("click", function () {
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      var locked = false;
      function after() {
        if (!locked && screen.orientation && screen.orientation.lock) {
          locked = true;
          try { screen.orientation.lock("landscape").catch(function () {}); } catch (e) {}
        }
        setTimeout(update, 400);
      }
      if (req) {
        try {
          var p = req.call(el);
          if (p && p.then) p.then(after).catch(after);
          else after();
        } catch (e) { after(); }
      } else { after(); }
    });

    bar.querySelector(".x").addEventListener("click", function () {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
      bar.classList.remove("show");
    });
  }

  function update() {
    if (!bar) return;
    var show;
    if (forceShow) show = true;
    else show = isPhone() && isPortrait() && !dismissedRecently();
    if (show) {
      bar.classList.add("show");
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { bar.classList.remove("show"); }, 12000);
    } else {
      bar.classList.remove("show");
    }
  }

  function start() {
    build();
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", function () { setTimeout(update, 250); });
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener("change", function () { setTimeout(update, 250); });
    }
    document.addEventListener("fullscreenchange", function () { setTimeout(update, 300); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

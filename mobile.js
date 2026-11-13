/* 手机横屏支持：竖屏时提示旋转，可一键全屏并锁定横屏。桌面浏览器不受影响。 */
(function () {
  "use strict";

  var forceShow = /[?&]rotate=1/.test(location.search);

  function isPhone() {
    var ua = navigator.userAgent || "";
    if (/Android|iPhone|iPod|Windows Phone|Mobile|HarmonyOS|OpenHarmony/i.test(ua)) return true;
    // 平板/触屏设备：短边小于 820px 视为手机
    if (navigator.maxTouchPoints > 1 && screen && screen.width && screen.height) {
      return Math.min(screen.width, screen.height) < 820;
    }
    return false;
  }

  function isPortrait() {
    if (screen.orientation && typeof screen.orientation.type === "string") {
      return screen.orientation.type.indexOf("portrait") === 0;
    }
    return window.innerHeight >= window.innerWidth;
  }

  var mask = null;

  function build() {
    var style = document.createElement("style");
    style.textContent =
      "#rpyRotate{position:fixed;inset:0;z-index:2147483000;display:none;" +
      "background:radial-gradient(120% 120% at 50% 0%,#16202b 0%,#080b0f 70%);" +
      "color:#e8e2d4;font-family:'Microsoft YaHei UI','PingFang SC','Noto Sans CJK SC',sans-serif;" +
      "align-items:center;justify-content:center;flex-direction:column;text-align:center;" +
      "padding:24px;box-sizing:border-box;-webkit-user-select:none;user-select:none;touch-action:manipulation}" +
      "#rpyRotate.show{display:flex}" +
      "#rpyRotate .ico{width:96px;height:96px;margin-bottom:18px;animation:rpySpin 2.6s ease-in-out infinite}" +
      "#rpyRotate h1{font-size:22px;font-weight:600;margin:0 0 10px;color:#d9b45e;letter-spacing:.06em}" +
      "#rpyRotate p{font-size:14px;line-height:1.7;margin:0 0 22px;color:#9fb0bf;max-width:22em}" +
      "#rpyRotate button{font:inherit;font-size:15px;padding:12px 26px;border-radius:999px;border:1px solid #d9b45e;" +
      "background:transparent;color:#d9b45e;letter-spacing:.08em}" +
      "#rpyRotate button:active{background:rgba(217,180,94,.16)}" +
      "#rpyRotate .tip{margin-top:16px;font-size:12px;color:#5d6b78}" +
      "@keyframes rpySpin{0%,45%{transform:rotate(0)}55%,100%{transform:rotate(90deg)}}";
    document.head.appendChild(style);

    mask = document.createElement("div");
    mask.id = "rpyRotate";
    mask.innerHTML =
      '<svg class="ico" viewBox="0 0 100 100" aria-hidden="true">' +
      '<rect x="28" y="10" width="44" height="80" rx="8" fill="none" stroke="#d9b45e" stroke-width="4"/>' +
      '<rect x="42" y="78" width="16" height="3.5" rx="1.8" fill="#d9b45e"/>' +
      "</svg>" +
      "<h1>请把手机横过来</h1>" +
      "<p>这个游戏是横屏的，转一下手机就能全屏开玩。</p>" +
      '<button id="rpyRotateBtn" type="button">全屏横屏开始</button>' +
      '<div class="tip">转屏后若画面没有变大，点一下上面的按钮</div>';
    document.body.appendChild(mask);

    document.getElementById("rpyRotateBtn").addEventListener("click", function () {
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      var done = false;
      function lock() {
        if (!done && screen.orientation && screen.orientation.lock) {
          done = true;
          try {
            screen.orientation.lock("landscape").catch(function () {});
          } catch (e) {}
        }
        setTimeout(update, 350);
      }
      if (req) {
        try {
          var p = req.call(el);
          if (p && p.then) p.then(lock).catch(lock);
          else lock();
        } catch (e) {
          lock();
        }
      } else {
        lock();
      }
    });
  }

  function update() {
    if (!mask) return;
    if (forceShow) { mask.classList.add("show"); return; }
    if (!isPhone()) {
      mask.classList.remove("show");
      return;
    }
    if (isPortrait()) mask.classList.add("show");
    else mask.classList.remove("show");
  }

  function start() {
    build();
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", function () {
      setTimeout(update, 250);
    });
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener("change", function () {
        setTimeout(update, 250);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

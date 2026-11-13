/* 手机端显示适配 v6
   - 右下角「横屏」：全屏 + 尝试锁定横屏方向；浏览器拒绝时给出可行指引（不假装修好）
   - 「装到桌面」：支持 beforeinstallprompt 的浏览器一键安装；装上后按 manifest 的
     orientation: landscape-primary 启动，由系统保证横屏
   - 测试钩子：?rotate=1 强制显示按钮 */
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
    return (window.innerHeight || 0) >= (window.innerWidth || 0);
  }

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    } catch (e) {}
    return !!(navigator.standalone);
  }

  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function nudgeResize() {
    try { window.dispatchEvent(new Event("resize")); } catch (e) {}
  }

  var btnFs = null, btnInstall = null, hint = null, toastEl = null;
  var hintShown = false, toastTimer = null, deferredPrompt = null;

  function injectStyle() {
    var s = document.createElement("style");
    s.textContent =
      ".rpyBtn{position:fixed;right:calc(10px + env(safe-area-inset-right,0px));z-index:2147483000;" +
      "display:none;align-items:center;justify-content:center;min-width:52px;height:38px;padding:0 12px;" +
      "border-radius:10px;box-sizing:border-box;background:rgba(12,16,22,.66);" +
      "border:1px solid rgba(217,180,94,.6);color:#d9b45e;" +
      "font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;font-size:12px;line-height:1;" +
      "-webkit-user-select:none;user-select:none;touch-action:manipulation;box-shadow:0 4px 14px rgba(0,0,0,.4)}" +
      ".rpyBtn.show{display:flex}" +
      ".rpyBtn:active{background:rgba(217,180,94,.3)}" +
      "#rpyFs{bottom:calc(10px + env(safe-area-inset-bottom,0px))}" +
      "#rpyInstall{bottom:calc(56px + env(safe-area-inset-bottom,0px));border-color:rgba(120,200,255,.55);color:#8fd0ff}" +
      "#rpyHint{position:fixed;left:50%;bottom:calc(102px + env(safe-area-inset-bottom,0px));" +
      "transform:translateX(-50%);z-index:2147483000;display:none;max-width:calc(100vw - 28px);" +
      "padding:8px 14px;border-radius:999px;box-sizing:border-box;background:rgba(12,16,22,.9);" +
      "border:1px solid rgba(217,180,94,.5);color:#e8e2d4;font-size:13px;white-space:nowrap;" +
      "font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;pointer-events:none;opacity:0;transition:opacity .4s}" +
      "#rpyHint.show{display:block;opacity:1}" +
      "#rpyToast{position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:2147483001;display:none;" +
      "max-width:calc(100vw - 40px);padding:12px 16px;border-radius:10px;box-sizing:border-box;" +
      "background:rgba(20,26,34,.97);border:1px solid rgba(255,255,255,.18);color:#f2efe6;font-size:13px;" +
      "line-height:1.6;text-align:left;font-family:'Microsoft YaHei UI','PingFang SC',sans-serif;" +
      "box-shadow:0 8px 26px rgba(0,0,0,.5);pointer-events:none;white-space:pre-line}" +
      "#rpyToast.show{display:block}";
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
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, ms || 7000);
  }

  function setFsLabel() {
    if (!btnFs) return;
    btnFs.textContent = locked ? "还原" : "横屏";
  }

  function tryLock() {
    if (!(screen.orientation && screen.orientation.lock)) {
      return Promise.reject(new Error("no-lock-api"));
    }
    try {
      return Promise.resolve(screen.orientation.lock("landscape"));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function guidance() {
    var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    if (ios) {
      return "这个浏览器不能由网页强制横屏。\n\n" +
        "办法一：打开「控制中心」关掉竖屏锁定，把手机横过来。\n" +
        "办法二：用 Safari 打开本页，点「分享」→「添加到主屏幕」，图标启动时会自动横屏。";
    }
    return "这个浏览器不能由网页强制横屏。\n\n" +
      "办法一：下拉通知栏，打开「自动旋转」，再把手机横过来。\n" +
      "办法二：点右下角「装到桌面」，装成 App 后启动会自动横屏。\n" +
      "办法三：换 Chrome / Edge / 夸克 打开本页，再点「横屏」。";
  }

  function ensureFullscreen() {
    if (fsElement()) return Promise.resolve(true);
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var settled = false;
      function finish(ok) {
        if (settled) return;
        settled = true;
        document.removeEventListener("fullscreenchange", onChange);
        document.removeEventListener("webkitfullscreenchange", onChange);
        resolve(ok);
      }
      function onChange() { if (fsElement()) finish(true); }
      document.addEventListener("fullscreenchange", onChange);
      document.addEventListener("webkitfullscreenchange", onChange);
      try {
        var p = req.call(el);
        if (p && p.then) p.catch(function () { finish(false); });
      } catch (e) {
        finish(false);
      }
      setTimeout(function () { finish(!!fsElement()); }, 1200);
    });
  }

  function enterLandscape() {
    if (busy) return;
    busy = true;

    // Chrome/Edge 只有在真正进入全屏之后才允许 lock，所以必须先等全屏生效
    ensureFullscreen().then(function () {
      return new Promise(function (r) { setTimeout(r, 180); });
    }).then(function () {
      return tryLock();
    }).then(function () {
      locked = true;
      setFsLabel();
      busy = false;
      toast("已横屏", 2000);
      setTimeout(nudgeResize, 400);
    }).catch(function () {
      locked = false;
      busy = false;
      setFsLabel();
      toast(guidance(), 11000);
    });
  }

  function exitLandscape() {
    if (busy) return;
    busy = true;
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    locked = false;
    setFsLabel();
    if (fsElement()) {
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) { try { ex.call(document); } catch (e) {} }
    }
    setTimeout(function () { busy = false; nudgeResize(); }, 400);
    toast("已还原", 1500);
  }

  function build() {
    injectStyle();

    btnFs = document.createElement("button");
    btnFs.id = "rpyFs";
    btnFs.type = "button";
    btnFs.className = "rpyBtn";
    btnFs.textContent = "横屏";
    document.body.appendChild(btnFs);

    btnInstall = document.createElement("button");
    btnInstall.id = "rpyInstall";
    btnInstall.type = "button";
    btnInstall.className = "rpyBtn";
    btnInstall.textContent = "装到桌面";
    document.body.appendChild(btnInstall);

    hint = document.createElement("div");
    hint.id = "rpyHint";
    hint.textContent = "点右下角「横屏」或「装到桌面」";
    document.body.appendChild(hint);

    btnFs.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (locked) exitLandscape();
      else enterLandscape();
    });

    btnInstall.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (deferredPrompt) {
        var p = deferredPrompt;
        deferredPrompt = null;
        btnInstall.classList.remove("show");
        try { p.prompt(); } catch (err) {}
        return;
      }
      var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
      toast(ios
        ? "在 Safari 里点「分享」按钮，选「添加到主屏幕」，之后从图标启动会自动横屏。"
        : "在这个浏览器里没法一键安装。可以用 Chrome 打开本页，菜单里选「安装应用 / 添加到主屏幕」。", 9000);
    });

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (isPhone()) btnInstall.classList.add("show");
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      btnInstall.classList.remove("show");
      toast("已安装到桌面，之后从图标启动会自动横屏", 5000);
    });

    function layout() {
      var show = forceShow || (isPhone() && !isStandalone());
      if (show) btnFs.classList.add("show");
      else btnFs.classList.remove("show");
      if (deferredPrompt && show) btnInstall.classList.add("show");

      if (show && isPortrait() && !hintShown) {
        hintShown = true;
        hint.classList.add("show");
        setTimeout(function () { hint.classList.remove("show"); }, 6000);
      }
      if (!isPortrait() || isStandalone()) {
        hint.classList.remove("show");
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

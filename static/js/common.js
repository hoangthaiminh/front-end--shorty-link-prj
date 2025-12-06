/* common.js
   - POST /api/shorten
     Request body: { originalUrl, expireAt, customCode }
     Success 200: { shortUrl, qrCode } // qrCode is data:image/...;base64,...
     422: { detail: [ { loc: [...], msg: "...", type: "..." }, ... ] }

   - GET /{code}
     Success 200: returns plain string (redirect URL)
     422: same error shape as above
*/

/* ====== THEME HANDLING (light | dark | auto) ====== */
// const THEME_KEY = "ui_theme_mode";  // "light" | "dark" | "auto"
// const themeLink = document.getElementById("theme"); // <link id="theme" ...>
// const toggleBtn = document.getElementById("theme_toggle");

// function getInitialTheme(){
  // const saved = localStorage.getItem(THEME_KEY);
  // return saved || "auto";
// }

// function applyTheme(mode){
  // document.body.classList.remove("light", "dark", "auto");
  // document.body.classList.add(mode);

  // // decide actual css file using system when auto
  // let finalMode = mode;
  // if(mode === "auto"){
    // const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // finalMode = prefersDark ? "dark" : "light";
  // }

  // themeLink.href = finalMode === "dark"
    // ? "/static/css/bootstrap-dark.css"
    // : "/static/css/bootstrap-light.css";

  // localStorage.setItem(THEME_KEY, mode);
// }

// // initialize theme
// let currentTheme = getInitialTheme();
// applyTheme(currentTheme);

// // toggle cycle: light -> dark -> auto -> light ...
// if (toggleBtn) {
  // toggleBtn.addEventListener("click", () => {
    // const modes = ["light", "dark", "auto"];
    // const current = localStorage.getItem(THEME_KEY) || "auto";
    // const next = modes[(modes.indexOf(current) + 1) % modes.length];
    // applyTheme(next);
    // toggleBtn.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 220 });
  // });
// }

// // react to system change only if user mode is auto
// if (window.matchMedia) {
  // window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
    // if ((localStorage.getItem(THEME_KEY) || "auto") === "auto") applyTheme("auto");
  // });
// }

/* ====== DOM refs ====== */
const btnCreate = document.getElementById("btn_create");
const inputUrl = document.getElementById("input_url");
const customCode = document.getElementById("custom_code");
const expiryDate = document.getElementById("expiry_date");
const resultBox = document.getElementById("result_box");
const shortUrlInput = document.getElementById("short_url");
const qrImg = document.getElementById("qr_image");
const btnCopy = document.getElementById("btn_copy");
const btnDownloadQr = document.getElementById("btn_download_qr");
const createText = document.getElementById("create_text");
const createLoading = document.getElementById("create_loading");

/* safe DOM checks */
function $(el){ return document.getElementById(el); }

function clearErrors() {
  document.querySelectorAll(".form-error").forEach(el => el.textContent = "");
  document.querySelectorAll(".form-control").forEach(el => el.classList.remove("is-invalid"));
}

/* ====== UI helpers ====== */
function setLoading(on){
  if(!btnCreate || !createLoading || !createText) return;
  btnCreate.disabled = on;
  createLoading.classList.toggle("hidden", !on);
  createText.classList.toggle("hidden", on);
}

/* show validation/error messages from 422 in a readable form */
async function parseAndShowValidation(res) {
  let body = null;
  resultBox.classList.add("hidden");
  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;

    return (
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable === true
    );
  }

  try { body = await res.json(); } catch(e) {}

  if (body && body.detail) {
    body.detail.forEach(err => {
      const loc = err.loc;      // ví dụ ["body", "originalUrl"]
      const msg = err.msg;

      const field = loc[1];     // "originalUrl"

      // map field → input element's ID
      const map = {
        originalUrl: "input_url",
        expireAt: "expiry_date",
        customCode: "custom_code",
      };

      if (map[field]) {
        // lấy input
        const input = document.getElementById(map[field]);

        // lấy div error tương ứng
        const errBox = document.getElementById("error_" + map[field]);

        if (input) input.classList.add("is-invalid");
        if (errBox) errBox.textContent = msg;
        
        if (!isInputFocused()) {
          input.focus();
        }
      }
    });
  }
}

/* ====== COPY TO CLIPBOARD ====== */
if (btnCopy) {
  btnCopy.addEventListener("click", async () => {
    let copyTooltip = null;
    let copyTooltipTimer = null;

    function showTooltip(target, message) {
      if (copyTooltip) {
        copyTooltip.remove();
        clearTimeout(copyTooltipTimer);
      }

      const tooltip = document.createElement("div");
      tooltip.className = "copy-tooltip";
      tooltip.textContent = message;
      document.body.appendChild(tooltip);

      const rect = target.getBoundingClientRect();

      // Định vị chuẩn với offset scroll
      const viewportTop = rect.top + window.scrollY;
      const viewportLeft = rect.left + window.scrollX;

      const spaces = {
        top:    rect.top,
        bottom: window.innerHeight - rect.bottom,
        left:   rect.left,
        right:  window.innerWidth - rect.right
      };

      const best = Object.entries(spaces).sort((a,b)=>b[1]-a[1])[0][0];
      tooltip.dataset.pos = best;

      const tW = tooltip.offsetWidth;
      const tH = tooltip.offsetHeight;

      let top = 0, left = 0;

      if (best === "top") {
        top = viewportTop - tH - 14;
        left = viewportLeft + (rect.width - tW) / 2;
      }
      else if (best === "bottom") {
        top = viewportTop + rect.height + 14;
        left = viewportLeft + (rect.width - tW) / 2;
      }
      else if (best === "left") {
        top = viewportTop + (rect.height - tH) / 2;
        left = viewportLeft - tW - 14;
      }
      else if (best === "right") {
        top = viewportTop + (rect.height - tH) / 2;
        left = viewportLeft + rect.width + 14;
      }

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;

      requestAnimationFrame(() => tooltip.classList.add("show"));

      copyTooltip = tooltip;

      copyTooltipTimer = setTimeout(() => {
        tooltip.classList.remove("show");
        setTimeout(() => {
          tooltip.remove();
          if (copyTooltip === tooltip) copyTooltip = null;
        }, 200);
      }, 1200);
    }
    const val = shortUrlInput && shortUrlInput.value;
    if (!val) return;

    try {
      await navigator.clipboard.writeText(val);

      btnCopy.classList.add("btn-success");
      showTooltip(btnCopy, "Copied");

      setTimeout(()=> btnCopy.classList.remove("btn-success"), 900);
    } catch (err) {
      try {
        shortUrlInput.select();
        document.execCommand('copy');

        btnCopy.classList.add("btn-success");
        showTooltip(btnCopy, "Copied");

        setTimeout(()=> btnCopy.classList.remove("btn-success"), 900);
      } catch(e) {
        showTooltip(btnCopy, "Copy failed");
        console.error(e);
      }
    }
  });
}

/* ====== DOWNLOAD QR (data URL or remote) ====== */
if (btnDownloadQr) {
  btnDownloadQr.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!qrImg || !qrImg.src) return;
    const src = qrImg.src;
    if (src.startsWith("data:")) {
      // data url -> direct download
      const a = document.createElement("a");
      a.href = src;
      a.download = "qrcode.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    // else fetch remote and download blob
    try {
      const resp = await fetch(src, { cache: "no-store" });
      if (!resp.ok) throw new Error("Không tải được QR");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qrcode.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download QR fail", err);
      alert("Không thể tải QR. Vui lòng thử lại.");
    }
  });
}

/* ====== POST /api/shorten ======
   payload:
   {
     originalUrl: "https://example.com/",
     expireAt: "stringDate" | null,
     customCode: "string" | null
   }
   response 200: { shortUrl: "string", qrCode: "data:image/..." }
   response 422: { detail: [ ... ] }
*/
async function createShorten(originalUrl, expireAt = null, customCodeVal = null) {
  const payload = {
    originalUrl: originalUrl,
    expireAt: expireAt || null,
    customCode: customCodeVal || null
  };

  const res = await fetch("/api/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (res.status === 200) {
    return await res.json(); // { shortUrl, qrCode }
  } else if (res.status === 422) {
    // validation error
    await parseAndShowValidation(res);
    throw new Error("Validation error");
  } else {
    const txt = await res.text().catch(()=>res.statusText || "Lỗi server");
    throw new Error(txt || "Server error");
  }
}

/* ====== GET /{code} ======
   returns plain text redirect link (200) or 422 validation error
*/
async function lookupCode(code) {
  const path = "/" + encodeURIComponent(code);
  const res = await fetch(path, { method: "GET" });
  if (res.status === 200) {
    // server returns plain string body
    const text = await res.text();
    return text;
  } else if (res.status === 422) {
    await parseAndShowValidation(res);
    throw new Error("Validation error");
  } else {
    throw new Error(res.statusText || "Lookup error");
  }
}

/* ====== UI: bind create button ====== */
if (btnCreate) {
  btnCreate.addEventListener("click", async (ev) => {
    ev.preventDefault();
    clearErrors();
    document.activeElement.blur();
    const originalUrl = inputUrl && inputUrl.value && inputUrl.value.trim();
    if (!originalUrl) {
      document.getElementById("input_url").classList.add("is-invalid");
      document.getElementById("error_input_url").textContent = "Trường này không được để trống!";
      resultBox.classList.add("hidden");
      inputUrl && inputUrl.focus();
      return;
    }

    // prepare payload fields according to API
    const expireAtVal = expiryDate && expiryDate.value ? expiryDate.value : null;
    const customCodeVal = customCode && customCode.value ? customCode.value.trim() : null;

    try {
      setLoading(true);

      const data = await createShorten(originalUrl, expireAtVal, customCodeVal);
      // expected: data.shortUrl, data.qrCode (data:image/...)
      if (data && data.shortUrl) {
        shortUrlInput.value = data.shortUrl;
        // show result
        resultBox.classList.remove("hidden");
        updateWrapWidths();
      } else {
        shortUrlInput.value = "";
      }

      if (data && data.qrCode) {
        // qrCode is data:image/... base64
        qrImg.src = data.qrCode;
      } else {
        qrImg.src = "/static/icons/qr-placeholder.png";
      }
    } catch (err) {
      // console.error("Create error:", err);
      if (err.message && err.message !== "Validation error") {
        alert("Tạo link thất bại: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  });
}

function updateWrapWidths() {
    const items = document.querySelectorAll("#result_box .flex.flex-wrap > *");
    if (items.length === 0) return;

    let firstTop = items[0].offsetTop;

    items.forEach(el => {
        el.classList.remove("w-full");

        // Nếu phần tử nằm ở dòng mới -> offsetTop lớn hơn dòng đầu
        if (el.offsetTop > firstTop) {
            el.classList.add("w-full"); // xuống hàng → chiếm 100%
        }
    });
}

/* === Các sự kiện === */
window.addEventListener("load", updateWrapWidths);
window.addEventListener("resize", updateWrapWidths);
inputUrl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    btnCreate.click();
  }
});
customCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    btnCreate.click();
  }
});


/* ====== optionally expose functions to global for manual use/debug ====== */
window.SHORTENER = {
  createShorten,
  lookupCode
};

/* common.js
   - POST /api/shorten
     Request body: { originalUrl, expireAt, customCode }
     Success 200: { shortUrl, qrCode } // qrCode is data:image/...;base64,...
     422: { detail: [ { loc: [...], msg: "...", type: "..." }, ... ] }

   - GET /{code}
     Success 200: returns plain string (redirect URL)
     422: same error shape as above
*/

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
function $(el) { 
  return document.getElementById(el); 
}

function clearErrors() {
  document.querySelectorAll(".form-error").forEach(el => el.textContent = "");
  document.querySelectorAll("input").forEach(el => el.classList.remove("is-invalid"));
}

/* ====== UI helpers ====== */
function setLoading(on) {
  if (!btnCreate || !createLoading || !createText) return;
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

  try { 
    body = await res.json(); 
  } catch(e) {}
  
  if (body && body.detail) {
    body.detail.forEach(err => {
      const loc = err.loc;
      const msg = err.msg;
      const field = loc[1];
      // map field → input element's ID
      const map = {
        originalUrl: "input_url",
        expireAt: "expiry_date",
        customCode: "custom_code",
      };
      if (map[field]) {
        const input = document.getElementById(map[field]);
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
      btnCopy.classList.add("bg-green-600");
      showTooltip(btnCopy, "Copied");
      setTimeout(() => btnCopy.classList.remove("bg-green-600"), 900);
    } catch (err) {
      try {
        shortUrlInput.select();
        document.execCommand('copy');
        btnCopy.classList.add("bg-green-600");
        showTooltip(btnCopy, "Copied");
        setTimeout(() => btnCopy.classList.remove("bg-green-600"), 900);
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
      const a = document.createElement("a");
      a.href = src;
      a.download = "qrcode.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    
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

/* ====== POST /api/shorten ====== */
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
    return await res.json();
  } else if (res.status === 422) {
    await parseAndShowValidation(res);
    throw new Error("Validation error");
  } else {
    const txt = await res.text().catch(() => res.statusText || "Lỗi server");
    throw new Error(txt || "Server error");
  }
}

async function lookupCode(code) {
  const path = "/" + encodeURIComponent(code);
  const res = await fetch(path, { method: "GET" });
  
  if (res.status === 200) {
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
    
    const expireAtVal = expiryDate && expiryDate.value ? expiryDate.value : null;
    const customCodeVal = customCode && customCode.value ? customCode.value.trim() : null;
    try {
      setLoading(true);

      const data = await createShorten(originalUrl, expireAtVal, customCodeVal);
      
      if (data && data.shortUrl) {
        shortUrlInput.value = data.shortUrl;
        resultBox.classList.remove("hidden");
        updateWrapWidths();
      } else {
        shortUrlInput.value = "";
      }
      if (data && data.qrCode) {
        qrImg.src = data.qrCode;
      } else {
        qrImg.src = "/static/icons/qr-placeholder.png";
      }
    } catch (err) {
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
    if (el.offsetTop > firstTop) {
      el.classList.add("w-full");
    }
  });
}

/* ====== DARK MODE ====== */
const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const themeToggleMobile = document.getElementById('theme-toggle-mobile');
const lightIcon = document.getElementById('light-icon');
const darkIcon = document.getElementById('dark-icon');
const lightIconMobile = document.getElementById('light-icon-mobile');
const darkIconMobile = document.getElementById('dark-icon-mobile');

// Update icon visibility based on theme
function updateIcons(isDark) {
  if (lightIcon && darkIcon) {
    if (isDark) {
      lightIcon.classList.remove('hidden');
      darkIcon.classList.add('hidden');
    } else {
      lightIcon.classList.add('hidden');
      darkIcon.classList.remove('hidden');
    }
  }
  
  if (lightIconMobile && darkIconMobile) {
    if (isDark) {
      lightIconMobile.classList.remove('hidden');
      darkIconMobile.classList.add('hidden');
    } else {
      lightIconMobile.classList.add('hidden');
      darkIconMobile.classList.remove('hidden');
    }
  }
}

// Set dark mode as default on first visit
if (!localStorage.getItem('theme')) {
  localStorage.setItem('theme', 'dark');
}

// Initialize theme on page load
const currentTheme = localStorage.getItem('theme') || 'dark';
const isDarkMode = currentTheme === 'dark';

// Update icons after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  updateIcons(isDarkMode);
});

// Toggle theme function
function toggleTheme() {
  html.classList.toggle('dark');
  const isDark = html.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateIcons(isDark);
}

if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
if (themeToggleMobile) themeToggleMobile.addEventListener('click', toggleTheme);

/* ====== Event listeners ====== */
window.addEventListener("load", updateWrapWidths);
window.addEventListener("resize", updateWrapWidths);

if (inputUrl) {
  inputUrl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnCreate.click();
    }
  });
}

if (customCode) {
  customCode.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnCreate.click();
    }
  });
}

/* ====== expose functions to global for manual use/debug ====== */
window.SHORTENER = {
  createShorten,
  lookupCode
};


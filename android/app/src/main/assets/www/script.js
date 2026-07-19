class CameraCore {
  constructor() {
    // Elementy UI
    this.videoElement = document.getElementById("live-feed");
    this.canvasElement = document.getElementById("capture-canvas");
    this.logPanel = document.getElementById("event-log");

    this.infoLabel = document.getElementById("cam-info");
    this.resLabel = document.getElementById("cam-res");
    this.formatLabel = document.getElementById("barcode-format");
    this.lensLabel = document.getElementById("lens-label");
    this.scanLaser = document.getElementById("scan-laser");

    this.btnPower = document.getElementById("btn-power");
    this.btnTorch = document.getElementById("btn-torch");
    this.btnLensCycle = document.getElementById("btn-lens-cycle");
    this.btnScanCode = document.getElementById("btn-scan-code");
    this.btnCapture = document.getElementById("btn-capture");

    // Nowe elementy UI dla Auto Scan i WhatsApp
    this.btnAutoScan = document.getElementById("btn-auto-scan");
    this.autoScanText = document.getElementById("auto-scan-text");
    this.inputScannedVal = document.getElementById("input-scanned-val");
    this.btnCopyInput = document.getElementById("btn-copy-input");
    this.whatsappPhoneInput = document.getElementById("whatsapp-phone-input");
    this.btnSaveWhatsapp = document.getElementById("btn-save-whatsapp");
    this.btnSendToWhatsapp = document.getElementById("btn-send-to-whatsapp");
    this.scanReticle = document.getElementById("scan-reticle");
    this.scanHitLabel = document.getElementById("scan-hit-label");
    this.scanFlashTimer = null;

    this.zoomContainer = document.getElementById("zoom-container");
    this.zoomSlider = document.getElementById("zoom-slider");
    this.zoomVal = document.getElementById("zoom-val");

    // Elementy UI Historii
    this.historyOverlay = document.getElementById("history-overlay");
    this.historyList = document.getElementById("history-list");
    this.btnToggleHistory = document.getElementById("btn-toggle-history");
    this.btnCloseHistory = document.getElementById("btn-close-history");
    this.btnClearHistory = document.getElementById("btn-clear-history");

    // Elementy UI Motywu / PWA
    this.btnToggleTheme = document.getElementById("btn-toggle-theme");
    this.themeBtnText = document.getElementById("theme-btn-text");
    this.btnInstallPwa = document.getElementById("btn-install-pwa");
    this.deferredInstallPrompt = null;

    // Zmienne Stanu
    this.currentStream = null;
    this.hasTorchSupport = false;
    this.isTorchOn = false;
    this.isPowerOn = false;
    this.hasInitialPermission = false;
    this.isAutoScanOn = false;
    this.autoScanInterval = null;
    this.autoScanTimeout = null;
    this.isDetecting = false;
    this.lastScannedCodeValue = null;
    this.lastScannedCodeTime = 0;
    this.nativeBarcodeDetector = null;
    this.hasNativeDetector = "BarcodeDetector" in window;
    this.isIOSDevice = this.detectIOS();

    this.rearCameras = [];
    this.currentCameraIndex = 0;

    // Dane Historii
    this.scannedCodes = JSON.parse(
      localStorage.getItem("oxy_scanned_codes") || "[]",
    );

    // Dane Motywu
    this.currentTheme = localStorage.getItem("oxy_theme") || "dark";

    // Fallback skanera (html5-qrcode)
    this.barcodeFallbackReady = false;
    this.barcodeFallbackLoading = null;
    this.html5QrcodeInstance = null;

    // ROI celownika (zgodne z CSS .scan-reticle)
    this.scanRoi = { widthRatio: 0.88, heightRatio: 0.28 };

    this.initControls();
    this.applyTheme();
    this.initPwaInstall();

    // Wczytaj numer WhatsApp z pamięci
    if (this.whatsappPhoneInput) {
      this.whatsappPhoneInput.value =
        localStorage.getItem("oxy_whatsapp_phone") || "";
    }

    // Sprawdzenie protokołu (wymagane HTTPS dla kamery)
    if (window.isSecureContext === false) {
      this.sysLog("BŁĄD KRYTYCZNY: BRAK HTTPS. KAMERA ZABLOKOWANA.", "error");
      this.btnPower.classList.add("disabled");
    } else {
      this.sysLog("SYSTEM GOTOWY. OCZEKUJE NA ZASILANIE.", "sys");
      this.btnPower.classList.add("active-tool");
      this.btnPower.querySelector(".sub-text").textContent = "URUCHOM";
    }

    if (this.hasNativeDetector) {
      this.sysLog("DETEKTOR: NATYWNY BarcodeDetector", "sys");
    } else {
      this.sysLog("DETEKTOR: POLYFILL html5-qrcode", "sys");
      // iPhone/Safari — dociągnij polyfill z wyprzedzeniem
      this.ensureBarcodeFallback().catch(() => {});
    }

    if (this.isIOSDevice) {
      this.sysLog("PROFIL: iOS — facingMode + ROI AUTO", "sys");
    }
  }

  detectIOS() {
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }

  sysLog(msg, type = "sys") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.innerHTML =
      type === "highlight"
        ? `> ODCZYT: <span class="highlight">${msg}</span>`
        : `> ${msg}`;
    this.logPanel.appendChild(entry);
    this.logPanel.scrollTop = this.logPanel.scrollHeight;
  }

  togglePower() {
    if (this.isPowerOn) {
      this.shutdownCamera();
    } else {
      if (!this.hasInitialPermission) {
        this.initSystem();
      } else {
        // Przywróć poprzedni aparat
        const targetDeviceId =
          this.rearCameras.length > 0
            ? this.rearCameras[this.currentCameraIndex].deviceId
            : null;
        this.startSpecificCamera(targetDeviceId);
      }
    }
  }

  shutdownCamera() {
    this.sysLog("ODCINANIE ZASILANIA OPTYKI...", "sys");

    // Zatrzymanie trybu automatycznego
    this.stopAutoScanSilent();

    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop());
    }

    this.currentStream = null;
    this.videoElement.srcObject = null;
    this.isPowerOn = false;
    this.isTorchOn = false;

    // Resetowanie UI
    this.infoLabel.textContent = "SENSOR // OFFLINE";
    this.resLabel.textContent = "0x0";
    this.btnPower.classList.remove("active-tool");
    this.btnPower.querySelector(".sub-text").textContent = "WYŁĄCZONA";

    this.btnTorch.classList.add("disabled");
    this.btnTorch.classList.remove("active-tool");
    this.btnLensCycle.classList.add("disabled");
    this.btnScanCode.classList.add("disabled");
    this.btnAutoScan.classList.add("disabled");
    this.btnCapture.classList.add("disabled");
    this.zoomContainer.style.display = "none";

    this.sysLog("KAMERA ZATRZYMANA BEZPIECZNIE", "success");
  }

  async initSystem() {
    try {
      this.sysLog("INICJOWANIE UPLINKU DO SPRZĘTU...", "sys");

      // iOS: facingMode + rozsądna rozdzielczość; unikamy exact deviceId na starcie
      let stream = await navigator.mediaDevices.getUserMedia({
        video: this.buildVideoConstraints(null),
      });
      this.hasInitialPermission = true;

      await this.enumerateRearCameras();

      const targetDeviceId =
        this.rearCameras.length > 0 ? this.rearCameras[0].deviceId : null;

      const activeTrack = stream.getVideoTracks()[0];
      const activeDeviceId = activeTrack
        ? activeTrack.getSettings().deviceId
        : null;

      // Na iOS nie przełączaj kamery zaraz po starcie — facingMode już daje tylny sensor
      if (
        this.isIOSDevice ||
        (targetDeviceId &&
          activeDeviceId &&
          targetDeviceId === activeDeviceId) ||
        !targetDeviceId
      ) {
        await this.startSpecificCamera(targetDeviceId, stream);
      } else {
        stream.getTracks().forEach((t) => t.stop());
        await this.startSpecificCamera(targetDeviceId);
      }
    } catch (error) {
      let errMsg = error.message || error.name;
      if (error.name === "NotAllowedError") errMsg = "ODRZUCONO UPRAWNIENIA";
      if (error.name === "NotFoundError") errMsg = "BRAK KAMERY";
      this.sysLog(`BŁĄD SENSORA: ${errMsg}`, "error");
      this.infoLabel.textContent = "SENSOR // BŁĄD";
    }
  }

  buildVideoConstraints(deviceId) {
    const base = {
      facingMode: { ideal: "environment" },
      width: { ideal: this.isIOSDevice ? 1280 : 1920 },
      height: { ideal: this.isIOSDevice ? 720 : 1080 },
    };

    if (!deviceId) {
      return base;
    }

    // iOS Safari często pada na deviceId.exact — używamy ideal + facingMode
    if (this.isIOSDevice) {
      return {
        ...base,
        deviceId: { ideal: deviceId },
      };
    }

    return {
      width: base.width,
      height: base.height,
      deviceId: { exact: deviceId },
    };
  }

  async enumerateRearCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput",
      );

      const rearFiltered = videoDevices.filter((device) => {
        const label = device.label.toLowerCase();
        return (
          label.includes("back") ||
          label.includes("rear") ||
          label.includes("environment") ||
          label.includes("tył") ||
          label.includes("tyl")
        );
      });

      let cameras = rearFiltered.length > 0 ? rearFiltered : videoDevices;

      // Preferuj główny tylny obiektyw (nie ultra wide / tele) — lepsze kody kreskowe
      cameras = [...cameras].sort((a, b) => {
        const score = (label) => {
          const l = label.toLowerCase();
          let s = 0;
          if (l.includes("ultra") || l.includes("wide")) s -= 2;
          if (l.includes("tele")) s -= 1;
          if (l.includes("dual") || l.includes("triple")) s += 1;
          if (l === "back camera" || l === "rear camera") s += 3;
          return s;
        };
        return score(b.label) - score(a.label);
      });

      this.rearCameras = cameras;
      this.sysLog(`WYKRYTO SENSORY: ${this.rearCameras.length}`, "sys");
    } catch (err) {
      this.sysLog(`BŁĄD SKANOWANIA SPRZĘTU`, "error");
    }
  }

  cycleLens() {
    if (this.rearCameras.length <= 1 || !this.isPowerOn) return;

    this.currentCameraIndex++;
    if (this.currentCameraIndex >= this.rearCameras.length) {
      this.currentCameraIndex = 0;
    }

    const nextDevice = this.rearCameras[this.currentCameraIndex];
    this.startSpecificCamera(nextDevice.deviceId);
  }

  async startSpecificCamera(deviceId, existingStream = null) {
    this.stopAutoScanSilent();

    let track = null;

    if (existingStream) {
      this.sysLog("REUZYCIE STRUMIENIA AKTYWNEGO SENSORA", "sys");
      this.currentStream = existingStream;
      track = existingStream.getVideoTracks()[0];
    } else {
      if (this.currentStream) {
        this.sysLog("RESETOWANIE STRUMIENIA SENSORA...", "sys");
        this.currentStream.getTracks().forEach((t) => t.stop());
        this.currentStream = null;
        // iOS potrzebuje dłuższego resetu przed ponownym getUserMedia
        await new Promise((resolve) =>
          setTimeout(resolve, this.isIOSDevice ? 450 : 200),
        );
      }

      this.isTorchOn = false;
      if (this.btnTorch) {
        this.btnTorch.classList.remove("active-tool");
        this.btnTorch.classList.add("disabled");
      }
      if (this.zoomContainer) {
        this.zoomContainer.style.display = "none";
      }

      this.lensLabel.textContent = `OBIEKTYW ${this.currentCameraIndex + 1}`;

      try {
        this.sysLog(
          `ŁĄCZENIE Z SENSOR ID:${this.currentCameraIndex}...`,
          "sys",
        );
        this.currentStream = await navigator.mediaDevices.getUserMedia({
          video: this.buildVideoConstraints(deviceId),
        });
        track = this.currentStream.getVideoTracks()[0];
      } catch (error) {
        // Fallback: czysty facingMode (typowy fail iPhone przy deviceId)
        try {
          this.sysLog("FALLBACK: facingMode environment", "sys");
          this.currentStream = await navigator.mediaDevices.getUserMedia({
            video: this.buildVideoConstraints(null),
          });
          track = this.currentStream.getVideoTracks()[0];
        } catch (fallbackErr) {
          this.sysLog(
            `BŁĄD SENSORA: ${fallbackErr.message || fallbackErr.name}`,
            "error",
          );
          return;
        }
      }
    }

    if (track) {
      this.videoElement.onloadedmetadata = () => {
        this.resLabel.textContent = `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`;
        this.infoLabel.textContent = `LENS[${this.currentCameraIndex}] // ONLINE`;

        this.isPowerOn = true;
        this.btnPower.classList.add("active-tool");
        this.btnPower.querySelector(".sub-text").textContent = "WŁĄCZONA";

        if (this.rearCameras.length > 1) {
          this.btnLensCycle.classList.remove("disabled");
        } else {
          this.lensLabel.textContent = "1 OBIEKTYW";
        }
        this.btnScanCode.classList.remove("disabled");
        this.btnAutoScan.classList.remove("disabled");
        this.btnCapture.classList.remove("disabled");

        setTimeout(() => this.checkHardwareCapabilities(track), 500);
      };

      this.videoElement.setAttribute("playsinline", "true");
      this.videoElement.setAttribute("webkit-playsinline", "true");
      this.videoElement.muted = true;
      this.videoElement.srcObject = this.currentStream;
      try {
        await this.videoElement.play();
      } catch (e) {
        this.sysLog("BŁĄD STARTU PODGLĄDU WIDEO", "error");
      }
    }
  }

  checkHardwareCapabilities(track) {
    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      const settings = track.getSettings ? track.getSettings() : {};

      // Moduł Latarki
      if (capabilities.torch) {
        this.hasTorchSupport = true;
        this.btnTorch.classList.remove("disabled");
      } else {
        this.hasTorchSupport = false;
        this.btnTorch.classList.add("disabled");
      }

      // Moduł Zoomu
      if (capabilities.zoom) {
        this.zoomContainer.style.display = "flex";
        this.zoomSlider.min = capabilities.zoom.min || 1;
        this.zoomSlider.max = capabilities.zoom.max || 3;
        this.zoomSlider.step = capabilities.zoom.step || 0.1;

        const currentZoom = settings.zoom || capabilities.zoom.min || 1;
        this.zoomSlider.value = currentZoom;
        this.zoomVal.textContent = parseFloat(currentZoom).toFixed(1) + "x";

        this.zoomSlider.oninput = async (e) => {
          const val = e.target.value;
          this.zoomVal.textContent = parseFloat(val).toFixed(1) + "x";
          try {
            await track.applyConstraints({ advanced: [{ zoom: val }] });
          } catch (err) {}
        };
      } else {
        this.zoomContainer.style.display = "none";
      }
    } catch (e) {
      this.sysLog("BŁĄD ODCZYTU KONTROLERÓW SPRZĘTU", "error");
    }
  }

  async toggleTorch() {
    if (!this.currentStream || !this.hasTorchSupport || !this.isPowerOn) return;

    const track = this.currentStream.getVideoTracks()[0];
    this.isTorchOn = !this.isTorchOn;

    try {
      await track.applyConstraints({ advanced: [{ torch: this.isTorchOn }] });
      if (this.isTorchOn) {
        this.btnTorch.classList.add("active-tool");
        this.sysLog(`TORCH: AKTYWNY`, "sys");
      } else {
        this.btnTorch.classList.remove("active-tool");
        this.sysLog(`TORCH: WYGASZONY`, "sys");
      }
    } catch (err) {
      this.isTorchOn = false;
      this.btnTorch.classList.remove("active-tool");
    }
  }

  captureFrame() {
    if (!this.currentStream || !this.isPowerOn) return;

    const btnText = this.btnCapture.querySelector(".btn-text");
    btnText.textContent = "PRZETWARZANIE...";

    setTimeout(() => {
      try {
        const width = this.videoElement.videoWidth;
        const height = this.videoElement.videoHeight;
        if (!width || !height) {
          throw new Error("BRAK KLATKI WIDEO");
        }

        this.canvasElement.width = width;
        this.canvasElement.height = height;
        const ctx = this.canvasElement.getContext("2d");
        ctx.drawImage(this.videoElement, 0, 0, width, height);

        this.canvasElement.toBlob((blob) => {
          if (!blob) {
            this.sysLog("BŁĄD ZAPISU ZDJĘCIA", "error");
            btnText.textContent = "FOTO";
            return;
          }

          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `oxy-scan-${stamp}.png`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);

          this.sysLog("ZAPISANO ZDJĘCIE PNG", "success");
          btnText.textContent = "FOTO";
        }, "image/png");
      } catch (err) {
        this.sysLog(`BŁĄD FOTO: ${err.message}`, "error");
        btnText.textContent = "FOTO";
      }
    }, 300);
  }

  async ensureBarcodeFallback() {
    if (this.barcodeFallbackReady && window.Html5Qrcode) return true;
    if (this.barcodeFallbackLoading) return this.barcodeFallbackLoading;

    this.barcodeFallbackLoading = new Promise((resolve, reject) => {
      if (window.Html5Qrcode) {
        this.barcodeFallbackReady = true;
        resolve(true);
        return;
      }

      const existing = document.getElementById("html5-qrcode-cdn");
      if (existing) {
        existing.addEventListener("load", () => {
          this.barcodeFallbackReady = !!window.Html5Qrcode;
          resolve(this.barcodeFallbackReady);
        });
        existing.addEventListener("error", () =>
          reject(new Error("CDN LOAD FAIL")),
        );
        return;
      }

      const script = document.createElement("script");
      script.id = "html5-qrcode-cdn";
      script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
      script.async = true;
      script.onload = () => {
        this.barcodeFallbackReady = !!window.Html5Qrcode;
        if (this.barcodeFallbackReady) {
          resolve(true);
        } else {
          reject(new Error("Html5Qrcode UNAVAILABLE"));
        }
      };
      script.onerror = () => reject(new Error("CDN LOAD FAIL"));
      document.head.appendChild(script);
    }).finally(() => {
      this.barcodeFallbackLoading = null;
    });

    return this.barcodeFallbackLoading;
  }

  getFallbackScanner() {
    if (!this.html5QrcodeInstance && window.Html5Qrcode) {
      let holder = document.getElementById("barcode-fallback-reader");
      if (!holder) {
        holder = document.createElement("div");
        holder.id = "barcode-fallback-reader";
        holder.setAttribute("aria-hidden", "true");
        holder.style.cssText =
          "position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
        document.body.appendChild(holder);
      }
      this.html5QrcodeInstance = new window.Html5Qrcode(
        "barcode-fallback-reader",
      );
    }
    return this.html5QrcodeInstance;
  }

  /** Rysuje środkowy ROI (ramka celownika) na canvas — lepsze EAN/Code128. */
  captureScanRoiFrame() {
    const vw = this.videoElement.videoWidth;
    const vh = this.videoElement.videoHeight;
    if (!vw || !vh) return null;

    const rw = Math.max(32, Math.floor(vw * this.scanRoi.widthRatio));
    const rh = Math.max(32, Math.floor(vh * this.scanRoi.heightRatio));
    const sx = Math.floor((vw - rw) / 2);
    const sy = Math.floor((vh - rh) / 2);

    this.canvasElement.width = rw;
    this.canvasElement.height = rh;
    const ctx = this.canvasElement.getContext("2d", {
      willReadFrequently: true,
    });
    ctx.drawImage(this.videoElement, sx, sy, rw, rh, 0, 0, rw, rh);
    return this.canvasElement;
  }

  getNativeDetector() {
    if (!this.hasNativeDetector) return null;
    if (!this.nativeBarcodeDetector) {
      this.nativeBarcodeDetector = new BarcodeDetector({
        formats: [
          "qr_code",
          "ean_13",
          "ean_8",
          "code_128",
          "code_39",
          "data_matrix",
        ],
      });
    }
    return this.nativeBarcodeDetector;
  }

  async detectWithFallback() {
    await this.ensureBarcodeFallback();
    const scanner = this.getFallbackScanner();
    if (!scanner) throw new Error("POLYFILL NIEDOSTĘPNY");

    const frame = this.captureScanRoiFrame();
    if (!frame) return null;

    const blob = await new Promise((resolve) =>
      frame.toBlob(resolve, "image/jpeg", 0.72),
    );
    if (!blob) return null;

    const file = new File([blob], "scan-frame.jpg", { type: "image/jpeg" });
    try {
      const rawValue = await scanner.scanFile(file, false);
      if (!rawValue) return null;
      return { format: "UNKNOWN", rawValue: String(rawValue) };
    } catch {
      return null;
    }
  }

  registerDetectedCode(format, rawValue, isSilent) {
    if (isSilent) {
      const timeDiff = Date.now() - this.lastScannedCodeTime;
      if (this.lastScannedCodeValue === rawValue && timeDiff < 2500) {
        return false;
      }
    }

    this.lastScannedCodeValue = rawValue;
    this.lastScannedCodeTime = Date.now();

    if (this.inputScannedVal) {
      this.inputScannedVal.value = rawValue;
      this.inputScannedVal.style.borderColor = "var(--color-success)";
      setTimeout(() => {
        if (this.inputScannedVal) this.inputScannedVal.style.borderColor = "";
      }, 800);
    }

    const isDuplicate = this.scannedCodes.some(
      (item) => item.value === rawValue,
    );

    if (isDuplicate) {
      if (!isSilent) {
        this.formatLabel.textContent = "FMT: DUPLIKAT";
        this.sysLog("DUPLIKAT — NIE DODANO DO BAZY", "error");
        return true;
      }
      return false;
    }

    this.formatLabel.textContent = `FMT: ${format}`;
    this.sysLog(`FORMAT: ${format}`, "success");
    this.sysLog(rawValue, "highlight");

    const timeString = new Date().toLocaleTimeString();
    this.scannedCodes.unshift({
      format: format,
      value: rawValue,
      time: timeString,
    });
    localStorage.setItem(
      "oxy_scanned_codes",
      JSON.stringify(this.scannedCodes),
    );

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    this.flashScanSuccess(format);
    return true;
  }

  flashScanSuccess(format) {
    if (!this.scanReticle) return;
    this.scanReticle.classList.remove("scanned");
    void this.scanReticle.offsetWidth;
    this.scanReticle.classList.add("scanned");
    if (this.formatLabel) {
      this.formatLabel.textContent = "FMT: ZESKANOWANO";
    }
    clearTimeout(this.scanFlashTimer);
    this.scanFlashTimer = setTimeout(() => {
      if (this.scanReticle) this.scanReticle.classList.remove("scanned");
      if (this.formatLabel && format) {
        this.formatLabel.textContent = `FMT: ${format}`;
      }
    }, 900);
  }

  async detectCode(isSilent = false) {
    // iOS często trzyma readyState na HAVE_CURRENT_DATA (2), nie HAVE_ENOUGH_DATA (4)
    if (
      !this.currentStream ||
      !this.isPowerOn ||
      this.videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return;
    }

    let btnSub = null;
    if (!isSilent) {
      btnSub = this.btnScanCode.querySelector(".sub-text");
      if (btnSub) btnSub.textContent = "PRACA...";
      this.scanLaser.classList.add("active");
    }

    try {
      let found = false;
      const roiCanvas = this.captureScanRoiFrame();
      if (!roiCanvas) {
        if (!isSilent) {
          this.sysLog("NIE WYKRYTO ŻADNEGO KODU", "error");
          this.formatLabel.textContent = `FMT: BRAK DANYCH`;
        }
        return;
      }

      if (this.hasNativeDetector) {
        const barcodeDetector = this.getNativeDetector();
        const barcodes = await barcodeDetector.detect(roiCanvas);

        if (barcodes.length > 0) {
          const detectedCode = barcodes[0];
          const format = detectedCode.format.toUpperCase();
          const rawValue = detectedCode.rawValue;
          found = this.registerDetectedCode(format, rawValue, isSilent);
        }
      } else {
        const result = await this.detectWithFallback();
        if (result) {
          found = this.registerDetectedCode(
            result.format,
            result.rawValue,
            isSilent,
          );
        }
      }

      if (!found && !isSilent) {
        this.sysLog("NIE WYKRYTO ŻADNEGO KODU", "error");
        this.formatLabel.textContent = `FMT: BRAK DANYCH`;
      }
    } catch (error) {
      if (!isSilent) {
        this.sysLog(`BŁĄD: ${error.message}`, "error");
      }
    } finally {
      if (!isSilent) {
        this.scanLaser.classList.remove("active");
        if (btnSub) btnSub.textContent = "JEDNORAZOWY";
      }
    }
  }

  toggleAutoScan() {
    if (!this.isPowerOn) return;

    this.isAutoScanOn = !this.isAutoScanOn;

    if (this.isAutoScanOn) {
      this.btnAutoScan.classList.add("active-tool");
      this.autoScanText.textContent = "WŁĄCZONE";
      if (this.scanLaser) this.scanLaser.classList.add("active");
      this.sysLog("TRYB AUTOMATYCZNY AKTYWNY", "sys");
      if (!this.hasNativeDetector) {
        this.ensureBarcodeFallback().catch(() => {});
      }
      this.startAutoScanLoop();
    } else {
      this.stopAutoScan();
    }
  }

  startAutoScanLoop() {
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval);
      this.autoScanInterval = null;
    }
    if (this.autoScanTimeout) {
      clearTimeout(this.autoScanTimeout);
      this.autoScanTimeout = null;
    }

    const tick = async () => {
      if (!this.isAutoScanOn || !this.isPowerOn) return;

      if (!this.isDetecting) {
        this.isDetecting = true;
        try {
          await this.detectCode(true);
        } finally {
          this.isDetecting = false;
        }
      }

      // Polyfill + iOS: wolniejszy rytm, żeby nie zatykać Safari
      const delay = this.hasNativeDetector ? 320 : this.isIOSDevice ? 750 : 550;

      if (this.isAutoScanOn) {
        this.autoScanTimeout = setTimeout(tick, delay);
      }
    };

    tick();
  }

  stopAutoScan() {
    this.stopAutoScanSilent();
    this.sysLog("TRYB AUTOMATYCZNY DEAKTYWOWANY", "sys");
  }

  stopAutoScanSilent() {
    this.isAutoScanOn = false;
    this.isDetecting = false;
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval);
      this.autoScanInterval = null;
    }
    if (this.autoScanTimeout) {
      clearTimeout(this.autoScanTimeout);
      this.autoScanTimeout = null;
    }
    if (this.btnAutoScan) {
      this.btnAutoScan.classList.remove("active-tool");
    }
    if (this.autoScanText) {
      this.autoScanText.textContent = "WYŁĄCZONE";
    }
    if (this.scanLaser) {
      this.scanLaser.classList.remove("active");
    }
  }

  normalizeWhatsappPhone(raw) {
    return String(raw || "").replace(/\D/g, "");
  }

  isValidWhatsappPhone(phone) {
    return /^\d{9,15}$/.test(phone);
  }

  saveWhatsappPhone() {
    if (!this.whatsappPhoneInput) return;
    const phone = this.normalizeWhatsappPhone(this.whatsappPhoneInput.value);

    if (!phone) {
      localStorage.removeItem("oxy_whatsapp_phone");
      this.whatsappPhoneInput.value = "";
      this.sysLog("USUNIĘTO NUMER WHATSAPP", "sys");
      return;
    }

    if (!this.isValidWhatsappPhone(phone)) {
      this.sysLog("BŁĄD: NUMER 9–15 CYFR Z KIERUNKOWYM (np. 48500…)", "error");
      return;
    }

    this.whatsappPhoneInput.value = phone;
    localStorage.setItem("oxy_whatsapp_phone", phone);
    this.sysLog("ZAPISANO NUMER WHATSAPP", "success");
  }

  sendArchiveToWhatsapp() {
    if (!this.whatsappPhoneInput) return;

    const phone = this.normalizeWhatsappPhone(
      this.whatsappPhoneInput.value.trim() ||
        localStorage.getItem("oxy_whatsapp_phone") ||
        "",
    );

    if (!phone) {
      this.sysLog("BŁĄD: BRAK NUMERU WHATSAPP", "error");
      return;
    }

    if (!this.isValidWhatsappPhone(phone)) {
      this.sysLog("BŁĄD: NIEPRAWIDŁOWY NUMER WHATSAPP", "error");
      return;
    }

    if (this.scannedCodes.length === 0) {
      this.sysLog("BŁĄD: BRAK WPISÓW W ARCHIWUM", "error");
      return;
    }

    this.showConfirm("WYSŁAĆ RAPORT ARCHIWUM NA WHATSAPP?", () => {
      const textHeader = `Mobilny Skaner OXY — Raport Archiwum\nIlość skanów: ${this.scannedCodes.length}\nData: ${new Date().toLocaleString()}\n\n`;
      const textBody = this.scannedCodes
        .map((item) => `• [${item.format}] (${item.time}): ${item.value}`)
        .join("\n");
      const message = textHeader + textBody;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        window.location.href = url;
      }
      this.sysLog("OTWARTO WHATSAPP Z RAPORTEM", "success");
    });
  }

  openHistory() {
    this.renderHistory();
    this.historyOverlay.classList.add("open");
    this.sysLog("BAZA SKANÓW: OTWARTA", "sys");
  }

  closeHistory() {
    this.historyOverlay.classList.remove("open");
    this.sysLog("BAZA SKANÓW: ZAMKNIĘTA", "sys");
  }

  clearHistory() {
    this.showConfirm("CZY NA PEWNO CHCESZ SKASOWAĆ CAŁĄ BAZĘ DANYCH?", () => {
      this.scannedCodes = [];
      localStorage.setItem(
        "oxy_scanned_codes",
        JSON.stringify(this.scannedCodes),
      );
      this.renderHistory();
      this.sysLog("BAZA DANYCH SKASOWANA", "error");
    });
  }

  showConfirm(message, onConfirm) {
    const dialog = document.getElementById("custom-confirm-dialog");
    const msgEl = document.getElementById("custom-confirm-message");
    const btnCancel = document.getElementById("btn-confirm-cancel");
    const btnOk = document.getElementById("btn-confirm-ok");

    if (!dialog || !msgEl || !btnCancel || !btnOk) return;

    msgEl.textContent = message.toUpperCase();
    dialog.classList.add("open");

    // Resetowanie nasłuchiwaczy zdarzeń poprzez klonowanie elementów
    const newBtnCancel = btnCancel.cloneNode(true);
    const newBtnOk = btnOk.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);

    newBtnCancel.addEventListener("click", () => {
      dialog.classList.remove("open");
    });

    newBtnOk.addEventListener("click", () => {
      dialog.classList.remove("open");
      if (onConfirm) onConfirm();
    });
  }

  deleteHistoryItem(index) {
    this.scannedCodes.splice(index, 1);
    localStorage.setItem(
      "oxy_scanned_codes",
      JSON.stringify(this.scannedCodes),
    );
    this.renderHistory();
    this.sysLog("USUNIĘTO WPIS Z BAZY", "sys");
  }

  copyToClipboard(text, btnElement) {
    if (!text || !String(text).trim()) {
      this.sysLog("BRAK DANYCH DO SKOPIOWANIA", "error");
      return;
    }

    const labelEl = btnElement.querySelector(".btn-text") || btnElement;
    const originalText = labelEl.textContent;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        labelEl.textContent = "SKOPIOWANO!";
        btnElement.style.borderColor = "var(--color-success)";
        btnElement.style.color = "var(--color-success)";
        setTimeout(() => {
          labelEl.textContent = originalText;
          btnElement.style.borderColor = "";
          btnElement.style.color = "";
        }, 1000);
      })
      .catch(() => {
        this.sysLog("BŁĄD KOPIOWANIA", "error");
      });
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  renderHistory() {
    this.historyList.innerHTML = "";
    if (this.scannedCodes.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "history-empty-state";
      emptyState.textContent = "BRAK DANYCH W BAZIE";
      this.historyList.appendChild(emptyState);
      return;
    }

    this.scannedCodes.forEach((item, index) => {
      const historyItem = document.createElement("div");
      historyItem.className = "history-item";

      historyItem.innerHTML = `
                        <div class="history-item-header">
                            <span class="history-item-format">${item.format}</span>
                            <span>${item.time}</span>
                        </div>
                        <div class="history-item-value">${this.escapeHtml(item.value)}</div>
                        <div class="history-item-actions">
                            <button class="history-action-btn copy-btn">KOPIUJ</button>
                            <button class="history-action-btn delete-btn" style="border-color: rgba(255,51,102,0.3); color: var(--color-error)">USUŃ</button>
                        </div>
                    `;

      const copyBtn = historyItem.querySelector(".copy-btn");
      copyBtn.addEventListener("click", () =>
        this.copyToClipboard(item.value, copyBtn),
      );

      const deleteBtn = historyItem.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", () => this.deleteHistoryItem(index));

      this.historyList.appendChild(historyItem);
    });
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("oxy_theme", this.currentTheme);
    this.applyTheme();
    this.sysLog(`ZMIANA MOTYWU: ${this.currentTheme.toUpperCase()}`, "sys");
  }

  applyTheme() {
    if (this.currentTheme === "dark") {
      document.documentElement.setAttribute("theme", "dark");
      if (this.themeBtnText) this.themeBtnText.textContent = "☀";
    } else {
      document.documentElement.removeAttribute("theme");
      if (this.themeBtnText) this.themeBtnText.textContent = "🌙";
    }
  }

  isRunningAsInstalledPwa() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  initPwaInstall() {
    if (!this.btnInstallPwa) return;

    if (this.isRunningAsInstalledPwa()) {
      this.btnInstallPwa.hidden = true;
      return;
    }

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      this.btnInstallPwa.hidden = false;
      this.sysLog("PWA: GOTOWY DO INSTALACJI", "sys");
    });

    window.addEventListener("appinstalled", () => {
      this.deferredInstallPrompt = null;
      this.btnInstallPwa.hidden = true;
      this.sysLog("PWA: ZAINSTALOWANO", "success");
    });

    this.btnInstallPwa.addEventListener("click", () => this.promptPwaInstall());
  }

  async promptPwaInstall() {
    if (!this.deferredInstallPrompt) {
      this.sysLog(
        "PWA: UŻYJ MENU PRZEGLĄDARKI → DODAJ DO EKRANU GŁÓWNEGO",
        "sys",
      );
      return;
    }

    this.deferredInstallPrompt.prompt();
    const choice = await this.deferredInstallPrompt.userChoice;
    this.deferredInstallPrompt = null;
    this.btnInstallPwa.hidden = true;

    if (choice && choice.outcome === "accepted") {
      this.sysLog("PWA: INSTALACJA POTWIERDZONA", "success");
    } else {
      this.sysLog("PWA: INSTALACJA ANULOWANA", "sys");
    }
  }

  initControls() {
    if (this.btnPower)
      this.btnPower.addEventListener("click", () => this.togglePower());
    if (this.btnLensCycle)
      this.btnLensCycle.addEventListener("click", () => this.cycleLens());
    if (this.btnTorch)
      this.btnTorch.addEventListener("click", () => this.toggleTorch());
    if (this.btnCapture)
      this.btnCapture.addEventListener("click", () => this.captureFrame());
    if (this.btnScanCode)
      this.btnScanCode.addEventListener("click", () => this.detectCode());
    if (this.btnAutoScan)
      this.btnAutoScan.addEventListener("click", () => this.toggleAutoScan());
    if (this.btnCopyInput)
      this.btnCopyInput.addEventListener("click", () =>
        this.copyToClipboard(this.inputScannedVal.value, this.btnCopyInput),
      );
    if (this.btnToggleHistory)
      this.btnToggleHistory.addEventListener("click", () => this.openHistory());
    if (this.btnCloseHistory)
      this.btnCloseHistory.addEventListener("click", () => this.closeHistory());
    if (this.btnClearHistory)
      this.btnClearHistory.addEventListener("click", () => this.clearHistory());
    if (this.btnToggleTheme)
      this.btnToggleTheme.addEventListener("click", () => this.toggleTheme());
    if (this.btnSaveWhatsapp)
      this.btnSaveWhatsapp.addEventListener("click", () =>
        this.saveWhatsappPhone(),
      );
    if (this.btnSendToWhatsapp)
      this.btnSendToWhatsapp.addEventListener("click", () =>
        this.sendArchiveToWhatsapp(),
      );
  }
}

// Start aplikacji po załadowaniu drzewa DOM
document.addEventListener("DOMContentLoaded", () => {
  window.OXY_CameraSys = new CameraCore();

  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {
        // SW opcjonalny — brak rejestracji nie blokuje skanera
      });
  }
});

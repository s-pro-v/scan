class CameraCore {
    constructor() {
        // Elementy UI
        this.videoElement = document.getElementById('live-feed');
        this.canvasElement = document.getElementById('capture-canvas');
        this.logPanel = document.getElementById('event-log');

        this.infoLabel = document.getElementById('cam-info');
        this.resLabel = document.getElementById('cam-res');
        this.formatLabel = document.getElementById('barcode-format');
        this.lensLabel = document.getElementById('lens-label');
        this.scanLaser = document.getElementById('scan-laser');

        this.btnPower = document.getElementById('btn-power');
        this.btnTorch = document.getElementById('btn-torch');
        this.btnLensCycle = document.getElementById('btn-lens-cycle');
        this.btnScanCode = document.getElementById('btn-scan-code');
        this.btnCapture = document.getElementById('btn-capture');

        // Nowe elementy UI dla Auto Scan i Slack
        this.btnAutoScan = document.getElementById('btn-auto-scan');
        this.autoScanText = document.getElementById('auto-scan-text');
        this.inputScannedVal = document.getElementById('input-scanned-val');
        this.btnCopyInput = document.getElementById('btn-copy-input');
        this.slackWebhookInput = document.getElementById('slack-webhook-input');
        this.btnSaveWebhook = document.getElementById('btn-save-webhook');
        this.btnSendToSlack = document.getElementById('btn-send-to-slack');

        this.zoomContainer = document.getElementById('zoom-container');
        this.zoomSlider = document.getElementById('zoom-slider');
        this.zoomVal = document.getElementById('zoom-val');

        // Elementy UI Historii
        this.historyOverlay = document.getElementById('history-overlay');
        this.historyList = document.getElementById('history-list');
        this.btnToggleHistory = document.getElementById('btn-toggle-history');
        this.btnCloseHistory = document.getElementById('btn-close-history');
        this.btnClearHistory = document.getElementById('btn-clear-history');

        // Elementy UI Motywu
        this.btnToggleTheme = document.getElementById('btn-toggle-theme');
        this.themeBtnText = document.getElementById('theme-btn-text');

        // Zmienne Stanu
        this.currentStream = null;
        this.hasTorchSupport = false;
        this.isTorchOn = false;
        this.isPowerOn = false;
        this.hasInitialPermission = false;
        this.isAutoScanOn = false;
        this.autoScanInterval = null;
        this.lastScannedCodeValue = null;
        this.lastScannedCodeTime = 0;

        this.rearCameras = [];
        this.currentCameraIndex = 0;

        // Dane Historii
        this.scannedCodes = JSON.parse(localStorage.getItem('oxy_scanned_codes') || '[]');

        // Dane Motywu
        this.currentTheme = localStorage.getItem('oxy_theme') || 'dark';

        this.initControls();
        this.applyTheme();

        // Wczytaj webhook z pamięci
        if (this.slackWebhookInput) {
            this.slackWebhookInput.value = localStorage.getItem('oxy_slack_webhook') || '';
        }

        // Sprawdzenie protokołu (wymagane HTTPS dla kamery)
        if (window.isSecureContext === false) {
            this.sysLog('BŁĄD KRYTYCZNY: BRAK HTTPS. KAMERA ZABLOKOWANA.', 'error');
            this.btnPower.classList.add('disabled');
        } else {
            this.sysLog('SYSTEM GOTOWY. OCZEKUJE NA ZASILANIE.', 'sys');
            this.btnPower.classList.add('active-tool');
            this.btnPower.querySelector('.sub-text').textContent = 'KLIKNIJ';
        }
    }

    sysLog(msg, type = 'sys') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = type === 'highlight' ? `> ODCZYT: <span class="highlight">${msg}</span>` : `> ${msg}`;
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
                const targetDeviceId = this.rearCameras.length > 0
                    ? this.rearCameras[this.currentCameraIndex].deviceId
                    : null;
                this.startSpecificCamera(targetDeviceId);
            }
        }
    }

    shutdownCamera() {
        this.sysLog('ODCINANIE ZASILANIA OPTYKI...', 'sys');

        // Zatrzymanie trybu automatycznego
        this.stopAutoScanSilent();

        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
        }

        this.currentStream = null;
        this.videoElement.srcObject = null;
        this.isPowerOn = false;
        this.isTorchOn = false;

        // Resetowanie UI
        this.infoLabel.textContent = 'SENSOR // OFFLINE';
        this.resLabel.textContent = '0x0';
        this.btnPower.classList.remove('active-tool');
        this.btnPower.querySelector('.sub-text').textContent = 'OFFLINE';

        this.btnTorch.classList.add('disabled');
        this.btnTorch.classList.remove('active-tool');
        this.btnLensCycle.classList.add('disabled');
        this.btnScanCode.classList.add('disabled');
        this.btnAutoScan.classList.add('disabled');
        this.btnCapture.classList.add('disabled');
        this.zoomContainer.style.display = 'none';

        this.sysLog('KAMERA ZATRZYMANA BEZPIECZNIE', 'success');
    }

    async initSystem() {
        try {
            this.sysLog('INICJOWANIE UPLINKU DO SPRZĘTU...', 'sys');

            // Najpierw prosimy o ogólny dostęp, żeby odblokować EnumerateDevices
            let stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            this.currentStream = stream;
            this.hasInitialPermission = true;

            await this.enumerateRearCameras();

            const targetDeviceId = this.rearCameras.length > 0
                ? this.rearCameras[0].deviceId
                : null;

            await this.startSpecificCamera(targetDeviceId);

        } catch (error) {
            let errMsg = error.message || error.name;
            if (error.name === 'NotAllowedError') errMsg = 'ODRZUCONO UPRAWNIENIA';
            if (error.name === 'NotFoundError') errMsg = 'BRAK KAMERY';
            this.sysLog(`BŁĄD SENSORA: ${errMsg}`, 'error');
            this.infoLabel.textContent = 'SENSOR // BŁĄD';
        }
    }

    async enumerateRearCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            this.rearCameras = [];
            // Filtrujemy by znaleźć kamery tylne
            const rearFiltered = videoDevices.filter(device => {
                const label = device.label.toLowerCase();
                return label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('tył');
            });

            // Jeśli telefon nie zgłasza etykiet "tył", ładujemy wszystkie moduły wideo jako dostępne do przełączania
            if (rearFiltered.length > 0) {
                this.rearCameras = rearFiltered;
            } else {
                this.rearCameras = videoDevices;
            }
            this.sysLog(`WYKRYTO SENSORY: ${this.rearCameras.length}`, 'sys');
        } catch (err) {
            this.sysLog(`BŁĄD SKANOWANIA SPRZĘTU`, 'error');
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

    async startSpecificCamera(deviceId) {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
        }

        this.isTorchOn = false;
        this.btnTorch.classList.remove('active-tool');
        this.btnTorch.classList.add('disabled');
        this.zoomContainer.style.display = 'none';

        this.lensLabel.textContent = `LENS_ID: ${this.currentCameraIndex}`;

        const constraints = deviceId
            ? { video: { deviceId: { exact: deviceId } } }
            : { video: { facingMode: "environment" } };

        try {
            this.sysLog(`ŁĄCZENIE Z SENSOR ID:${this.currentCameraIndex}...`, 'sys');
            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.currentStream;

            try { await this.videoElement.play(); } catch (e) { }

            const track = this.currentStream.getVideoTracks()[0];

            this.videoElement.onloadedmetadata = () => {
                this.resLabel.textContent = `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`;
                this.infoLabel.textContent = `LENS[${this.currentCameraIndex}] // ONLINE`;

                this.isPowerOn = true;
                this.btnPower.classList.add('active-tool');
                this.btnPower.querySelector('.sub-text').textContent = 'ONLINE';

                if (this.rearCameras.length > 1) {
                    this.btnLensCycle.classList.remove('disabled');
                } else {
                    this.lensLabel.textContent = "1 SENSOR";
                }
                this.btnScanCode.classList.remove('disabled');
                this.btnAutoScan.classList.remove('disabled');
                this.btnCapture.classList.remove('disabled');

                // Z lekkim opóźnieniem badamy możliwości sprzętowe (Torch, Zoom)
                setTimeout(() => this.checkHardwareCapabilities(track), 500);
            };

        } catch (error) {
            this.sysLog(`BŁĄD SENSORA ID:${this.currentCameraIndex}`, 'error');
        }
    }

    checkHardwareCapabilities(track) {
        try {
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            const settings = track.getSettings ? track.getSettings() : {};

            // Moduł Latarki
            if (capabilities.torch) {
                this.hasTorchSupport = true;
                this.btnTorch.classList.remove('disabled');
            } else {
                this.hasTorchSupport = false;
                this.btnTorch.classList.add('disabled');
            }

            // Moduł Zoomu
            if (capabilities.zoom) {
                this.zoomContainer.style.display = 'flex';
                this.zoomSlider.min = capabilities.zoom.min || 1;
                this.zoomSlider.max = capabilities.zoom.max || 3;
                this.zoomSlider.step = capabilities.zoom.step || 0.1;

                const currentZoom = settings.zoom || capabilities.zoom.min || 1;
                this.zoomSlider.value = currentZoom;
                this.zoomVal.textContent = parseFloat(currentZoom).toFixed(1) + 'x';

                this.zoomSlider.oninput = async (e) => {
                    const val = e.target.value;
                    this.zoomVal.textContent = parseFloat(val).toFixed(1) + 'x';
                    try {
                        await track.applyConstraints({ advanced: [{ zoom: val }] });
                    } catch (err) { }
                };
            } else {
                this.zoomContainer.style.display = 'none';
            }
        } catch (e) {
            this.sysLog('BŁĄD ODCZYTU KONTROLERÓW SPRZĘTU', 'error');
        }
    }

    async toggleTorch() {
        if (!this.currentStream || !this.hasTorchSupport || !this.isPowerOn) return;

        const track = this.currentStream.getVideoTracks()[0];
        this.isTorchOn = !this.isTorchOn;

        try {
            await track.applyConstraints({ advanced: [{ torch: this.isTorchOn }] });
            if (this.isTorchOn) {
                this.btnTorch.classList.add('active-tool');
                this.sysLog(`TORCH: AKTYWNY`, 'sys');
            } else {
                this.btnTorch.classList.remove('active-tool');
                this.sysLog(`TORCH: WYGASZONY`, 'sys');
            }
        } catch (err) {
            this.isTorchOn = false;
            this.btnTorch.classList.remove('active-tool');
        }
    }

    captureFrame() {
        if (!this.currentStream || !this.isPowerOn) return;

        const btnText = this.btnCapture.querySelector('.btn-text');
        btnText.textContent = 'PRZETWARZANIE...';

        setTimeout(() => {
            this.canvasElement.width = this.videoElement.videoWidth;
            this.canvasElement.height = this.videoElement.videoHeight;
            const ctx = this.canvasElement.getContext('2d');
            ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);

            btnText.textContent = 'REJESTRUJ OBRAZ';
            this.sysLog('ZAPISANO ZDJĘCIE W BUFORZE RAM', 'success');
        }, 300);
    }

    async detectCode(isSilent = false) {
        if (!this.currentStream || !this.isPowerOn || this.videoElement.readyState !== this.videoElement.HAVE_ENOUGH_DATA) return;

        let btnText = null;
        if (!isSilent) {
            btnText = this.btnScanCode.querySelector('.btn-text');
            if (btnText) btnText.textContent = 'SKANOWANIE...';
            this.scanLaser.classList.add('active');
        }

        try {
            if ('BarcodeDetector' in window) {
                const barcodeDetector = new BarcodeDetector({
                    formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'data_matrix']
                });

                const barcodes = await barcodeDetector.detect(this.videoElement);

                if (barcodes.length > 0) {
                    const detectedCode = barcodes[0];
                    const format = detectedCode.format.toUpperCase();
                    const rawValue = detectedCode.rawValue;

                    // W trybie automatycznym (auto-scan) filtrujemy powtórzenia (cooldown 2.5 sekundy)
                    if (isSilent) {
                        const timeDiff = Date.now() - this.lastScannedCodeTime;
                        if (this.lastScannedCodeValue === rawValue && timeDiff < 2500) {
                            return; // Pomiń duplikat
                        }
                    }

                    // Aktualizacja stanu ostatniego skanu
                    this.lastScannedCodeValue = rawValue;
                    this.lastScannedCodeTime = Date.now();

                    // Wpisz wartość do pola tekstowego w widoku głównym
                    if (this.inputScannedVal) {
                        this.inputScannedVal.value = rawValue;
                        // Wizualna animacja obramowania pola
                        this.inputScannedVal.style.borderColor = 'var(--color-success)';
                        setTimeout(() => {
                            if (this.inputScannedVal) this.inputScannedVal.style.borderColor = '';
                        }, 800);
                    }

                    this.formatLabel.textContent = `FMT: ${format}`;
                    this.sysLog(`FORMAT: ${format}`, 'success');
                    this.sysLog(rawValue, 'highlight');

                    // Zapisz w bazie danych skanów
                    const now = new Date();
                    const timeString = now.toLocaleTimeString();
                    this.scannedCodes.unshift({
                        format: format,
                        value: rawValue,
                        time: timeString
                    });
                    localStorage.setItem('oxy_scanned_codes', JSON.stringify(this.scannedCodes));

                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                } else {
                    if (!isSilent) {
                        this.sysLog('NIE WYKRYTO ŻADNEGO KODU', 'error');
                        this.formatLabel.textContent = `FMT: BRAK DANYCH`;
                    }
                }
            } else {
                if (!isSilent) {
                    this.sysLog('BRAK WSPARCIA BarcodeDetector W PRZEGLĄDARCE', 'error');
                }
            }
        } catch (error) {
            if (!isSilent) {
                this.sysLog(`BŁĄD: ${error.message}`, 'error');
            }
        } finally {
            if (!isSilent) {
                this.scanLaser.classList.remove('active');
                if (btnText) btnText.textContent = 'SKAN RĘCZNY';
            }
        }
    }

    toggleAutoScan() {
        if (!this.isPowerOn) return;

        this.isAutoScanOn = !this.isAutoScanOn;

        if (this.isAutoScanOn) {
            this.btnAutoScan.classList.add('active-tool');
            this.autoScanText.textContent = 'AUTO: WŁ.';
            if (this.scanLaser) this.scanLaser.classList.add('active');
            this.sysLog('TRYB AUTOMATYCZNY AKTYWNY', 'sys');
            this.startAutoScanLoop();
        } else {
            this.stopAutoScan();
        }
    }

    startAutoScanLoop() {
        if (this.autoScanInterval) clearInterval(this.autoScanInterval);
        this.autoScanInterval = setInterval(() => {
            this.detectCode(true); // Wywołanie ciche (isSilent = true)
        }, 400);
    }

    stopAutoScan() {
        this.stopAutoScanSilent();
        this.sysLog('TRYB AUTOMATYCZNY DEAKTYWOWANY', 'sys');
    }

    stopAutoScanSilent() {
        this.isAutoScanOn = false;
        if (this.autoScanInterval) {
            clearInterval(this.autoScanInterval);
            this.autoScanInterval = null;
        }
        if (this.btnAutoScan) {
            this.btnAutoScan.classList.remove('active-tool');
        }
        if (this.autoScanText) {
            this.autoScanText.textContent = 'AUTO: WYŁ.';
        }
        if (this.scanLaser) {
            this.scanLaser.classList.remove('active');
        }
    }

    saveSlackWebhook() {
        if (!this.slackWebhookInput) return;
        const webhookUrl = this.slackWebhookInput.value.trim();
        localStorage.setItem('oxy_slack_webhook', webhookUrl);
        this.sysLog('ZAPISANO ADRES WEBHOOK SLACKA', 'success');
    }

    async sendArchiveToSlack() {
        if (!this.slackWebhookInput) return;
        const webhookUrl = this.slackWebhookInput.value.trim() || localStorage.getItem('oxy_slack_webhook');

        if (!webhookUrl) {
            this.sysLog('BŁĄD: BRAK WEBHOOKA SLACKA', 'error');
            alert('WPROWADŹ WEBHOOK URL W POLU TEKSTOWYM PRZED WYŚLANIEM.');
            return;
        }

        if (this.scannedCodes.length === 0) {
            this.sysLog('BŁĄD: BRAK WPISÓW W ARCHIWUM', 'error');
            return;
        }

        const sendBtnText = this.btnSendToSlack.querySelector('.btn-text');
        const originalBtnText = sendBtnText.textContent;

        sendBtnText.textContent = 'WYSYŁANIE...';
        this.btnSendToSlack.classList.add('disabled');

        const textHeader = `*Mobilny Skaner OXY — Raport Archiwum Skanów*\n*Ilość skanów:* ${this.scannedCodes.length}\n*Data raportu:* ${new Date().toLocaleString()}\n\n`;
        const textBody = this.scannedCodes.map(item => `• *[${item.format}]* (${item.time}): \`${item.value}\``).join('\n');

        const payload = {
            text: textHeader + textBody
        };

        try {
            await fetch(webhookUrl, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    // Slack webhook API allows text post requests
                },
                mode: 'no-cors' // Use no-cors to prevent preflight OPTIONS requests block in client-side context
            });

            this.sysLog('WYSŁANO RAPORT DO SLACKA', 'success');
            alert('ARCHIWUM ZOSTAŁO WYSLANE DO KANAŁU SLACK!');
        } catch (err) {
            this.sysLog(`BŁĄD RAPORTOWANIA: ${err.message}`, 'error');
        } finally {
            sendBtnText.textContent = originalBtnText;
            this.btnSendToSlack.classList.remove('disabled');
        }
    }

    openHistory() {
        this.renderHistory();
        this.historyOverlay.classList.add('open');
        this.sysLog('BAZA SKANÓW: OTWARTA', 'sys');
    }

    closeHistory() {
        this.historyOverlay.classList.remove('open');
        this.sysLog('BAZA SKANÓW: ZAMKNIĘTA', 'sys');
    }

    clearHistory() {
        if (confirm('CZY NA PEWNO CHCESZ SKASOWAĆ CAŁĄ BAZĘ DANYCH?')) {
            this.scannedCodes = [];
            localStorage.setItem('oxy_scanned_codes', JSON.stringify(this.scannedCodes));
            this.renderHistory();
            this.sysLog('BAZA DANYCH SKASOWANA', 'error');
        }
    }

    deleteHistoryItem(index) {
        this.scannedCodes.splice(index, 1);
        localStorage.setItem('oxy_scanned_codes', JSON.stringify(this.scannedCodes));
        this.renderHistory();
        this.sysLog('USUNIĘTO WPIS Z BAZY', 'sys');
    }

    copyToClipboard(text, btnElement) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = btnElement.textContent;
            btnElement.textContent = 'SKOPIOWANO!';
            btnElement.style.borderColor = 'var(--color-success)';
            btnElement.style.color = 'var(--color-success)';
            setTimeout(() => {
                btnElement.textContent = originalText;
                btnElement.style.borderColor = '';
                btnElement.style.color = '';
            }, 1000);
        }).catch(err => {
            this.sysLog('BŁĄD KOPIOWANIA', 'error');
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
        this.historyList.innerHTML = '';
        if (this.scannedCodes.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'history-empty-state';
            emptyState.textContent = 'BRAK DANYCH W BAZIE';
            this.historyList.appendChild(emptyState);
            return;
        }

        this.scannedCodes.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

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

            const copyBtn = historyItem.querySelector('.copy-btn');
            copyBtn.addEventListener('click', () => this.copyToClipboard(item.value, copyBtn));

            const deleteBtn = historyItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => this.deleteHistoryItem(index));

            this.historyList.appendChild(historyItem);
        });
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('oxy_theme', this.currentTheme);
        this.applyTheme();
        this.sysLog(`ZMIANA MOTYWU: ${this.currentTheme.toUpperCase()}`, 'sys');
    }

    applyTheme() {
        if (this.currentTheme === 'light') {
            document.documentElement.classList.add('light-theme');
            document.body.classList.add('light-theme');
            if (this.themeBtnText) this.themeBtnText.textContent = '🌙';
        } else {
            document.documentElement.classList.remove('light-theme');
            document.body.classList.remove('light-theme');
            if (this.themeBtnText) this.themeBtnText.textContent = '☀';
        }
    }

    initControls() {
        if (this.btnPower) this.btnPower.addEventListener('click', () => this.togglePower());
        if (this.btnLensCycle) this.btnLensCycle.addEventListener('click', () => this.cycleLens());
        if (this.btnTorch) this.btnTorch.addEventListener('click', () => this.toggleTorch());
        if (this.btnCapture) this.btnCapture.addEventListener('click', () => this.captureFrame());
        if (this.btnScanCode) this.btnScanCode.addEventListener('click', () => this.detectCode());
        if (this.btnAutoScan) this.btnAutoScan.addEventListener('click', () => this.toggleAutoScan());
        if (this.btnCopyInput) this.btnCopyInput.addEventListener('click', () => this.copyToClipboard(this.inputScannedVal.value, this.btnCopyInput));
        if (this.btnToggleHistory) this.btnToggleHistory.addEventListener('click', () => this.openHistory());
        if (this.btnCloseHistory) this.btnCloseHistory.addEventListener('click', () => this.closeHistory());
        if (this.btnClearHistory) this.btnClearHistory.addEventListener('click', () => this.clearHistory());
        if (this.btnToggleTheme) this.btnToggleTheme.addEventListener('click', () => this.toggleTheme());
        if (this.btnSaveWebhook) this.btnSaveWebhook.addEventListener('click', () => this.saveSlackWebhook());
        if (this.btnSendToSlack) this.btnSendToSlack.addEventListener('click', () => this.sendArchiveToSlack());
    }
}

// Start aplikacji po załadowaniu drzewa DOM
document.addEventListener('DOMContentLoaded', () => {
    window.OXY_CameraSys = new CameraCore();
});
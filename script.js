class CameraCore {
    constructor() {
        this.videoElement = document.getElementById('live-feed');
        this.canvasElement = document.getElementById('capture-canvas');
        this.logPanel = document.getElementById('event-log');
        this.infoLabel = document.getElementById('cam-info');
        this.resLabel = document.getElementById('cam-res');
        this.scanLaser = document.getElementById('scan-laser');

        this.currentStream = null;
        this.imageCapture = null;
        this.facingMode = 'environment'; // environment (tył) lub user (przód)
        this.isTorchOn = false;

        this.initControls();
        this.startCamera();
    }

    sysLog(msg, type = 'sys') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `> ${msg}`;
        this.logPanel.appendChild(entry);
        this.logPanel.scrollTop = this.logPanel.scrollHeight;
    }

    async startCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: this.facingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };

        try {
            this.sysLog(`ŻĄDANIE DOSTĘPU: ${this.facingMode.toUpperCase()}`);
            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.currentStream;

            const track = this.currentStream.getVideoTracks()[0];

            // Konfiguracja ImageCapture dla latarki, jeśli dostępne
            if ('ImageCapture' in window) {
                this.imageCapture = new ImageCapture(track);
            }

            this.videoElement.onloadedmetadata = () => {
                this.resLabel.textContent = `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`;
                this.infoLabel.textContent = `SENSOR // ONLINE // ${this.facingMode.toUpperCase()}`;
                this.sysLog('STRUMIEŃ WIDEO AKTYWNY', 'success');
                this.checkCapabilities(track);
            };

        } catch (error) {
            this.sysLog(`BŁĄD SENSORA: ${error.message}`, 'error');
            this.infoLabel.textContent = 'SENSOR // BŁĄD KRYTYCZNY';
        }
    }

    checkCapabilities(track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : null;
        const btnTorch = document.getElementById('btn-torch');

        if (capabilities && capabilities.torch) {
            btnTorch.classList.remove('disabled');
            this.sysLog('MODUŁ TORCH: DOSTĘPNY', 'sys');
        } else {
            btnTorch.classList.add('disabled');
            this.sysLog('MODUŁ TORCH: BRAK WSPARCIA DLA LENS', 'error');
        }
    }

    async toggleTorch() {
        if (!this.currentStream) return;

        const track = this.currentStream.getVideoTracks()[0];
        const hasTorch = track.getCapabilities && track.getCapabilities().torch;

        if (hasTorch) {
            this.isTorchOn = !this.isTorchOn;
            try {
                await track.applyConstraints({
                    advanced: [{ torch: this.isTorchOn }]
                });
                this.sysLog(`TORCH: ${this.isTorchOn ? 'AKTYWNY' : 'WYGASZONY'}`, 'success');
            } catch (err) {
                this.sysLog(`BŁĄD ZASILANIA TORCH`, 'error');
            }
        }
    }

    switchCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        this.isTorchOn = false;
        this.startCamera();
    }

    captureFrame() {
        if (!this.currentStream) {
            this.sysLog('BŁĄD: BRAK STRUMIENIA', 'error');
            return;
        }

        const btnCapture = document.getElementById('btn-capture');
        const btnText = btnCapture.querySelector('.btn-text');

        btnText.textContent = 'PRZETWARZANIE...';
        this.scanLaser.classList.add('active');
        this.sysLog('ANALIZA RAMKI WIDEO...', 'sys');

        // Symulacja czasu przetwarzania / odczytu
        setTimeout(() => {
            this.canvasElement.width = this.videoElement.videoWidth;
            this.canvasElement.height = this.videoElement.videoHeight;
            const ctx = this.canvasElement.getContext('2d');
            ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);

            // Można stąd wyciągnąć base64: const dataURL = this.canvasElement.toDataURL('image/jpeg');

            this.scanLaser.classList.remove('active');
            btnText.textContent = 'REJESTRUJ OBRAZ';
            this.sysLog('RAMKA ZAPISANA W BUFORZE [OK]', 'success');

            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }, 800);
    }

    initControls() {
        document.getElementById('btn-switch').addEventListener('click', () => this.switchCamera());
        document.getElementById('btn-torch').addEventListener('click', () => this.toggleTorch());
        document.getElementById('btn-capture').addEventListener('click', () => this.captureFrame());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.OXY_CameraSys = new CameraCore();
});
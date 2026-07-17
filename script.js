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

    async getCameraInfo(cameraId) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}`);
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD GET Camera Info', 'error');
        }
    }

    async setCameraSettings(cameraId, resolution, format, exposure, aperture, shutterSpeed) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resolution,
                    format,
                    exposure,
                    aperture,
                    shutterSpeed
                })
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD POST Camera Settings', 'error');
        }
    }

    async takePicture(cameraId) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/picture`);
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD GET Picture', 'error');
        }
    }

    async startRecording(cameraId) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/recording`, {
                method: 'POST'
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD POST Start Recording', 'error');
        }
    }

    async stopRecording(cameraId) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/recording`, {
                method: 'DELETE'
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD DELETE Stop Recording', 'error');
        }
    }

    async getVideoStream(cameraId) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/stream`, {
                method: 'GET'
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD GET Video Stream', 'error');
        }
    }

    async setVideoQuality(cameraId, quality) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/quality`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quality
                })
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD POST Video Quality', 'error');
        }
    }

    async getAudioSettings(cameraId) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/audio`, {
                method: 'GET'
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD GET Audio Settings', 'error');
        }
    }

    async setAudioSettings(cameraId, volume, balance) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/audio`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    volume,
                    balance
                })
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD POST Audio Settings', 'error');
        }
    }

    async getLowlightSettings(cameraId) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/lowlight`, {
                method: 'GET'
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD GET Lowlight Settings', 'error');
        }
    }

    async setLowlightSettings(cameraId, gain) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/lowlight`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gain
                })
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD POST Lowlight Settings', 'error');
        }
    }

    async getFocusSettings(cameraId) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/focus`, {
                method: 'GET'
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD GET Focus Settings', 'error');
        }
    }

    async setFocusSettings(cameraId, distance) {
        try {
            const response = await fetch(`https://api camera-system.com/v1/cameras/${cameraId}/focus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    distance
                })
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            this.sysLog('BŁĄD POST Focus Settings', 'error');
        }
    }

    initControls() {
        document.getElementById('btn-switch').addEventListener('click', () => this.switchCamera());
        document.getElementById('btn-torch').addEventListener('click', () => this.toggleTorch());
        document.getElementById('btn-capture').addEventListener('click', () => this.captureFrame());
    }

    toggleTorch() {
        // Symulacja zarządzania torchem
        setTimeout(() => {
            this.sysLog(`TORCH: AKTYWNY`, 'success');
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.OXY_CameraSys = new CameraCore();
});

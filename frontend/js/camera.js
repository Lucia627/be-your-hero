const Camera = (function() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const preview = document.getElementById('camera-preview');
  const placeholder = document.getElementById('camera-placeholder');
  const fileInput = document.getElementById('file-upload');
  const btnToggle = document.getElementById('btn-toggle-camera');
  const btnCapture = document.getElementById('btn-capture');
  const btnRetake = document.getElementById('btn-retake');
  const btnSubmit = document.getElementById('btn-submit-photo');
  const btnUpload = document.getElementById('btn-upload-file');
  const loading = document.getElementById('camera-loading');

  let stream = null;
  let currentImage = null;
  let active = false;
  let _processing = false;   // 防并发锁
  let onConfirm = null;

  // ===== 环境检测 =====
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|MicroMessenger/i.test(navigator.userAgent);
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const isSecureContext = window.isSecureContext;
  // 只有在安全上下文（HTTPS/localhost）且非移动端微信等受限环境才启用相机
  const cameraAvailable = hasGetUserMedia && isSecureContext && !/MicroMessenger|QQBrowser|Quark|UCBrowser/i.test(navigator.userAgent);

  function setOnConfirm(callback) {
    onConfirm = callback;
  }

  // ===== 启动相机（带多重 fallback 和防并发锁）=====
  async function start() {
    if (_processing) {
      console.log('[Camera] start() blocked: already processing');
      return;
    }
    _processing = true;

    try {
      // 彻底停止之前的流，并等待浏览器释放资源（移动端必须）
      if (stream) {
        stop();
        await new Promise(function(r) { setTimeout(r, 150); });
      }

      UI.showLoading('启动相机...');

      // 多重约束 fallback：environment -> user -> 不指定 -> 只要有视频
      var constraints = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: true, audio: false }
      ];

      var lastError = null;
      for (var i = 0; i < constraints.length; i++) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          break;
        } catch (err) {
          lastError = err;
          console.warn('[Camera] getUserMedia failed, trying fallback', i, err.name);
          continue;
        }
      }

      if (!stream) {
        throw lastError || new Error('无法访问相机');
      }

      video.srcObject = stream;

      // 等待视频元数据加载完成（移动端必须）
      await new Promise(function(resolve, reject) {
        var timeoutId = setTimeout(function() {
          reject(new Error('相机启动超时'));
        }, 8000);
        var onLoaded = function() {
          clearTimeout(timeoutId);
          video.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
      });

      await video.play();
      active = true;
      currentImage = null;

      video.style.display = 'block';
      preview.style.display = 'none';
      placeholder.style.display = 'none';
      btnToggle.style.display = 'none';
      btnUpload.style.display = 'none';
      btnCapture.style.display = 'inline-flex';
      btnRetake.style.display = 'none';
      btnSubmit.style.display = 'none';
      UI.hideLoading();
    } catch (err) {
      console.error('[Camera] start failed:', err.name, err.message);
      UI.hideLoading();
      UI.showToast('相机不可用，请使用文件上传', 'warning');
      resetToFileMode();
    } finally {
      _processing = false;
    }
  }

  // ===== 彻底停止相机流 =====
  function stop() {
    if (stream) {
      stream.getTracks().forEach(function(t) {
        t.stop();
        t.enabled = false;
      });
      stream = null;
    }
    try { video.pause(); } catch(e) {}
    video.srcObject = null;
    // 强制重置视频元素，防止移动端内存泄漏
    try { video.load(); } catch(e) {}
    active = false;
  }

  function capture() {
    if (!active) return;
    var ctx = canvas.getContext('2d');
    var w = video.videoWidth || 1280;
    var h = video.videoHeight || 720;
    // 限制最大分辨率，防止移动端内存溢出
    var maxSize = 1280;
    if (w > maxSize || h > maxSize) {
      var ratio = Math.min(maxSize / w, maxSize / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    currentImage = canvas.toDataURL('image/jpeg', 0.85);
    preview.src = currentImage;
    preview.style.display = 'block';
    video.style.display = 'none';
    stop();

    btnCapture.style.display = 'none';
    btnRetake.style.display = 'inline-flex';
    btnSubmit.style.display = 'inline-flex';
    UI.playSound('click');
  }

  function retake() {
    if (_processing) return;
    currentImage = null;
    preview.style.display = 'none';
    start();
  }

  function handleFile(e) {
    var f = e.target.files[0];
    if (!f) return;
    // 限制文件大小（移动端照片通常很大）
    if (f.size > 20 * 1024 * 1024) {
      UI.showToast('图片太大，请选择小于20MB的图片', 'warning');
      fileInput.value = '';
      return;
    }
    var r = new FileReader();
    r.onload = function(ev) {
      currentImage = ev.target.result;
      preview.src = currentImage;
      preview.style.display = 'block';
      video.style.display = 'none';
      placeholder.style.display = 'none';
      stop();

      btnToggle.style.display = cameraAvailable ? 'inline-flex' : 'none';
      btnToggle.textContent = '📷 重新开启相机';
      btnUpload.style.display = 'inline-flex';
      btnCapture.style.display = 'none';
      btnRetake.style.display = 'inline-flex';
      btnSubmit.style.display = 'inline-flex';
      UI.playSound('click');
    };
    r.onerror = function() {
      UI.showToast('读取图片失败', 'error');
      fileInput.value = '';
    };
    r.readAsDataURL(f);
    // 重置 input，允许再次选择同一个文件
    fileInput.value = '';
  }

  async function submit() {
    if (!currentImage) {
      UI.showToast('请先拍照或选择图片', 'warning');
      return;
    }

    loading.style.display = 'flex';
    try {
      var analysis = await API.analyzeImage(currentImage);
      if (typeof onConfirm === 'function') {
        onConfirm(analysis, currentImage);
      } else {
        UI.showToast('系统未就绪，请重试', 'error');
      }
    } catch (err) {
      UI.showToast('分析图片失败: ' + (err.message || '未知错误'), 'error');
    } finally {
      loading.style.display = 'none';
    }
  }

  function reset() {
    stop();
    currentImage = null;
    video.style.display = 'none';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    btnToggle.style.display = cameraAvailable ? 'inline-flex' : 'none';
    btnToggle.textContent = '📷 开启相机';
    btnUpload.style.display = 'inline-flex';
    btnCapture.style.display = 'none';
    btnRetake.style.display = 'none';
    btnSubmit.style.display = 'none';
    fileInput.value = '';
  }

  // 切换到文件上传模式（相机失败时自动调用）
  function resetToFileMode() {
    stop();
    currentImage = null;
    video.style.display = 'none';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    btnToggle.style.display = cameraAvailable ? 'inline-flex' : 'none';
    btnToggle.textContent = '📷 重新开启相机';
    btnUpload.style.display = 'inline-flex';
    btnCapture.style.display = 'none';
    btnRetake.style.display = 'none';
    btnSubmit.style.display = 'none';
    fileInput.value = '';
  }

  // ===== 初始化：移动端或受限环境直接禁用相机 =====
  function init() {
    if (!cameraAvailable) {
      console.log('[Camera] Camera not available:', { hasGetUserMedia: hasGetUserMedia, isSecureContext: isSecureContext, ua: navigator.userAgent.substring(0, 50) });
      btnToggle.style.display = 'none';
      btnUpload.style.display = 'inline-flex';
      // 移动端把上传按钮做得更显眼
      if (isMobile) {
        btnUpload.textContent = '📁 选择图片';
        btnUpload.classList.add('btn-primary');
      }
    }
  }

  // Event binding
  btnToggle.addEventListener('click', function() { UI.playSound('click'); start(); });
  btnCapture.addEventListener('click', function() { UI.playSound('click'); capture(); });
  btnRetake.addEventListener('click', function() { UI.playSound('click'); retake(); });
  btnSubmit.addEventListener('click', function() { UI.playSound('click'); submit(); });
  btnUpload.addEventListener('click', function() { UI.playSound('click'); fileInput.click(); });
  fileInput.addEventListener('change', handleFile);

  // 初始化
  init();

  return {
    start: start,
    stop: stop,
    capture: capture,
    retake: retake,
    submit: submit,
    reset: reset,
    setOnConfirm: setOnConfirm,
    getCurrentImage: function() { return currentImage; }
  };
})();

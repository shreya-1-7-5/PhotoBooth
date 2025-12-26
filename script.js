/* ================= DOM ================= */
let galleryImages = JSON.parse(localStorage.getItem("galleryImages")) || [];

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const snapBtn = document.getElementById('snap');
const retakeBtn = document.getElementById('retake');
const statusEl = document.getElementById('status');
const downloadBtn = document.getElementById('download');
const applyCropBtn = document.getElementById('applyCrop');
const downloadCroppedBtn = document.getElementById('downloadCropped');
const gallery = document.getElementById('gallery');

const timerSelect = document.getElementById("timerSelect");
const countdownEl = document.getElementById("countdown");
const seeAllBtn = document.getElementById("seeAllBtn");
const photoCountEl = document.getElementById("photoCount");

/* ================= STATE ================= */
let model = null;
let busy = false;
let snapped = false;
let lastImageURL = null;

/* ================= PHOTO COUNTER ================= */
function updatePhotoCount(){
  const count = galleryImages.length;
  photoCountEl.textContent = count;
}

/* ================= CAMERA ================= */
async function startCamera(){
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false
  });
  video.srcObject = stream;
  await video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

/* ================= GALLERY ================= */
function addToGallery(imageURL){
  const empty = gallery.querySelector('.gallery-empty');
  if (empty) empty.remove();

  galleryImages.unshift(imageURL);
  localStorage.setItem("galleryImages", JSON.stringify(galleryImages));

  renderGalleryPreview();
  updatePhotoCount();
}

function deleteFromGallery(index){
  galleryImages.splice(index, 1);
  localStorage.setItem("galleryImages", JSON.stringify(galleryImages));
  renderGalleryPreview();
  updatePhotoCount();
  statusEl.textContent = "🗑 Photo deleted";
}

function renderGalleryPreview(){
  gallery.innerHTML = "";

  if (galleryImages.length === 0) {
    gallery.innerHTML = `<p class="gallery-empty">No photos yet</p>`;
    return;
  }

  galleryImages.slice(0,3).forEach((url, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "gallery-item";

    const img = document.createElement("img");
    img.src = url;
    img.className = "gallery-thumb";

    img.onclick = () => {
      const image = new Image();
      image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        statusEl.textContent = "Loaded from gallery";
      };
      image.src = url;
    };

    const del = document.createElement("button");
    del.className = "gallery-delete";
    del.textContent = "×";
    del.onclick = (e) => {
      e.stopPropagation();
      deleteFromGallery(index);
    };

    wrapper.appendChild(img);
    wrapper.appendChild(del);
    gallery.appendChild(wrapper);
  });
}

/* ================= CROP TOOL ================= */
const cropBox = document.createElement('div');
cropBox.className = 'crop-box';
document.querySelector('.viewer').appendChild(cropBox);

let crop = { x: 120, y: 90, w: 200, h: 200 };
let dragging = false;
let offsetX = 0, offsetY = 0;

cropBox.addEventListener('mousedown', e => {
  dragging = true;
  offsetX = e.offsetX;
  offsetY = e.offsetY;
});

window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  crop.x = e.clientX - rect.left - offsetX;
  crop.y = e.clientY - rect.top - offsetY;
  cropBox.style.left = crop.x + 'px';
  cropBox.style.top = crop.y + 'px';
});

window.addEventListener('mouseup', () => dragging = false);

/* ================= SNAP + TIMER ================= */
async function snap(){
  if (busy) return;
  busy = true;
  snapped = true;

  const delay = parseInt(timerSelect.value);

  if (delay > 0) {
    countdownEl.style.display = "flex";
    for (let i = delay; i > 0; i--) {
      countdownEl.textContent = i;
      await new Promise(r => setTimeout(r, 1000));
      if (!snapped) {
        countdownEl.style.display = "none";
        busy = false;
        return;
      }
    }
    countdownEl.style.display = "none";
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  cropBox.style.display = 'block';
  cropBox.style.left = crop.x + 'px';
  cropBox.style.top = crop.y + 'px';
  cropBox.style.width = crop.w + 'px';
  cropBox.style.height = crop.h + 'px';

  canvas.toBlob(blob => {
    if (lastImageURL) URL.revokeObjectURL(lastImageURL);
    lastImageURL = URL.createObjectURL(blob);

    downloadBtn.href = lastImageURL;
    downloadBtn.download = `photo-${Date.now()}.png`;
    downloadBtn.hidden = false;

    addToGallery(lastImageURL);

    statusEl.textContent = "📸 Photo captured";
    busy = false;
  });
}

snapBtn.onclick = snap;

/* ================= RETAKE ================= */
retakeBtn.onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cropBox.style.display = 'none';
  downloadCroppedBtn.hidden = true;
  countdownEl.style.display = "none";
  snapped = false;
  busy = false;
  statusEl.textContent = "Show ✌️ to snap";
};

/* ================= APPLY CROP ================= */
applyCropBtn.onclick = () => {
  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = crop.w * scaleX;
  croppedCanvas.height = crop.h * scaleY;

  const cctx = croppedCanvas.getContext('2d');
  cctx.drawImage(
    canvas,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.w * scaleX,
    crop.h * scaleY,
    0, 0,
    croppedCanvas.width,
    croppedCanvas.height
  );

  croppedCanvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    downloadCroppedBtn.href = url;
    downloadCroppedBtn.download = 'cropped-photo.png';
    downloadCroppedBtn.hidden = false;
  });
};

/* ================= GESTURE LOGIC ================= */
function isPeace(landmarks){
  return (
    landmarks[8][1]  < landmarks[6][1] &&
    landmarks[12][1] < landmarks[10][1] &&
    landmarks[16][1] > landmarks[14][1] &&
    landmarks[20][1] > landmarks[18][1]
  );
}

async function detect(){
  if (!model) return requestAnimationFrame(detect);

  const predictions = await model.estimateHands(video);
  if (predictions.length > 0 && !snapped && !busy) {
    if (isPeace(predictions[0].landmarks)) snap();
  }
  requestAnimationFrame(detect);
}

/* ================= INIT ================= */
(async () => {
  statusEl.textContent = "Starting camera…";
  await startCamera();

  statusEl.textContent = "Loading hand model…";
  model = await handpose.load();

  renderGalleryPreview();
  updatePhotoCount();
  statusEl.textContent = "Show ✌️ to snap";
  detect();
})();

/* ================= VIEW GALLERY ================= */
if (seeAllBtn) {
  seeAllBtn.onclick = () => {
    window.location.href = "gallery.html";
  };
}
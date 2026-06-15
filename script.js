let model;
let maxPredictions;

const MODEL_URL = "./model/";
const CONFIDENCE_THRESHOLD = 0.65;

const recyclingTips = {
  plastic:
    "Plastic material detected. Rinse the container, remove food residue, and place it into the plastic recycling stream.",
  paper:
    "Paper material detected. Keep it dry and clean before placing it into the paper recycling stream.",
  glass:
    "Glass material detected. Rinse carefully, remove the lid, and dispose of it at a glass recycling point.",
  metal:
    "Metal material detected. Rinse the item and place it into the metal recycling stream."
};

window.addEventListener("load", init);

async function init() {
  try {
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";

    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    console.log("Model loaded successfully");
  } catch (error) {
    console.error("Model failed to load:", error);
    alert("AI model failed to load. Check your model folder path.");
  }
}

const imageUpload = document.getElementById("imageUpload");
const dropArea = document.getElementById("dropArea");

imageUpload.addEventListener("change", handleImageUpload);

document.getElementById("webcamBtn").addEventListener("click", startWebcam);
document.getElementById("stopWebcamBtn").addEventListener("click", stopWebcam);
document.getElementById("captureBtn").addEventListener("click", captureFromWebcam);
document.getElementById("resetBtn").addEventListener("click", resetApp);

["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropArea.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropArea.classList.remove("drag-over");
  });
});

dropArea.addEventListener("drop", async (event) => {
  const file = event.dataTransfer.files[0];

  if (!file || !file.type.startsWith("image/")) {
    alert("Please upload a valid image file.");
    return;
  }

  await processImageFile(file);
});

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  await processImageFile(file);
}

async function processImageFile(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    const img = new Image();

    img.onload = async function () {
      showImage(img.src);
      await classifyImage(img);
    };

    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

async function classifyImage(imgElement) {
  if (!model) {
    alert("AI model is still loading. Please try again.");
    return;
  }

  showLoading(true);

  try {
    const prediction = await model.predict(imgElement);

    let maxConfidence = 0;
    let predictedClass = "";

    const results = prediction.map((item) => {
      if (item.probability > maxConfidence) {
        maxConfidence = item.probability;
        predictedClass = item.className;
      }

      return {
        name: item.className,
        probability: item.probability * 100
      };
    });

    results.sort((a, b) => b.probability - a.probability);

    if (maxConfidence < CONFIDENCE_THRESHOLD) {
      displayUnknownResult(maxConfidence, results);
    } else {
      displayResults(predictedClass, maxConfidence, results);
    }
  } catch (error) {
    console.error("Prediction failed:", error);
    alert("Image classification failed. Please try another image.");
  }

  showLoading(false);
}

function displayResults(material, confidence, allResults) {
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("resultsContainer").classList.remove("hidden");

  document.getElementById("statusBadge").textContent = getConfidenceStatus(confidence);
  document.getElementById("materialType").textContent = material;
  document.getElementById("confidence").textContent =
    `Confidence: ${(confidence * 100).toFixed(1)}%`;

  document.getElementById("tips").textContent =
    recyclingTips[material.toLowerCase()] ||
    "Recycle responsibly according to local recycling guidelines.";

  renderConfidenceBars(allResults);
}

function displayUnknownResult(confidence, allResults) {
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("resultsContainer").classList.remove("hidden");

  document.getElementById("statusBadge").textContent = "Low Confidence";
  document.getElementById("materialType").textContent = "Uncertain";
  document.getElementById("confidence").textContent =
    `Highest Confidence: ${(confidence * 100).toFixed(1)}%`;

  document.getElementById("tips").textContent =
    "The system could not classify this material confidently. Please upload a clearer image with one object in focus.";

  renderConfidenceBars(allResults);
}

function renderConfidenceBars(results) {
  const html = results
    .map(
      (result) => `
      <div class="result-bar">
        <div class="result-label">
          <span>${result.name}</span>
          <span>${result.probability.toFixed(1)}%</span>
        </div>
        <div class="result-bar-container">
          <div class="result-bar-fill" style="width: ${result.probability}%"></div>
        </div>
      </div>
    `
    )
    .join("");

  document.getElementById("allResults").innerHTML = html;
}

function getConfidenceStatus(confidence) {
  if (confidence >= 0.85) return "High Confidence";
  if (confidence >= 0.65) return "Moderate Confidence";
  return "Low Confidence";
}

function showImage(src) {
  document.getElementById("previewContainer").classList.remove("hidden");
  document.getElementById("previewImage").src = src;
}

function showLoading(isLoading) {
  document.getElementById("loadingSpinner").classList.toggle("hidden", !isLoading);
}

async function startWebcam() {
    try {
      document.getElementById("webcamContainer").classList.remove("hidden");
      document.getElementById("inputSection").classList.add("hidden");
  
      const video = document.getElementById("webcamVideo");
  
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
      const cameraConfig = isMobile
        ? {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          }
        : {
            video: true,
            audio: false
          };
  
      const stream = await navigator.mediaDevices.getUserMedia(cameraConfig);
      video.srcObject = stream;
    } catch (error) {
      alert("Camera access failed. Please allow camera permission.");
      console.error(error);
    }
  }

function stopWebcam() {
  const video = document.getElementById("webcamVideo");

  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }

  document.getElementById("webcamContainer").classList.add("hidden");
  document.getElementById("inputSection").classList.remove("hidden");
}

async function captureFromWebcam() {
  const video = document.getElementById("webcamVideo");

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const imageData = canvas.toDataURL("image/jpeg");

  const img = new Image();

  img.onload = async function () {
    showImage(imageData);
    await classifyImage(img);
  };

  img.src = imageData;
}

function resetApp() {
  document.getElementById("imageUpload").value = "";
  document.getElementById("previewContainer").classList.add("hidden");
  document.getElementById("resultsContainer").classList.add("hidden");
  document.getElementById("emptyState").classList.remove("hidden");
  document.getElementById("tips").textContent =
    "Recommendation will be generated after classification.";
}
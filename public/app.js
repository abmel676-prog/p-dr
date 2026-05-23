const filesDiv = document.getElementById("files");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const statusDiv = document.getElementById("status");





document.getElementById("logoutBtn").addEventListener("click", async () => {
  document.body.innerHTML = "";

  await fetch("/logout", {
    method: "GET",
    credentials: "include"
  });

  window.location.replace("/ap");
});
async function loadFiles() {
  const res = await fetch("/api/files");

  if (!res.ok) {
    location.href = "/ap";
    return;
  }

  const files = await res.json();

  filesDiv.innerHTML = "";

  if (!files.length) {
    filesDiv.innerHTML = "<p>No files uploaded</p>";
    return;
  }

  files.forEach((file) => {
    const div = document.createElement("div");
    div.className = "file-item";

    div.innerHTML = `
      <div>
        <div>${file.name}</div>
        <small>${formatSize(file.size)}</small>
      </div>

      <div class="file-actions">
        <a
          class="action-btn download"
          href="/download/${encodeURIComponent(file.name)}"
        >
          Download
        </a>

        <button
          class="action-btn delete"
          onclick="deleteFile('${file.name}')"
        >
          Delete
        </button>
      </div>
    `;

    filesDiv.appendChild(div);
  });
}

async function deleteFile(name) {
  const ok = confirm("Delete file?");

  if (!ok) return;

  await fetch(`/delete/${encodeURIComponent(name)}`, {
    method: "DELETE"
  });

  loadFiles();
}

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    alert("Select file");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  statusDiv.innerText = "Uploading...";

  const res = await fetch("/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (data.success) {
    statusDiv.innerText = "Upload successful";
    fileInput.value = "";
    loadFiles();
  } else {
    statusDiv.innerText = "Upload failed";
  }
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

loadFiles();
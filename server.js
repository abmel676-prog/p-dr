const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8000;
let receiveMode = false;
let sharedFiles = [];
// ========================
// CREATE UPLOAD FOLDER
// ========================
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ========================
// PASSWORD HASH
// ========================
const HASHED_PASSWORD = bcrypt.hashSync(process.env.APP_PASSWORD, 10);

// ========================
// MIDDLEWARE
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ========================
// MULTER
// ========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.path === "/zz") {
      cb(null, receivedDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  },
});

const upload = multer({ storage });

// ========================
// AUTH MIDDLEWARE
// ========================
function isAuth(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }

  return res.redirect("/ap");
}

// ========================
// HIDDEN ROOT
// ========================
app.get("/", (req, res) => {
  return res.status(404).send("Not Found");
});

// ========================
// LOGIN PAGE
// ========================
app.get("/ap", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ========================
// LOGIN API
// ========================
app.post("/login", async (req, res) => {
  try {
    const { password } = req.body;

    const match = await bcrypt.compare(password, HASHED_PASSWORD);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Wrong password",
      });
    }

    req.session.authenticated = true;

    return res.json({
      success: true,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.get("/toggle-receive", isAuth, (req, res) => {
  receiveMode = !receiveMode;

  return res.json({
    receiveMode,
  });
});

app.get("/receive-status", (req, res) => {
  return res.json({
    receiveMode,
  });
});

const receivedDir = path.join(__dirname, "uploads", "received");

if (!fs.existsSync(receivedDir)) {
  fs.mkdirSync(receivedDir, { recursive: true });
}

app.post("/zz", upload.single("file"), (req, res) => {
  if (!receiveMode) {
    fs.unlinkSync(path.join(receivedDir, req.file.filename));

    return res.json({
      success: false,
      message: "WAIT: Receiver OFF",
    });
  }

  return res.json({
    success: true,
  });
});

app.get("/api/received", isAuth, (req, res) => {
  const files = fs.readdirSync(receivedDir);

  const data = files.map((file) => {
    const filePath = path.join(receivedDir, file);
    const stats = fs.statSync(filePath);

    return {
      name: file,
      size: stats.size,
      created: stats.birthtimeMs,
    };
  });

  data.sort((a, b) => b.created - a.created);

  res.json(data);
});

app.post("/share-file", isAuth, (req, res) => {
  const { name } = req.body;

  if (!sharedFiles.includes(name)) {
    sharedFiles.push(name);
  }

  res.json({
    success: true,
  });
});

app.get("/api/shared-files", (req, res) => {
  const data = sharedFiles
    .map((file) => {
      const filePath = path.join(uploadDir, file);

      if (!fs.existsSync(filePath)) return null;

      const stats = fs.statSync(filePath);

      return {
        name: file,
        size: stats.size,
      };
    })
    .filter(Boolean);

  res.json(data);
});

app.get("/public-download/:name", (req, res) => {
  const fileName = req.params.name;

  if (!sharedFiles.includes(fileName)) {
    return res.status(403).send("Not shared");
  }

  const filePath = path.join(uploadDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File missing");
  }

  res.download(filePath);
});

app.post("/unshare-file", isAuth, (req, res) => {
  const { name } = req.body;

  sharedFiles = sharedFiles.filter((f) => f !== name);

  res.json({
    success: true,
  });
});

// ========================
// DASHBOARD
// ========================
app.get("/hm.html", isAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "hm.html"));
});

// ========================
// STATIC FILES (SAFE)
// ========================
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
  })
);

// ========================
// GET FILES
// ========================
app.get("/api/files", isAuth, (req, res) => {
  const files = fs.readdirSync(uploadDir);

  const data = files
    .filter((f) => f !== "received")
    .map((file) => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);

      return {
        name: file,
        size: stats.size,
        created: stats.birthtimeMs,
      };
    });

  data.sort((a, b) => b.created - a.created);

  res.json(data);
});

// ========================
// UPLOAD
// ========================
app.post("/upload", isAuth, upload.single("file"), (req, res) => {
  return res.json({
    success: true,
    file: req.file.filename,
  });
});

// ========================
// DOWNLOAD
// ========================
app.get("/download/:type/:name", isAuth, (req, res) => {
  const dir = req.params.type === "received" ? receivedDir : uploadDir;

  const filePath = path.join(dir, req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Not found");
  }

  res.download(filePath);
});

// ========================
// DELETE
// ========================
app.delete("/delete/:name", isAuth, (req, res) => {
  const filePath = path.join(uploadDir, req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
    });
  }

  fs.unlinkSync(filePath);

  return res.json({
    success: true,
  });
});

// ========================
// LOGOUT
// ========================
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");

    res.setHeader("Cache-Control", "no-store");

    return res.json({
      success: true,
    });
  });
});
// ========================
// START
// ========================
app.listen(PORT, () => {
  console.log(`Running on http://127.0.0.1:${PORT}`);
});

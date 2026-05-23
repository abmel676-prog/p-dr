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
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

// app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ========================
// MULTER
// ========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  }
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
        message: "Wrong password"
      });
    }

    req.session.authenticated = true;

    return res.json({
      success: true
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
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
    index: false
  })
);

// ========================
// GET FILES
// ========================
app.get("/api/files", isAuth, async (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);

    const detailed = files.map((file) => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);

      return {
        name: file,
        size: stats.size,
        created: stats.birthtimeMs
      };
    });

    detailed.sort((a, b) => b.created - a.created);

    return res.json(detailed);
  } catch (err) {
    return res.status(500).json({ message: "Failed" });
  }
});

// ========================
// UPLOAD
// ========================
app.post(
  "/upload",
  isAuth,
  upload.single("file"),
  (req, res) => {
    return res.json({
      success: true,
      file: req.file.filename
    });
  }
);

// ========================
// DOWNLOAD
// ========================
app.get("/download/:name", isAuth, (req, res) => {
  const filePath = path.join(uploadDir, req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
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
      success: false
    });
  }

  fs.unlinkSync(filePath);

  return res.json({
    success: true
  });
});

// ========================
// LOGOUT
// ========================
// app.get("/logout", (req, res) => {
//   req.session.destroy(() => {
//     res.redirect("/ap");
//   });
// });
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");

    res.setHeader("Cache-Control", "no-store");

    return res.json({
      success: true
    });
  });
});
// ========================
// START
// ========================
app.listen(PORT, () => {
  console.log(`Running on http://127.0.0.1:${PORT}`);
});

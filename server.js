require("dotenv").config();

const express = require("express");
const app = express();

const fs = require("fs");
const path = require("path");

const multer = require("multer");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, "uploads");

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Faqat rasm yuklash mumkin"));
        }
        cb(null, true);
    }
});

const productsFile = path.join(__dirname, "products.json");

function getProducts() {
    return JSON.parse(fs.readFileSync(productsFile, "utf8"));
}

function saveProducts(products) {
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
}

app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
    if (req.path === "/admin.html") {
        return res.sendStatus(404);
    }
    next();
});

app.post("/order", async (req, res) => {
  try {
    const { name, phone, address, message } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Maydonlarni to'ldiring"
      });
    }

    const text =
      `🆕 YANGI BUYURTMA!\n\n` +
      `👤 Ism: ${name}\n` +
      `📞 Telefon: ${phone}\n` +
      `📍 Manzil: ${address}\n` +
      `💬 Izoh: ${message || "Yo'q"}`;

    const response = await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.CHAT_ID,
          text: text
        })
      }
    );

    const result = await response.json();

    if (!result.ok) {
      console.log("TELEGRAM JAVOBI:",result);
      throw new Error(result.description);
    }

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

function adminAuth(req, res, next) {
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Basic ")) {
        res.set("WWW-Authenticate", 'Basic realm="Admin"');
        return res.status(401).send("Admin parolini kiriting");
    }

    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    const password = decoded.slice(decoded.indexOf(":") + 1);

    if (password !== process.env.ADMIN_PASSWORD) {
        res.set("WWW-Authenticate", 'Basic realm="Admin"');
        return res.status(401).send("Parol noto'g'ri");
    }

    next();
}

app.get("/admin/products", adminAuth, (req, res) => {
    res.json(getProducts());
});

app.post("/admin/products", adminAuth, (req, res) => {
    const { name, price, image } = req.body;

    if (!name || !price || !image) {
        return res.status(400).json({
            success: false,
            message: "Barcha maydonlarni to'ldiring"
        });
    }

    const products = getProducts();

    const newProduct = {
        id: Date.now(),
        name,
        price: Number(price),
        image
    };

    products.push(newProduct);
    saveProducts(products);

    res.json({
        success: true,
        message: "Mahsulot saqlandi!"
    });
});

// Mahsulot narxini o'zgartirish
app.put("/admin/products/:id", adminAuth, (req, res) => {
    const products = getProducts();
    const id = Number(req.params.id);
    const product = products.find(p => p.id === id);

    if (!product) {
        return res.status(404).json({ success: false });
    }

    const price = Number(req.body.price);

    if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success: false });
    }

    product.price = price;
    saveProducts(products);

    res.json({ success: true, message: "Narx yangilandi!" });
});

// Mahsulotni o'chirish
app.delete("/admin/products/:id", adminAuth, (req, res) => {
    const products = getProducts();
    const id = Number(req.params.id);
    const filtered = products.filter(p => p.id !== id);

    if (filtered.length === products.length) {
        return res.status(404).json({ success: false });
    }

    saveProducts(filtered);

    res.json({ success: true, message: "Mahsulot o'chirildi!" });
});

app.post("/admin/upload", adminAuth, upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Rasm tanlanmadi"
        });
    }

    res.json({
        success: true,
        image: "/uploads/" + req.file.filename
    });
});

app.get("/admin", adminAuth, (req, res) => {
    res.sendFile(__dirname + "/admin.html");
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "internetdokon.html"));
});

app.get("/internetdokon.html", (req, res) => {
    res.sendFile(path.join(__dirname, "internetdokon.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
        console.log("Sayt ishlayapti: http://localhost:" + PORT);
});
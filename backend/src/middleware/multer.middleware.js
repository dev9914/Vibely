import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDirectory = path.resolve(__dirname, "../../public/temp");

fs.mkdirSync(tempDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, tempDirectory)
    },
    filename: function (req, file, cb) {
      const extension = path.extname(file.originalname);
      const basename = path.basename(file.originalname, extension)
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .slice(0, 80);

      cb(null, `${basename || "upload"}-${Date.now()}${extension}`)
    }
  })
  
export const upload = multer({ 
    storage, 
})
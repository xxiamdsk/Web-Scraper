import express from "express";
import bodyParser from "body-parser";
import scrape from "website-scraper";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public")); // Serve static files

// Create __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve HTML form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Handle form submission
app.post("/download", (req, res) => {
  const websiteUrl = req.body.url;
  const urlObj = new URL(websiteUrl);
  const domainName = urlObj.hostname.replace("www.", ""); // E.g., "example.com"
  const directoryName = `./${domainName}`; // Directory named after the website

  // Define options for scraping
  const options = {
    urls: [websiteUrl], // URL of the website to scrape
    directory: directoryName, // Automatically named directory
    recursive: false, // Disable recursive downloading to limit to the main page only
    maxDepth: 1, // Set the maximum depth to 5 to limit it to the base URL
    filenameGenerator: "bySiteStructure",
    urlFilter: (url) => {
      return url === websiteUrl || !url.startsWith(`${websiteUrl}/`);
    },
    sources: [
      { selector: "img", attr: "src" }, // Images
      { selector: 'link[rel="stylesheet"]', attr: "href" }, // Stylesheets
      { selector: "script", attr: "src" }, // JavaScript files
      { selector: "a", attr: "href" }, // HTML links for internal pages
    ],
    onResourceSaved: (resource) => {
      console.log(`Downloaded: ${resource.filename}`);
    },
    onResourceError: (resource, err) => {
      console.log(`Error downloading ${resource.url}: ${err}`);
    },
  };

  // Start scraping
  scrape(options)
    .then(() => {
      console.log("Main folder of the website successfully downloaded!");

      // Add watermark to all HTML, CSS, and JS files
      const watermark = `<!-- Watermarked by Deepak Singh -->\n`;

      const addWatermark = (filePath) => {
        const fileContent = fs.readFileSync(filePath, "utf8");
        if (
          filePath.endsWith(".html")
          // || filePath.endsWith(".css") ||
          // filePath.endsWith(".js")
        ) {
          const updatedContent = watermark + fileContent;
          fs.writeFileSync(filePath, updatedContent, "utf8");
        }
      };

      const traverseDirectory = (directory) => {
        fs.readdirSync(directory).forEach((file) => {
          const fullPath = path.join(directory, file);
          if (fs.lstatSync(fullPath).isDirectory()) {
            traverseDirectory(fullPath);
          } else {
            addWatermark(fullPath);
          }
        });
      };

      traverseDirectory(directoryName);

      // Step 1: Zip the folder
      const zipFilePath = path.join(__dirname, `${domainName}.zip`);
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        console.log(`${archive.pointer()} total bytes`);
        console.log("Website successfully zipped!");

        // Step 2: Send a download button to the user
        res.send(`
          <h2>Website Successfully Downloaded!</h2>
          <a href="/download-zip?filename=${domainName}.zip" download>
            <button>Download ZIP</button>
          </a>
        `);
      });

      archive.on("error", (err) => {
        throw err;
      });

      archive.pipe(output);

      // Add the directory to the archive
      archive.directory(directoryName, false);

      // Finalize the archive
      archive.finalize();
    })
    .catch((err) => {
      console.log("An error occurred:", err);
      res.send("An error occurred while downloading the website.");
    });
});

// Step 3: Serve the ZIP file
app.get("/download-zip", (req, res) => {
  const zipFilePath = path.join(__dirname, req.query.filename);
  res.download(zipFilePath, (err) => {
    if (err) {
      console.log("Error while downloading the ZIP file:", err);
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

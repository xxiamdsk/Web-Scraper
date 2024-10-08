import express from "express";
import bodyParser from "body-parser";
import scrape from "website-scraper";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files

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
  const directoryName = `./SiteSnap`; // Directory named after the website

  // Define options for scraping
  const options = {
    urls: [websiteUrl], // URL of the website to scrape
    directory: directoryName, // Automatically named directory
    recursive: false, // Disable recursive downloading to limit to the main page only
    maxDepth: 5, // Set the maximum depth to 1 to limit it to the base URL
    filenameGenerator: "bySiteStructure",
    urlFilter: (url) => {
      // Only download resources from the base domain, excluding subdirectories
      return url === websiteUrl || url.startsWith(`${websiteUrl}/`) === false;
    },
    // Only download important resource types like HTML, CSS, JS, and images
    sources: [
      { selector: "img", attr: "src" }, // Images
      { selector: 'link[rel="stylesheet"]', attr: "href" }, // Stylesheets
      { selector: "script", attr: "src" }, // JavaScript files
      { selector: "a", attr: "href" }, // HTML links for internal pages
    ],
    // Function to show progress
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

      // Function to add watermark to files
      const addWatermark = (filePath) => {
        const fileContent = fs.readFileSync(filePath, "utf8");
        if (
          filePath.endsWith(".html") ||
          filePath.endsWith(".css") ||
          filePath.endsWith(".js")
        ) {
          const updatedContent = watermark + fileContent;
          fs.writeFileSync(filePath, updatedContent, "utf8");
        }
      };

      // Traverse the directory and add watermark to all files
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

      console.log("Watermark added to all relevant files!");
      res.send("Website successfully downloaded and watermarked!");
    })
    .catch((err) => {
      console.log("An error occurred:", err);
      res.send("An error occurred while downloading the website.");
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

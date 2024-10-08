import express from "express";
import bodyParser from "body-parser";
import scrape from "website-scraper";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

const app = express();
const port = 3000;

let zipFilePath = ""; // Track the ZIP file path globally

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
  const directoryName = "./SiteSnap"; // Directory named after the website

  // Define options for scraping
  const options = {
    urls: [websiteUrl], // URL of the website to scrape
    directory: directoryName, // Automatically named directory
    recursive: true, // Enable recursive downloading
    maxDepth: 35, // Set a higher max depth to include more pages
    filenameGenerator: "bySiteStructure",

    // Performance optimizations:
    requestConcurrency: 20, // Increase the number of concurrent requests
    maxRecursiveDepth: 15, // Limit how deep it will scrape
    maxParallelRequests: 20, // Number of requests sent in parallel

    urlFilter: function (url) {
      // Filter to allow only the domain name and its subdirectories
      const domain = new URL(websiteUrl).hostname;
      return url.includes(domain);
    },

    onResourceSaved: (resource) => {
      console.log(`Downloaded: ${resource.filename}`);
    },
    onResourceError: (resource, err) => {
      console.log(`Error downloading ${resource.url}: ${err}`);
    },
  };

  // Start scraping with a timeout
  let timeoutId;
  const timeoutDuration = 5 * 60 * 1000; // 5 minutes in milliseconds

  scrape(options)
    .then(() => {
      console.log("Website successfully downloaded!");
      clearTimeout(timeoutId); // Clear the timeout if scraping completes in time
      finalizeDownload(res);
    })
    .catch((err) => {
      console.log("An error occurred:", err);
      clearTimeout(timeoutId); // Clear the timeout on error
      res.send("An error occurred while downloading the website.");
    });

  // Set the timeout to stop scraping after 5 minutes
  timeoutId = setTimeout(() => {
    console.log("Timeout reached! Stopping the scraping process.");
    // Since website-scraper does not have a built-in stop function, we will finalize the download process here
    finalizeDownload(res);
  }, timeoutDuration);

  const finalizeDownload = (res) => {
    // Add watermark to HTML files
    const watermark = `<!-- Watermarked by Deepak Singh  ( www.github.com/xxiamdsk )  -->\n`;

    const addWatermark = (filePath) => {
      const fileContent = fs.readFileSync(filePath, "utf8");
      if (filePath.endsWith(".html")) {
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
    zipFilePath = path.join(__dirname, `SiteSnap.com.zip`);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`${archive.pointer()} total bytes`);
      console.log("Website successfully zipped!");
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    // Add the directory to the archive
    archive.directory(directoryName, false); // Use false to not include the parent folder

    // Finalize the archive
    archive.finalize();
  };
});

// Step 3: Check if ZIP file is ready
app.get("/check-zip", (req, res) => {
  if (zipFilePath && fs.existsSync(zipFilePath)) {
    res.json({ ready: true, filename: path.basename(zipFilePath) });
  } else {
    res.json({ ready: false });
  }
});

// Step 4: Serve the ZIP file
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

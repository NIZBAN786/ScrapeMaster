// server.js
import express from 'express';
import cors from 'cors';
import scrape from 'website-scraper';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';
import fs from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static files from the scraped directories
app.use('/downloads', express.static('downloads'));

app.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const timestamp = Date.now();
        const directoryName = `scraped-website-${timestamp}`;
        const directory = path.join(__dirname, 'downloads', directoryName);

        const options = {
            urls: [url],
            directory: directory,
        };

        await scrape(options);

        res.json({
            message: 'Website successfully scraped',
            directory: directory,
            downloadId: directoryName
        });
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/download/:downloadId', (req, res) => {
    const { downloadId } = req.params;
    const directory = path.join(__dirname, 'downloads', downloadId);
    
    // Check if directory exists
    if (!fs.existsSync(directory)) {
        return res.status(404).json({ error: 'Scraped content not found' });
    }

    // Create a zip file name
    const zipFileName = `${downloadId}.zip`;
    const zipFilePath = path.join(__dirname, 'downloads', zipFileName);

    // Create a write stream for the zip file
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
    });

    // Listen for all archive data to be written
    output.on('close', () => {
        // Send the zip file to client
        res.download(zipFilePath, zipFileName, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up - delete the zip file after sending
            fs.unlink(zipFilePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Error deleting zip file:', unlinkErr);
                }
            });
        });
    });

    archive.on('error', (err) => {
        res.status(500).json({ error: err.message });
    });

    // Pipe archive data to the output file
    archive.pipe(output);

    // Add the directory contents to the archive
    archive.directory(directory, false);

    // Finalize the archive
    archive.finalize();
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
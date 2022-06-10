process.setMaxListeners(50);

const express = require("express");

const port = process.env.PORT || 80;
const API_KEY = process.env.API_KEY || '';

function authenticated(apiKey) {
    return apiKey == API_KEY;
}

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function correlationId(req) {
    const correlationId = req.header("correlation-id");
    if (!correlationId) return uuidv4();
    return correlationId;
}

// BEGIN - PDF converter

const puppeteer = require("puppeteer");
const Mutex = require("async-mutex").Mutex;

const HIGHER_PERFORMANCE_MORE_RAM = false;``
const MAX_TABS = 15; // MORE BROWSER TABS, MORE RAM
const locks = [];
for (i = 0; i < MAX_TABS; i++) {
    locks[i] = new Mutex(); // creates a shared mutex instance
}

var app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb' }));

let browser;
const launchBrowser = async () => {
    if (browser) return;

    // we are using headless mode
    browser = await puppeteer.launch({
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    });
};
let pages = [];
const createPage = async (pageToUse, reuse) => {
    if (pages[pageToUse] && reuse) {
        // console.log(`Returning opened page: ${pageToUse}`);
        return pages[pageToUse];
    }

    // console.log(`Creating new page: ${pageToUse}`);
    const page = await browser.newPage();
    await page.addStyleTag({
        content: "@media print {body {-webkit-print-color-adjust: exact;}}",
    }); // apply available background styles while printing
    pages[pageToUse] = page;
    return page;
};

async function generatePdf(
    html,
    format,
    orientation,
    pageToUse,
    width,
    height
) {
    await launchBrowser();
    const page = await createPage(pageToUse, HIGHER_PERFORMANCE_MORE_RAM);
    let config = pdfConfigs(format, width, height, orientation);
    console.log(JSON.stringify(config));
    let buffer;

    if (HIGHER_PERFORMANCE_MORE_RAM) {
        const release = await locks[pageToUse].acquire(); // acquires access to the critical path

        try {
            await page.setContent(html); // set the page content
            await page.evaluateHandle("document.fonts.ready"); // await until custom fonts are loaded

            buffer = await page.pdf(config);
        } finally {
            release();
        }
    } else {
        await page.setContent(html); // set the page content
        await page.evaluateHandle("document.fonts.ready"); // await until custom fonts are loaded
        buffer = await page.pdf(config);
        await page.close();
    }

    return buffer;
}

function pdfConfigs(format, width, height, orientation) {
    const _format = format == undefined ? "" : format.toString().toLowerCase();
    const _width = isNaN(width) ? 1000 : Number(width);
    const _height = isNaN(height) ? 1000 : Number(height);

    const supportedFormats = [
        "Custom",
        "Letter",
        "Legal",
        "Tabloid",
        "Ledger",
        "A0",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "A6",
    ];
    const index = supportedFormats.findIndex((i) => i.toLowerCase() == _format);
    if (index === 0) {
        // custom page
        return {
            printBackground: true,
            width: _width,
            height: _height,
            landscape: landscape(orientation),
        };
    }
    return {
        printBackground: true,
        format: index === -1 ? supportedFormats[1] : supportedFormats[index],
        landscape: landscape(orientation),
    };
}

function landscape(orientation) {
    orientation = orientation == undefined ? "" : orientation;
    return orientation.toString().toUpperCase() === "LANDSCAPE";
}

let NEXT_TAB_TO_USE = 0;
function pickTabToProcess() {
    NEXT_TAB_TO_USE = NEXT_TAB_TO_USE += 1;
    if (NEXT_TAB_TO_USE == MAX_TABS) NEXT_TAB_TO_USE = 0;

    return NEXT_TAB_TO_USE;
}

app.post("/api/generate/pdf", async function (req, res) {
    if (!authenticated(req.query.API_KEY)) {
        res.status(401);
        res.end("API key is required");
        return;
    }

    const id = correlationId(req);
    console.log(`${id} : ${new Date().toLocaleString()} - Generating pdf...`);

    await generatePdf(
        req.body.Html,
        req.body.Format,
        req.body.Orientation,
        pickTabToProcess(),
        req.body.Width,
        req.body.Height
    )
        .then(async (buffer) => {
            console.log(`${id} : ${new Date().toLocaleString()} - PDF Generated`);
            res.status(200);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                "attachment; filename=some_file.pdf"
            );
            res.setHeader("Content-Length", buffer.length);
            res.end(buffer);
        })
        .catch((err) => {
            console.error(`${id} : ${err}`);
            res.end("There was an error while generating pdf from html");
        });
});

// END - PDF converter

// BEGIN - Image Converter

const multer = require("multer");
const sharp = require("sharp");

const supportedImageType = (imageExt) => {
    if (!imageExt) return null;
    const convertType = imageExt.toString().split(".")[0].toLowerCase();
    return ["jpeg", "png", "webp", "avif", "tiff", "gif", "svg"].find(
        (type) => type === convertType
    );
};
const changeFileExtension = (filename, ext) => {
    let pos = filename.lastIndexOf(".");
    return filename.substr(0, pos < 0 ? filename.length : pos) + `.${ext}`;
};

app.post("/api/image/converter", multer().single("image"), function (req, res) {
    if (!authenticated(req.query.API_KEY)) {
        res.status(401);
        res.end("API key is required");
        return;
    }

    const id = correlationId(req);
    console.log(`${id} : ${new Date().toLocaleString()} - Converting image...`);

    if (!req.body.convertType) {
        res.status(400);
        res.end("Convert type is not provided");
        return;
    }
    if (!req.file) {
        res.status(400);
        res.end("Image content is not provided");
        return;
    }

    const targetFormat = supportedImageType(req.body.convertType);
    if (!targetFormat) {
        res.status(400);
        res.end(`Target image type is not supported: ${req.body.convertType}`);
        return;
    }

    const sharpStream = sharp(req.file.buffer);
    sharpStream.metadata().then((metadata) => {
        console.log(
            req.file.originalname + ": " + metadata.format + " -> " + targetFormat
        );
        const originalFormat = supportedImageType(metadata.format);
        if (!originalFormat) {
            res.status(400);
            res.end(`Source image type is not supported: ${metadata.format}`);
        }

        const newContentType = `image/${targetFormat}`;

        sharpStream
            .toFormat(targetFormat, { quality: 100 })
            .withMetadata({ ContentType: newContentType })
            .toBuffer()
            .then((buffer) => {
                const newFileName = changeFileExtension(
                    req.file.originalname,
                    targetFormat
                );
                res.set({
                    "Content-Type": newContentType,
                    "Content-Length": buffer.length,
                    "Content-Disposition": `attachment; filename=${newFileName}`,
                });
                res.send(buffer);
            })
            .catch((err) => {
                console.log(err);
                res.status(500);
                res.end("Unable to convert the image");
            });
    });
});

// END - Image Converter

var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Report service listening at http://%s:%s", host, port);
});

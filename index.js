process.setMaxListeners(1000);

const puppeteer = require("puppeteer");
const express = require("express");
const Mutex = require("async-mutex").Mutex;

const HIGHER_PERFORMANCE_MORE_RAM = false;
const MAX_TABS = 15; // MORE BROWSER TABS, MORE RAM
const locks = [];
for (i = 0; i < MAX_TABS; i++) {
  locks[i] = new Mutex(); // creates a shared mutex instance
}

var app = express();
app.use(express.json());

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

async function generatePdf(html, format, orientation, pageToUse) {
  await launchBrowser();
  const page = await createPage(pageToUse, HIGHER_PERFORMANCE_MORE_RAM);

  if (HIGHER_PERFORMANCE_MORE_RAM) {
    const release = await locks[pageToUse].acquire(); // acquires access to the critical path
    let buffer;
    try {
      await page.setContent(html); // set the page content
      await page.evaluateHandle("document.fonts.ready"); // await until custom fonts are loaded
      buffer = await page.pdf({
        format: pageFormat(format),
        landscape: landscape(orientation),
      });
    } finally {
      release();
    }
  } else {
    await page.setContent(html); // set the page content
    await page.evaluateHandle("document.fonts.ready"); // await until custom fonts are loaded
    buffer = await page.pdf({
      format: pageFormat(format),
      landscape: landscape(orientation),
    });
    await page.close();
  }

  return buffer;
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

function pageFormat(format) {
  format = format == undefined ? "" : format;
  const supportedFormats = [
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
  const index = supportedFormats.findIndex((i) => i == format);
  return index === -1 ? supportedFormats[0] : format;
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
  const id = correlationId(req);
  console.log(`${id} : ${new Date().toLocaleString()} - Generating pdf...`);

  await generatePdf(
    req.body.Html,
    req.body.Format,
    req.body.Orientation,
    pickTabToProcess()
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

const port = process.env.PORT || 80;

var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("Report service listening at http://%s:%s", host, port);
});

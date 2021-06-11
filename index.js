const puppeteer = require("puppeteer");
const express = require("express");

var app = express();
app.use(express.json());

async function generatePdf(res, correlationId, format, orientation) {
  const html = res;

  // we are using headless mode
  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  const page = await browser.newPage();

  // We set the page content as the generated html by handlebars
  await page.setContent(html);
  await page.addStyleTag({
    content: "@media print {body {-webkit-print-color-adjust: exact;}}",
  }); // apply available background styles while printing
  await page.evaluateHandle("document.fonts.ready"); // await until custom fonts are loaded

  const buffer = await page.pdf({
    format: pageFormat(format),
    landscape: landscape(orientation),
  });

  await browser.close();

  console.log(
    `${correlationId} : ${new Date().toLocaleString()} - PDF Generated`
  );
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

app.post("/api/generate/pdf", async function (req, res) {
  var html = req.body.Html;
  const id = correlationId(req);
  console.log(`${id} : ${new Date().toLocaleString()} - Generating pdf...`);

  await generatePdf(html, id, req.body.Format, req.body.Orientation)
    .then(async (buffer) => {
      res.status(200);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=some_file.pdf"
      );
      res.setHeader("Content-Length", buffer.length);
      //res.end(pdfData);
      res.end(buffer);
    })
    .catch((err) => {
      console.error(err);
      res.end("There was an error while generating pdf from html");
    });
});

const port = process.env.PORT || 80;

var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("Report service listening at http://%s:%s", host, port);
});

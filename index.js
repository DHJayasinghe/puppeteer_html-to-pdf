const puppeteer = require("puppeteer");
const express = require("express");

var app = express();
app.use(express.json());

async function generatePdf(res, correlationId) {
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

  const buffer = await page.pdf({ format: "A4" });

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

app.post("/api/generate/pdf", async function (req, res) {
  var html = req.body.Html;
  const id = correlationId(req);
  console.log(`${id} : ${new Date().toLocaleString()} - Generating pdf...`);

  await generatePdf(html, id)
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

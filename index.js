const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.json());

async function generatePdf(res) {
    const html = res;

    // we are using headless mode 
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage()

    // We set the page content as the generated html by handlebars
    await page.setContent(html);
    await page.addStyleTag({ content: '@media print {body {-webkit-print-color-adjust: exact;}}' }); // apply available background styles while printing

    const buffer = await page.pdf({ format: 'A4' });

    await browser.close();
    console.log("PDF Generated")
    return buffer;
}

app.post('/api/generate/pdf', async function (req, res) {
    var html = req.body.Html;

    await generatePdf(html)
        .then(async (buffer) => {
            res.status(200);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=some_file.pdf');
            res.setHeader('Content-Length', buffer.length);
            //res.end(pdfData);
            res.end(buffer);
        }).catch(err => {
            console.error(err)
            res.end("There was an error while generating pdf from html");
        });
});

const port = process.env.PORT || 80;

var server = app.listen(port, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Report service listening at http://%s:%s", host, port)
})
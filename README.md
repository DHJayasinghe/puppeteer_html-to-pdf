# [Html-To-Pdf converter](https://github.com/DHJayasinghe/puppeteer_html-to-pdf)
A simple Node Express.js API to convert Html document to Pdf using Puppeteer.

## How to Build & Run - Docker
1. Build image named html-to-pdf-converter - `docker build . -t html-to-pdf-converter`
2. Run image on port 80 - `docker run -itd --name html-to-pdf-converter -p 80:80 html-to-pdf-converter`

## How to Build & Run - Normal
1. Build project - `npm install`
2. Run project (default port is 80) - `node index.js`

## Pull and Run from DockerHub

1. Run image on port 80 - `docker run -itd --name html-to-pdf-converter -p 80:80 hasitha2kandy/html-to-pdf-converter`

### Run & Try - `POST http://localhost:80/api/generate/pdf`
1. Using curl
```Curl
curl --location --request POST 'http://localhost:80/api/generate/pdf' \
--header 'Content-Type: application/json' \
--data-raw '{
    "Html": "<h1>Your pdf html string comes here</h1>"
}'
```
2. Using Http
```Http
POST /api/generate/pdf HTTP/1.1
Host: localhost:80
Content-Type: application/json
Content-Length: 40

{
    "Html": "<h1>Your pdf html string comes here</h1>",
    "Format": "A4",
    "Orientation":"Portrait"
}
```

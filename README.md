# Mock SMTP/SMS server
The implementation supports a mock SMTP server and a mock SMS using HTTP API.

The mock smtp server listens on an SMTP port and provides the ability to receive emails. Instead of sending the emails to the necessary email id,  it would send the email to the websocket so you could see the email on the browser. 

The mock provides the ability to test applications that use SMTP to deliver emails. 

__Note:__ As of now we have not handled other features of SMTP/SMS. Only a happy flow is implemented.

The Mock has the following API for testing SMS. 
```

  /sendsms: 
    get: 
      summary: ""
      description: ""
      parameters: 
        - 
          name: "mobiles"
          type: "string"
          in: "query"
          description: "To whom we should send the SMS"
          required: true
        - 
          name: "sender"
          type: "string"
          in: "query"
          description: "From whom should we send the SMS"
          required: true
        - 
          name: "message"
          type: "string"
          in: "query"
          description: "Actual message"
          required: true

```
In order for the mock to be efficient all additional parameters and headers are ignored. 

## Build and Run. 

Clone the repo and run the following command to build and run.

```
npm install
npm start
```

## Introduction

Type this URL http://locahost:8080/ in your browser to access the emails.

* The emails/SMS are broadcasted to all currently open websockets. So you could miss the email/SMS if you are not connected.  

* The current connection status is shown on top of this page.

* RELOAD button will reload the entire page. You will loose all the information currently on the screen.

* An empty message apears as the first message (Yep i know its nasty but no time to fix this). Newer messages will apear on top of the page. 

### Source code

_**index.html**_ - A simple html page with CDN based react running on the browser. Not the most efficient but is the simplest way to work.

_**app.js**_ - The server that handles the SMTP, http & websocket.

### Logs

The app prints the emails in JSON format and also updates on the number of connected clients. Please avoid using sensitive data.

## Build Docker

```
docker build . -t mosipdev/mock-smtp:v1 --network host
```

## Run docker

```
docker run -p 8025:8025 -p 8080:8080 -p 8081:8081 mosipdev/mock-smtp:v1
```

## Configuration

Following environment variables are supported on the server

```
SMTP_SERVER_PORT = 8025
SERVER_PORT = 8080
WS_SERVER_PORT = 8081
SERVER_HOST = localhost //set 0.0.0.0 when running in docker
```

In case you use a proxy and the websocket ports are not the default ones then use following environment variables to inform the client.

```
WS_EX_PROTOCOL = "ws" //set this to wss if running over https
WS_EX_SERVER_PORT = 8081 // if the proxy server exposes the socker over https then set this to 443 and map the context path to the basepath
WS_EX_BASE_PATH = "" //set your base path
```

## Test

Use the below command to send a test email
```
sendEmail -f sasi@yazhi.io -t test@localhost.com -s localhost:8025 -u "Test send the mail" -m "Sending the email for test"
```

Use the below api to test the SMS
```
curl 'http://localhost:8080/sendsms?mobiles=9123456789&sender=xyz&message=this%20is%20your%20sms' \
  -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'DNT: 1' \
  -H 'Pragma: no-cache' \
  -H 'Sec-Fetch-Dest: document' \
  -H 'Sec-Fetch-Mode: navigate' \
  -H 'Sec-Fetch-Site: none' \
  -H 'Sec-Fetch-User: ?1' \
  -H 'Upgrade-Insecure-Requests: 1' \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36' \
  --compressed
```
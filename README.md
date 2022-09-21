# Mock SMTP server

The mock smtp server listens on a SMTP port and provides an ability to receive emails. Intead of sending the emails to the ncessary email id it would send the email to the websocket so you could see the email on the browser. 

The mock provides as with the ability to test applications that use SMTP to deliver emails. 

__Note:__ As of now we have not handled other features of SMTP. Only a happy flow is implemented.



## Build and Run. 

Clone the repo and run the following command to build and run.

```
npm install
npm start
```

## Introduction

Type this URL http://locahost:8080/ in your browser to access the emails.

* The emails are broadcasted to all currently open websockets. So you could miss the email if you are not connected.  

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
SERVER_HOST = localhost
```

In case you use a proxy and the websocket ports are not the default ones then use following environment variables to inform the client.

```
WS_EX_PROTOCOL = "ws" //set this to wss if running over https
WS_EX_SERVER_PORT = 8081 // if https set this to 443 and map it to the basepath
WS_EX_BASE_PATH = "" //set your base path
```
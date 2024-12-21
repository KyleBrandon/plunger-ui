import express, { NextFunction, Request, Response } from 'express';

import path from 'path';
import createError from 'http-errors';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import indexRouter from './routes/index';
import apiRouter from './routes/api';
import yargs from 'yargs';
import WebSocket, { Server as WebSocketServer } from 'ws';
import http from 'http';

interface Args {
    port: number;
    plungeServerIP: string;
    plungeServerPort: number;
}

const app = express();

const argv = yargs.options({
    port: {
        type: 'number',
        alias: 'p',
        default: 3000,
        description: 'Port to run the Plunger UI web server on',
    },
    plungeServerIP: {
        type: 'string',
        alias: 'ip',
        demandOption: true,
        description: 'IP address for the Plunge server',
    },
    plungeServerPort: {
        type: 'number',
        alias: 'pp',
        demandOption: true,
        description: 'Port number for the Plunge server',
    },
}).argv as Args;

const { port, plungeServerIP, plungeServerPort } = argv;

app.locals.plungeServerIP = `http://${plungeServerIP}:${plungeServerPort}`;
const server = http.createServer(app);
const wsServer = new WebSocketServer({ server });

let remoteWebSocket: WebSocket | null = null;
const remoteWSUrl = `ws://${plungeServerIP}:${plungeServerPort}/v1/status/ws`;

function connectToPlungeServer() {
    remoteWebSocket = new WebSocket(remoteWSUrl);

    remoteWebSocket.on('open', () => {
        console.log(`Connected to remote WebSocket server at ${remoteWSUrl}`);
    });

    remoteWebSocket.on('message', (message: WebSocket.Data) => {
        let parsedMessage = JSON.parse(message.toString('utf-8'));

        wsServer.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(parsedMessage));
            }
        });
    });

    remoteWebSocket.on('close', () => {
        console.log(
            'Disconnected from remote WebSocket server, attempting to reconnect...',
        );
        setTimeout(connectToPlungeServer, 5000);
    });

    remoteWebSocket.on('error', (error) => {
        console.error('Error with remote WebSocket connection:', error.message);
    });
}

connectToPlungeServer();

wsServer.on('connection', (clientSocket) => {
    console.log('Client connected to WebSocket server');
    clientSocket.on('message', (message: WebSocket.Data) => {
        if (remoteWebSocket && remoteWebSocket.readyState == WebSocket.OPEN) {
            remoteWebSocket.send(message);
        }
    });

    clientSocket.on('close', () => {
        console.log('Client disconnected from WebSocket server');
    });
});

// view engine setup
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, './views'));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/', indexRouter);
app.use('/api', apiRouter);

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
    next(createError(404));
});

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

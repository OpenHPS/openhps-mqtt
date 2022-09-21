import { Aedes } from 'aedes';
import * as aedes from 'aedes';
import { createServer, Server } from 'net';
import { createServer as createSecureServer } from 'tls';
import { MQTTServerOptions } from './MQTTServerOptions';
import { MQTTClient } from '../../client/service/MQTTClient';
import { MQTTClientOptions } from '../../client/service/MQTTClientOptions';
import { WebSocket } from 'ws';
import { Server as HTTPSServer, createServer as createServerHTTPS } from 'https';
import { Server as HTTPServer, createServer as createServerHTTP } from 'http';

/**
 * MQTT Server
 */
export class MQTTServer extends MQTTClient {
    protected options: MQTTServerOptions & MQTTClientOptions;
    server: Server | HTTPSServer | HTTPServer;
    aedes: Aedes;

    constructor(options?: MQTTServerOptions) {
        super({
            url: '',
            ...(options || {
                port: 1883,
            }),
        });
        if (this.options.websocket) {
            this.options = {
                keepalive: 30,
                protocolId: 'MQTT',
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 1000,
                connectTimeout: 30 * 1000,
                ...this.options,
            };
        }

        this.options.url =
            (this.options.websocket ? `ws${this.options.tls ? 's' : ''}://` : `mqtt://`) + `localhost:${options.port}`;

        this.removeAllListeners('build');
        this.once('build', this._onInitServer.bind(this));
        this.once('destroy', this._onDestroy.bind(this));
    }

    private _onInitServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            const brokerId = `BROKER_${process.pid}_${Math.random().toString(16).substring(2, 8)}`;
            this.aedes = (aedes as any)({
                id: brokerId,
                ...this.options,
            });
            this.aedes.on('subscribe', (subscriptions, client) => {
                this.model.logger(
                    'info',
                    'MQTT client \x1b[32m' +
                        (client ? client.id : client) +
                        '\x1b[0m subscribed to topics: ' +
                        subscriptions.map((s) => s.topic).join('\n') +
                        ' from broker ' +
                        brokerId,
                );
            });
            this.aedes.on('client', (client) => {
                this.model.logger(
                    'info',
                    'Client Connected: \x1b[33m' + (client ? client.id : client) + '\x1b[0m' + ' to broker ' + brokerId,
                );
            });

            if (this.options.websocket) {
                // Create websocket server
                if (this.options.tls) {
                    this.server = createServerHTTPS({
                        key: this.options.key,
                        cert: this.options.cert,
                    });
                } else {
                    this.server = createServerHTTP();
                }
                const wss = new WebSocket.Server({ server: this.server as HTTPServer | HTTPServer });
                wss.on('connection', (ws) => {
                    const duplex = WebSocket.createWebSocketStream(ws);
                    this.aedes.handle(duplex);
                });
            } else {
                // Create socket server
                if (this.options.tls) {
                    this.server = createSecureServer(
                        {
                            key: this.options.key,
                            cert: this.options.cert,
                        },
                        this.aedes.handle,
                    );
                } else {
                    this.server = createServer(this.aedes.handle);
                }
            }

            this.model.logger('debug', `Starting server on port ${this.options.port}: ${brokerId} ...`);
            this.server.on('error', (error: Error) => {
                this.model.logger('error', error.message);
            });
            this.server.on('listening', () => {
                this.model.logger('info', `Server listening on port ${this.options.port}: ${brokerId}`);
                this.connect()
                    .then(() => {
                        resolve();
                    })
                    .catch(reject);
            });
            this.server.listen(this.options.port);
        });
    }

    private _onDestroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.model.logger('info', `Closing MQTT server ...`);
            this.aedes.close(() => {
                this.server.close((err?) => {
                    if (err) {
                        this.model.logger('error', `Unable to close socket server!`);
                        return reject(err);
                    }
                    this.model.logger('info', `MQTT server closed successfully!`);
                    resolve();
                });
            });
        });
    }
}

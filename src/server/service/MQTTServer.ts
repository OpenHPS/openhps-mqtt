import { Aedes } from 'aedes';
import * as aedes from 'aedes';
import { createServer, Server } from 'net';
import { createServer as createSecureServer } from 'tls';
import { MQTTServerOptions } from './MQTTServerOptions';
import { MQTTClient } from '../../client/service/MQTTClient';
import { MQTTClientOptions } from '../../client/service/MQTTClientOptions';
import { WebSocket } from 'ws';
import { Server as HTTPSServer, createServer as createServerHTTPS } from "https";
import { Server as HTTPServer, createServer as createServerHTTP } from "http";

/**
 * MQTT Server
 */
export class MQTTServer extends MQTTClient {
    protected options: MQTTServerOptions & MQTTClientOptions;
    protected server: Server | HTTPServer | HTTPServer;
    protected aedes: Aedes;

    constructor(options?: MQTTServerOptions) {
        super();
        this.options = {
            url: '',
            ...(options || {
                port: 1883,
            }),
        };

        if (this.options.websocket) {
            this.options = {
                keepalive: 30,
                protocolId: 'MQTT',
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 1000,
                connectTimeout: 30 * 1000,
                ...this.options
            }
        }
        
        this.options.url =
            (this.options.websocket ? `ws${this.options.tls ? 's' : ''}://` : `mqtt://`) + `localhost:${options.port}`;

        this.removeAllListeners('build');
        this.once('build', this._onInitServer.bind(this));
        this.once('destroy', this._onDestroy.bind(this));
    }

    private _onInitServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            const brokerId = 'BROKER_' + process.pid;
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

            // Create websocket server
            if (this.options.websocket) {
                if (this.options.tls) {
                    this.server = createServerHTTPS(
                        {
                            key: this.options.key,
                            cert: this.options.cert,
                        }
                    );
                } else {
                    this.server = createServerHTTP();
                }
                const wss = new WebSocket.Server({ server: this.server as HTTPServer | HTTPServer })
                wss.on('connection', (ws) => {
                    const duplex = WebSocket.createWebSocketStream(ws);
                    this.aedes.handle(duplex);
                });
            } else {
                if (this.options.tls) {
                    this.server = createSecureServer(
                        {
                            key: this.options.key,
                            cert: this.options.cert,
                        },
                        this.options.websocket ? undefined : this.aedes.handle,
                    );
                } else {
                    this.server = createServer(this.options.websocket ? undefined : this.aedes.handle);
                }
            }
            
            this.server.listen(this.options.port, () => {
                this.model.logger('info', `Server listening on port ${this.options.port}: ${brokerId}`);
                this.connect()
                    .then(() => {
                        resolve();
                    })
                    .catch(reject);
            });
        });
    }

    private _onDestroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.aedes.close(() => {
                this.server.close((err?) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
        });
    }
}

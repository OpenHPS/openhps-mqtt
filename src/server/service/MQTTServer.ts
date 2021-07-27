import { DataFrame, DataSerializer, PullOptions, PushOptions } from '@openhps/core';
import { Aedes } from 'aedes';
import * as aedes from 'aedes';
import { createServer, Server } from 'net';
import { createServer as createSecureServer } from 'tls';
import { MQTTServerOptions } from './MQTTServerOptions';
import { MQTTClient } from '../../client/service/MQTTClient';
import { MQTTClientOptions } from '../../client/service/MQTTClientOptions';
import { createServer as createWebsocketServer } from 'websocket-stream';

/**
 * MQTT Server
 */
export class MQTTServer extends MQTTClient {
    protected options: MQTTServerOptions & MQTTClientOptions;
    protected server: Server;
    protected aedes: Aedes;

    constructor(options?: MQTTServerOptions) {
        super();
        this.options = {
            url: '',
            ...(options || {
                port: 1883,
            }),
        };
        this.options.url = `mqtt://localhost:${options.port}`;

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
            // Create websocket server
            if (this.options.websocket) {
                (createWebsocketServer as any)(
                    {
                        server: this.server,
                    },
                    this.aedes.handle,
                );
            }
            this.server.listen(this.options.port, () => {
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

    /**
     * Send a push to a specific remote node
     *
     * @param {string} uid Remote Node UID
     * @param {DataFrame} frame Data frame to push
     * @param {PushOptions} [options] Push options
     */
    public remotePush<T extends DataFrame | DataFrame[]>(uid: string, frame: T, options?: PushOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            this.aedes.publish(
                {
                    topic: `${uid}/push`,
                    payload: JSON.stringify({
                        frame: DataSerializer.serialize(frame),
                        options,
                    }),
                    qos: this.options.qos,
                    cmd: 'publish',
                    dup: false,
                    retain: true,
                },
                (error?: Error) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve();
                },
            );
        });
    }

    /**
     * Send a pull request to a specific remote node
     *
     * @param {string} uid Remote Node UID
     * @param {PullOptions} [options] Pull options
     */
    public remotePull(uid: string, options?: PullOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            this.aedes.publish(
                {
                    topic: `${uid}/pull`,
                    payload: JSON.stringify({
                        options,
                    }),
                    qos: this.options.qos,
                    cmd: 'publish',
                    dup: false,
                    retain: true,
                },
                (error?: Error) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve();
                },
            );
        });
    }

    /**
     * Send an error to a remote node
     *
     * @param {string} uid Remote Node UID
     * @param {string} event Event name
     * @param {any} arg Args
     */
    public remoteEvent(uid: string, event: string, arg: any): Promise<void> {
        return new Promise((resolve, reject) => {
            this.aedes.publish(
                {
                    topic: `${uid}/events/${event}`,
                    payload: JSON.stringify(arg),
                    qos: this.options.qos,
                    cmd: 'publish',
                    dup: false,
                    retain: true,
                },
                (error?: Error) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve();
                },
            );
        });
    }
}

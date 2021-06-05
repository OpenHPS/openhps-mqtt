import { DataFrame, DataSerializer, Node, PullOptions, PushOptions } from '@openhps/core';
import { Aedes, AedesPublishPacket } from 'aedes';
import * as aedes from 'aedes'
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
        this.options.url = `localhost:${options.port}`;

        this.on('build', this._onInitServer.bind(this));
        this.on('destroy', this._onDestroy.bind(this));
    }

    private _onInitServer(): Promise<void> {
        return new Promise((resolve) => {
            this.aedes = (aedes as any)(this.options);
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
                (createWebsocketServer as any)({
                    server: this.server
                }, this.aedes.handle);
            }
            this.server.listen(this.options.port, () => {
                resolve();
            });
        });
    }

    private _onDestroy(): Promise<void> {
        return new Promise((resolve) => {
            this.aedes.close(() => {
                resolve();
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
    public push<T extends DataFrame | DataFrame[]>(uid: string, frame: T, options?: PushOptions): Promise<void> {
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
    public pull(uid: string, options?: PullOptions): Promise<void> {
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
    public sendEvent(uid: string, event: string, arg: any): Promise<void> {
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

    /**
     * Register a node as a remotely available node
     *
     * @param {Node<any, any>} node Node to register
     * @returns {boolean} Registration success
     */
    public registerNode(node: Node<any, any>): boolean {
        // Subscribe to all endpoints for the node
        this.aedes.subscribe(
            `${node.uid}/push`,
            (packet: AedesPublishPacket, callback: () => void) => {
                const payload = JSON.parse(packet.payload as string);
                this.onLocalPush(node.uid, payload.frame, payload.options);
                callback();
            },
            () => undefined,
        );
        this.aedes.subscribe(
            `${node.uid}/pull`,
            (packet: AedesPublishPacket, callback: () => void) => {
                const payload = JSON.parse(packet.payload as string);
                this.onLocalPull(node.uid, payload.options);
                callback();
            },
            () => undefined,
        );
        this.aedes.subscribe(
            `${node.uid}/events/completed`,
            (packet: AedesPublishPacket, callback: () => void) => {
                const payload = JSON.parse(packet.payload as string);
                this.onLocalEvent(node.uid, 'completed', payload);
                callback();
            },
            () => undefined,
        );
        this.aedes.subscribe(
            `${node.uid}/events/error`,
            (packet: AedesPublishPacket, callback: () => void) => {
                const payload = JSON.parse(packet.payload as string);
                this.onLocalEvent(node.uid, 'error', payload);
                callback();
            },
            () => undefined,
        );
        this.logger('debug', {
            message: `Registered remote server node ${node.uid}`,
        });
        return super.registerNode(node);
    }
}

import { DataFrame, DataSerializer, Node, PullOptions, PushOptions, RemoteService, Service } from '@openhps/core';
import { Client, connect } from 'mqtt';
import { MQTTNodeOptions } from '../nodes/MQTTNodeOptions';
import { MQTTPullOptions } from '../nodes/MQTTPullOptions';
import { MQTTPushOptions } from '../nodes/MQTTPushOptions';
import { MQTTClientOptions } from './MQTTClientOptions';

export class MQTTClient extends RemoteService {
    protected client: Client;
    protected options: MQTTClientOptions;
    protected topics: Topic[] = [];

    constructor(options?: MQTTClientOptions) {
        super();
        this.options = {
            qos: 0,
            clientId: `CLIENT_${process.pid}_${Math.random().toString(16).substring(2, 8)}`,
            ...options,
        };
        this.options.prefix = this.options.prefix ?? '';

        this.once('build', this.connect.bind(this));
        this.once('destroy', this.disconnect.bind(this));
    }

    protected connect(): Promise<void> {
        return new Promise((resolve) => {
            this.client = connect(this.options.url, this.options);
            this.client.on('error', (error) => {
                this.model.logger('error', `Connection error: ${error.message}`, error);
                this.client?.end();
            });
            this.client.on('reconnect', () => {
                this.model.logger('warn', `Reconnecting to MQTT server ...`);
            });
            this.client.on('message', this._onMessage.bind(this));
            this.client.on('connect', () => {
                resolve();
            });
        });
    }

    protected disconnect(): Promise<void> {
        return new Promise((resolve) => {
            this.client.end();
            resolve();
        });
    }

    /**
     * Send a push to a specific remote node
     *
     * @param {string} uid Remote Node UID
     * @param {DataFrame} frame Data frame to push
     * @param {PushOptions} [options] Push options
     * @returns {Promise<void>} Promise of completed push
     */
    remotePush<T extends DataFrame | DataFrame[]>(uid: string, frame: T, options?: PushOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client.connected || this.client.disconnecting) {
                return resolve(undefined);
            }

            const node = this.model.findNodeByUID(uid) as Node<any, any>;
            const nodeOptions = node.getOptions() as MQTTNodeOptions;

            if (nodeOptions.topic.push.includes('+')) {
                return reject(
                    new Error(`Unable to push '${nodeOptions.topic.push}'! Wildcards are not supported for pushing!`),
                );
            }

            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                nodeOptions.topic.push,
                JSON.stringify({
                    clientId: this.client.options.clientId,
                    messageId,
                    frame: DataSerializer.serialize(frame),
                    options,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
        });
    }

    /**
     * Send a pull request to a specific remote node
     *
     * @param {string} uid Remote Node UID
     * @param {PullOptions} [options] Pull options
     * @returns {Promise<void>} Promise of completed pull
     */
    remotePull(uid: string, options?: PullOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client.connected || this.client.disconnecting) {
                return resolve(undefined);
            }

            const node = this.model.findNodeByUID(uid) as Node<any, any>;
            const nodeOptions = node.getOptions() as MQTTNodeOptions;

            if (nodeOptions.topic.pull.includes('+')) {
                return reject(
                    new Error(`Unable to pull '${nodeOptions.topic.pull}'! Wildcards are not supported for pulling!`),
                );
            }

            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                nodeOptions.topic.pull,
                JSON.stringify({
                    clientId: this.client.options.clientId,
                    messageId,
                    options,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
        });
    }

    /**
     * Send an error to a remote node
     *
     * @param {string} uid Remote Node UID
     * @param {string} event Event name
     * @param {any[]} [args] Args
     * @returns {Promise<void>} Promise of emitted event
     */
    remoteEvent(uid: string, event: string, ...args: any[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client.connected || this.client.disconnecting) {
                return resolve(undefined);
            }

            const node = this.model.findNodeByUID(uid) as Node<any, any>;
            const options = node.getOptions() as MQTTNodeOptions;

            if (options.topic.event.includes('+')) {
                // Ignore
                return;
            }

            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                `${options.topic.event}/${event}`,
                JSON.stringify({
                    clientId: this.client.options.clientId,
                    messageId,
                    args,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
        });
    }

    /**
     * Send a remote service call
     *
     * @param {string} uid Service uid
     * @param {string} method Method to call
     * @param {any[]} [args] Optional set of arguments
     * @returns {Promise<any>} Service call output promise
     */
    remoteServiceCall(uid: string, method: string, ...args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client.connected || this.client.disconnecting) {
                return resolve(undefined);
            }

            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                `${this.options.prefix}service/${uid}/${method}`,
                JSON.stringify({
                    clientId: this.client.options.clientId,
                    messageId,
                    args,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
        });
    }

    private _onPushAction(clientId: string, uid: string, topic: string, data: any): void {
        Promise.resolve(
            this.localPush(uid, data.frame, {
                topic,
                clientId,
                ...data.options,
            } as MQTTPushOptions),
        )
            .then(() => {
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        clientId: this.client.options.clientId,
                        messageId: data.messageId,
                        status: 'ok',
                    }),
                );
            })
            .catch((ex) => {
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        clientId: this.client.options.clientId,
                        messageId: data.messageId,
                        status: 'error',
                        error: ex,
                    }),
                );
            });
    }

    private _onPullAction(clientId: string, uid: string, topic: string, data: any): void {
        Promise.resolve(
            this.localPull(uid, {
                topic,
                clientId,
                ...data.options,
            } as MQTTPullOptions),
        )
            .then(() => {
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        clientId: this.client.options.clientId,
                        messageId: data.messageId,
                        status: 'ok',
                    }),
                );
            })
            .catch((ex) => {
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        clientId: this.client.options.clientId,
                        messageId: data.messageId,
                        status: 'error',
                        error: ex,
                    }),
                );
            });
    }

    private _onEventAction(uid: string, topic: string, event: string, data: any): void {
        Promise.resolve(this.localEvent(uid, event, data))
            .then((result: any) => {
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        clientId: this.client.options.clientId,
                        messageId: data.messageId,
                        status: 'ok',
                        result,
                    }),
                );
            })
            .catch((ex) => {
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        clientId: this.client.options.clientId,
                        messageId: data.messageId,
                        status: 'error',
                        error: ex,
                    }),
                );
            });
    }

    private _onServiceAction(uid: string, topic: string, action: string, ...data: any): void {
        Promise.resolve(this.localServiceCall(uid, action, ...data))
            .then((result: any) => {
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        clientId: this.client.options.clientId,
                        messageId: data.messageId,
                        status: 'ok',
                        result,
                    }),
                );
            })
            .catch((ex) => {
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        clientId: this.client.options.clientId,
                        messageId: data.messageId,
                        status: 'error',
                        error: ex,
                    }),
                );
            });
    }

    private _onMessage(topic: string, payload: Buffer): void {
        const topicMapping = this.topics.filter((t) => {
            return new RegExp(t.topic.replace('+', '.*')).test(topic);
        })[0];

        if (!topicMapping) {
            return; // Unsupported topic
        }

        const topicParts = topic.replace(this.options.prefix, '').split('/');
        const response = topicParts[topicParts.length - 1] === 'response';

        const data: any = JSON.parse(payload.toString());

        // Check if message send by self
        if (data.clientId === this.client.options.clientId) {
            return;
        }

        if (response) {
            const promise = this.getPromise(data.messageId);
            if (!promise) {
                return;
            } else if (data.status === 'ok') {
                promise.resolve(data.result);
            } else if (data.status === 'error') {
                promise.reject(data.error);
            }
            return;
        }

        switch (topicMapping.action) {
            case 'push':
                this._onPushAction(data.clientId, topicMapping.uid, topic, data);
                break;
            case 'pull':
                this._onPullAction(data.clientId, topicMapping.uid, topic, data);
                break;
            case 'event':
                this._onEventAction(topicMapping.uid, topic, topicParts[topicParts.length - 1], data);
                break;
            case 'service':
                this._onServiceAction(topicMapping.uid, topic, topicParts[topicParts.length - 1], ...data);
                break;
            default:
                // Unsupported message
                break;
        }
    }

    /**
     * Register a remote client node
     *
     * @param {Node<any, any>} node Node to register
     * @returns {Promise<void>} Registration promise
     */
    public registerNode(node: Node<any, any>): Promise<void> {
        return new Promise((resolve, reject) => {
            const options = node.getOptions() as MQTTNodeOptions;
            if (!options.topic) {
                // Subscribe to all endpoints for the node
                options.topic = {
                    push: `${this.options.prefix}node/${node.uid}/push`,
                    pull: `${this.options.prefix}node/${node.uid}/pull`,
                    event: `${this.options.prefix}node/${node.uid}/event`,
                };
            }

            const topics: Topic[] = [
                { topic: `${options.topic.push}`, action: 'push', uid: node.uid },
                { topic: `${options.topic.pull}`, action: 'pull', uid: node.uid },
                { topic: `${options.topic.event}/+`, action: 'event', uid: node.uid },
            ];

            this.topics.push(...topics);

            this.client.subscribe(
                topics
                    .map((topic) => {
                        return [topic.topic, `${topic.topic}/response`];
                    })
                    .reduce((a, b) => a.concat(b)),
                (err: Error) => {
                    if (err) {
                        return reject(err);
                    }
                    super.registerNode(node).then(resolve).catch(reject);
                },
            );
        });
    }

    /**
     * Register a remote client service
     *
     * @param {Service} service Service to register
     * @returns {Promise<void>} Registration promise
     */
    public registerService(service: Service): Promise<void> {
        return new Promise((resolve, reject) => {
            // Subscribe to all actions for the service
            const topics: Topic[] = [
                { topic: `${this.options.prefix}service/${service.uid}/*`, action: 'service', uid: service.uid },
            ];

            this.topics.push(...topics);

            this.client.subscribe(
                topics
                    .map((topic) => {
                        return [topic.topic, `${topic.topic}/response`];
                    })
                    .reduce((a, b) => a.concat(b)),
                (err: Error) => {
                    if (err) {
                        return reject(err);
                    }
                    super.registerService(service).then(resolve).catch(reject);
                },
            );
        });
    }
}

interface Topic {
    topic: string;
    action: 'push' | 'pull' | 'event' | 'service';
    uid: string;
}

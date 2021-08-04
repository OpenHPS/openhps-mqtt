import { DataFrame, DataSerializer, Node, PullOptions, PushOptions, RemoteService, Service } from '@openhps/core';
import { Client, connect } from 'mqtt';
import { MQTTClientOptions } from './MQTTClientOptions';

export class MQTTClient extends RemoteService {
    protected client: Client;
    protected options: MQTTClientOptions;

    constructor(options?: MQTTClientOptions) {
        super();
        this.options = options;

        this.once('build', this.connect.bind(this));
        this.once('destroy', this.disconnect.bind(this));
    }

    protected connect(): Promise<void> {
        return new Promise((resolve) => {
            this.client = connect(this.options.url, {});
            this.client.on('message', this._onMessage.bind(this));
            resolve();
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
     */
    public remotePush<T extends DataFrame | DataFrame[]>(uid: string, frame: T, options?: PushOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                `node/${uid}/push`,
                JSON.stringify({
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
     */
    public remotePull(uid: string, options?: PullOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                `node/${uid}/pull`,
                JSON.stringify({
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
     */
    public remoteEvent(uid: string, event: string, ...args: any[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                `node/${uid}/events/${event}`,
                JSON.stringify({
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
     */
    public remoteServiceCall(uid: string, method: string, ...args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                `service/${uid}/${method}`,
                JSON.stringify({
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

    private _onMessage(topic: string, payload: Buffer): void {
        const topicParts = topic.split('/');
        const type = topicParts[0];
        const uid = topicParts[1];
        const action = topicParts[2];
        const response = topicParts[topicParts.length - 1] === 'response';

        const data: any = JSON.parse(payload.toString());

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

        switch (type) {
            case 'node':
                switch (action) {
                    case 'push':
                        Promise.resolve(this.localPush(uid, data.frame, data.options))
                            .then(() => {
                                this.client.publish(
                                    topic + '/response',
                                    JSON.stringify({
                                        messageId: data.messageId,
                                        status: 'ok',
                                    }),
                                );
                            })
                            .catch((ex) => {
                                this.client.publish(
                                    topic + '/response',
                                    JSON.stringify({
                                        messageId: data.messageId,
                                        status: 'error',
                                        error: ex,
                                    }),
                                );
                            });
                        break;
                    case 'pull':
                        Promise.resolve(this.localPull(uid, data.options))
                            .then(() => {
                                this.client.publish(
                                    topic + '/response',
                                    JSON.stringify({
                                        messageId: data.messageId,
                                        status: 'ok',
                                    }),
                                );
                            })
                            .catch((ex) => {
                                this.client.publish(
                                    topic + '/response',
                                    JSON.stringify({
                                        messageId: data.messageId,
                                        status: 'error',
                                        error: ex,
                                    }),
                                );
                            });
                        break;
                    case 'events':
                        Promise.resolve(this.localEvent(uid, topicParts[3], data))
                            .then((result: any) => {
                                this.client.publish(
                                    topic + '/response',
                                    JSON.stringify({
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
                                        messageId: data.messageId,
                                        status: 'error',
                                        error: ex,
                                    }),
                                );
                            });
                        break;
                }
                break;
            case 'service':
                break;
        }
    }

    /**
     * Register a remote client node
     *
     * @param {Node<any, any>} node Node to register
     * @returns {boolean} Registration success
     */
    public registerNode(node: Node<any, any>): this {
        // Subscribe to all endpoints for the node
        this.client.subscribe(`node/${node.uid}/push`);
        this.client.subscribe(`node/${node.uid}/pull`);
        this.client.subscribe(`node/${node.uid}/events/completed`);
        this.client.subscribe(`node/${node.uid}/events/error`);
        this.client.subscribe(`node/${node.uid}/push/response`);
        this.client.subscribe(`node/${node.uid}/pull/response`);
        this.client.subscribe(`node/${node.uid}/events/completed/response`);
        this.client.subscribe(`node/${node.uid}/events/error/response`);
        return super.registerNode(node);
    }

    public registerService(service: Service): this {
        this.client.subscribe(`service/${service.uid}/*`);
        this.client.subscribe(`service/${service.uid}/*/response`);
        return super.registerService(service);
    }
}
